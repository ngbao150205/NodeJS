// admin/products.js

let currentPage = 1;
const perPage = 10;

let productModal = null;
let stockModal = null; // vẫn khai báo để không lỗi, dù không còn nút "Kho"

let lastProducts = [];
let productVariantCache = {}; // { [productId]: { variants, soldTotal } }
let allCategories = [];

//let imageDeleteFlags = { 1: false, 2: false, 3: false };

//let searchTimer = null;

/* ============ Helpers ============ */

function formatPrice(num) {
  const n = Number(num) || 0;
  return n.toLocaleString("vi-VN") + "₫";
}

function formatDateTime(str) {
  if (!str) return "";
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return str;
  return d.toLocaleString("vi-VN");
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ẢNH THUMBNAIL LIST: ưu tiên /acess/product/{slug}-1.jpg
function getProductImageUrl(p, index = 1) {
  const idx = Number(index) || 1;

  // ưu tiên slug-index
  if (p && p.slug) {
    return `/acess/product/${p.slug}-${idx}.jpg`;
  }

  // nếu backend có trường image riêng thì vẫn dùng
  if (p && p.image) {
    return p.image;
  }

  // fallback cuối cùng
  return `/acess/product/no-image.jpg`;
}

// Build text attrs từ object: {Color: 'Red', RAM: '16GB'} -> "Color: Red, RAM: 16GB"
function buildVariantAttrsText(attrs) {
  return Object.entries(attrs || {})
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
}

// Parse chuỗi "Color: Red, RAM: 16GB" -> { Color: 'Red', RAM: '16GB' }
function parseVariantAttrs(str) {
  const obj = {};
  if (!str) return obj;
  str
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((pair) => {
      const [k, ...rest] = pair.split(":");
      if (!k) return;
      const value = rest.join(":").trim();
      if (!value) return;
      obj[k.trim()] = value;
    });
  return obj;
}

// Set preview cho ảnh trong modal (1,2,3)
function setProductImagePreview(index, url) {
  const img = document.getElementById(`product-image-preview-${index}`);
  if (!img) return;

  if (url) {
    img.src = url;
  } else {
    img.src = `/acess/product/no-image.jpg`;
  }

  img.onerror = () => {
    img.onerror = null;
    img.src = `/acess/product/no-image.jpg`;
  };
}


// Đặt 3 ảnh theo slug: /acess/product/{slug}-1/2/3.jpg
function setProductImagesFromSlug(slug) {
  ["1", "2", "3"].forEach((index) => {
    if (slug) {
      setProductImagePreview(index, `/acess/product/${slug}-${index}.jpg`);
    } else {
      setProductImagePreview(index, null);
    }
  });
}

function markDeleteImage(index) {
  index = String(index);
  imageDeleteFlags[index] = true;

  // clear file input
  const input = document.getElementById(`product-image-${index}`);
  if (input) {
    input.value = "";
  }

  // reset preview về placeholder
  setProductImagePreview(index, null);
}


function addVariantRow(variant = {}) {
  const tbody = document.getElementById("variant-tbody");
  if (!tbody) return;

  const tr = document.createElement("tr");
  const attrsText = buildVariantAttrsText(variant.attrs);
  const idText = variant.id ? variant.id : "-";
  const soldText =
    typeof variant.sold === "number" ? variant.sold : "-";

  tr.innerHTML = `
    <td>
      <input type="hidden" class="variant-id" value="${variant.id || ""}" />
      ${idText}
    </td>
    <td>
      <input
        type="text"
        class="form-control form-control-sm variant-sku"
        value="${variant.sku ? escapeHtml(variant.sku) : ""}"
      />
    </td>
    <td>
      <input
        type="text"
        class="form-control form-control-sm variant-attrs"
        value="${attrsText ? escapeHtml(attrsText) : ""}"
      />
    </td>
    <td>
      <input
        type="number"
        min="0"
        class="form-control form-control-sm variant-price"
        value="${variant.price != null ? variant.price : 0}"
      />
    </td>
    <td>
      <input
        type="number"
        min="0"
        class="form-control form-control-sm variant-stock"
        value="${variant.stock != null ? variant.stock : 0}"
      />
    </td>
    <td class="text-center">
      ${soldText}
    </td>
    <td class="text-center">
      <button
        type="button"
        class="btn btn-sm btn-outline-danger btn-remove-variant"
      >
        &times;
      </button>
    </td>
  `;

  tbody.appendChild(tr);

  const btnRemove = tr.querySelector(".btn-remove-variant");
  if (btnRemove) {
    btnRemove.addEventListener("click", () => {
      tr.remove();
    });
  }
}

function renderVariantsInModal(variants) {
  const tbody = document.getElementById("variant-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!Array.isArray(variants) || variants.length === 0) {
    addVariantRow({});
    return;
  }

  variants.forEach((v) => addVariantRow(v));
}

/* ============ Khởi tạo ============ */

document.addEventListener("DOMContentLoaded", () => {
  const modalEl = document.getElementById("productModal");
  if (modalEl && window.bootstrap && bootstrap.Modal) {
    productModal = new bootstrap.Modal(modalEl);
  }

  const stockModalEl = document.getElementById("stockModal");
  if (stockModalEl && window.bootstrap && bootstrap.Modal) {
    stockModal = new bootstrap.Modal(stockModalEl);
  }

  initFilterForm();
  initProductModalEvents();
  initStockModalEvents();

  loadCategoriesForFilterAndForm();
  loadBrandsForFilter();
  loadProducts();
});

/* ============ Load danh mục và brand ============ */

async function loadCategoriesForFilterAndForm() {
  try {
    const res = await fetch("/api/product-categories");
    if (!res.ok) throw new Error("Không thể tải danh mục");
    const data = await res.json();
    allCategories = data.categories || [];

    // Filter dropdown
    const filterSelect = document.getElementById("filter-category");
    if (filterSelect) {
      filterSelect.innerHTML = `<option value="">Tất cả danh mục</option>`;
      allCategories.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.id; // backend cho phép id hoặc slug
        opt.textContent = c.name;
        filterSelect.appendChild(opt);
      });
    }

    // Checkbox trong modal
    const container = document.getElementById("product-categories-container");
    if (container) {
      container.innerHTML = "";
      allCategories.forEach((c) => {
        const wrap = document.createElement("div");
        wrap.className = "form-check form-check-inline me-3 mb-1";
        wrap.innerHTML = `
          <input
            class="form-check-input product-cat-checkbox"
            type="checkbox"
            id="prod-cat-${c.id}"
            value="${c.id}"
          />
          <label class="form-check-label" for="prod-cat-${c.id}">
            ${escapeHtml(c.name)}
          </label>
        `;
        container.appendChild(wrap);
      });
    }
  } catch (err) {
    console.error("Lỗi loadCategoriesForFilterAndForm:", err);
  }
}

async function loadBrandsForFilter() {
  try {
    const res = await fetch("/api/product-brands");
    if (!res.ok) throw new Error("Không thể tải brand");
    const data = await res.json();
    const brands = data.brands || [];

    const select = document.getElementById("filter-brand");
    if (select) {
      select.innerHTML = `<option value="">Tất cả thương hiệu</option>`;
      brands.forEach((b) => {
        const opt = document.createElement("option");
        opt.value = b;
        opt.textContent = b;
        select.appendChild(opt);
      });
    }
  } catch (err) {
    console.warn("Không load được danh sách brand:", err);
  }
}

/* ============ Lọc & tìm kiếm ============ */

function initFilterForm() {
  const form = document.getElementById("product-filter-form");
  const btnAdd = document.getElementById("btn-add-product");

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      currentPage = 1;
      loadProducts(); // 👉 Chỉ khi bấm nút "Lọc" (submit form) mới load
    });
  }

  if (btnAdd) {
    btnAdd.addEventListener("click", () => openCreateProduct());
  }
}


/* ============ Load products admin ============ */

async function loadProducts() {
  const tbody = document.getElementById("products-tbody");
  const paginationEl = document.getElementById("products-pagination");

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="text-center small text-muted">
          Đang tải...
        </td>
      </tr>`;
  }
  if (paginationEl) paginationEl.innerHTML = "";

  const qInput = document.getElementById("filter-q");
  const catSelect = document.getElementById("filter-category");
  const brandSelect = document.getElementById("filter-brand");
  const sortSelect = document.getElementById("filter-sort"); // 🔹 thêm

  const q = qInput ? qInput.value.trim() : "";
  const category = catSelect ? catSelect.value : "";
  const brand = brandSelect ? brandSelect.value : "";
  const sort = sortSelect ? sortSelect.value : ""; // 🔹 thêm

  const params = new URLSearchParams();
  params.set("page", currentPage);
  params.set("limit", perPage);
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  if (brand) params.set("brand", brand);
  if (sort) params.set("sort", sort); // 🔹 gửi sort cho backend

  try {
    const res = await fetch(`/api/admin/products?${params.toString()}`);
    if (!res.ok) throw new Error("Không thể tải danh sách sản phẩm admin");

    const data = await res.json();
    lastProducts = data.products || [];
    renderProductTable(lastProducts);
    renderProductsPagination(data.pagination);
  } catch (err) {
    console.error("Lỗi loadProducts admin:", err);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="text-center text-danger small">
            Không thể tải danh sách sản phẩm.
          </td>
        </tr>`;
    }
  }
}


function renderProductTable(products) {
  const tbody = document.getElementById("products-tbody");
  if (!tbody) return;

  if (!products || products.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="text-center small text-muted">
          Không có sản phẩm.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = "";

  products.forEach((p) => {
    const tr = document.createElement("tr");

    const categoryLabel =
      p.categoryName || p.category_name || p.categories || "";

    const createdAt = p.createdAt || p.created_at;

    tr.innerHTML = `
      <td>${p.id}</td>
      <td>
        <img
            src="${getProductImageUrl(p, 1)}"
            alt="${escapeHtml(p.name)}"
            class="img-thumbnail"
            style="width:60px;height:60px;object-fit:cover;"
            onerror="this.onerror=null;this.src='/acess/product/no-image.jpg';"
        />
        </td>
      <td>${escapeHtml(p.name || "")}</td>
      <td>${escapeHtml(categoryLabel || "")}</td>
      <td>
        <select
          class="form-select form-select-sm variant-select"
          data-product-id="${p.id}"
        ></select>
      </td>
      <td data-role="price" data-product-id="${p.id}"></td>
      <td data-role="stock" data-product-id="${p.id}"></td>
      <td data-role="sold" data-product-id="${p.id}"></td>
      <td>${formatDateTime(createdAt)}</td>
      <td style="width: 120px;">
        <button
          type="button"
          class="btn btn-sm btn-outline-primary me-1 btn-edit-product"
          data-id="${p.id}"
        >
          Sửa
        </button>
        <button
          type="button"
          class="btn btn-sm btn-outline-danger btn-delete-product"
          data-id="${p.id}"
        >
          Xoá
        </button>
      </td>
    `;

    tbody.appendChild(tr);

    // Khởi tạo select biến thể cho từng row
    initVariantSelectForRow(p);
  });

  // Gắn sự kiện Sửa / Xoá
  tbody.querySelectorAll(".btn-edit-product").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.id);
      openEditProduct(id);
    });
  });

  tbody.querySelectorAll(".btn-delete-product").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.id);
      deleteProduct(id);
    });
  });
}

/* ============ Biến thể ở list ============ */

async function loadVariantsForProduct(productId) {
  if (productVariantCache[productId]) {
    return productVariantCache[productId];
  }

  try {
    const res = await fetch(`/api/admin/products/${productId}`);
    if (!res.ok) throw new Error("Không thể tải chi tiết sản phẩm");
    const data = await res.json();

    const variantsRaw = data.variants || [];
    const variants = variantsRaw.map((v) => ({
      id: v.id,
      sku: v.sku,
      attrs: v.attrs || {},
      price: v.price,
      stock: v.stock,
      sold: v.sold || v.sold_qty || 0,
    }));

    const soldTotal =
      data.product && typeof data.product.sold !== "undefined"
        ? data.product.sold
        : null;

    const cache = { variants, soldTotal };
    productVariantCache[productId] = cache;

    // Sync vào lastProducts
    const p = lastProducts.find((x) => x.id === productId);
    if (p) {
      p.variants = variants;
      p.soldTotal = soldTotal;
    }

    return cache;
  } catch (err) {
    console.error("Lỗi loadVariantsForProduct:", err);
    const cache = { variants: [], soldTotal: null };
    productVariantCache[productId] = cache;
    return cache;
  }
}

// Khởi tạo select biến thể + binding update giá / kho / sold
function initVariantSelectForRow(product) {
  const select = document.querySelector(
    `select.variant-select[data-product-id="${product.id}"]`
  );
  const priceCell = document.querySelector(
    `td[data-role="price"][data-product-id="${product.id}"]`
  );
  const stockCell = document.querySelector(
    `td[data-role="stock"][data-product-id="${product.id}"]`
  );
  const soldCell = document.querySelector(
    `td[data-role="sold"][data-product-id="${product.id}"]`
  );

  if (!select || !priceCell || !stockCell || !soldCell) return;

  async function setup() {
    let variants = product.variants || [];
    let soldTotal = product.soldTotal;

    if (!variants || variants.length === 0) {
      if (productVariantCache[product.id]) {
        variants = productVariantCache[product.id].variants;
        soldTotal = productVariantCache[product.id].soldTotal;
      } else {
        select.innerHTML = `<option>Đang tải...</option>`;
        select.disabled = true;

        const result = await loadVariantsForProduct(product.id);
        variants = result.variants;
        soldTotal = result.soldTotal;
      }
    }

    if (!variants || variants.length === 0) {
      select.innerHTML = `<option>Không có biến thể</option>`;
      select.disabled = true;
      priceCell.textContent = "-";
      stockCell.textContent = "-";
      soldCell.textContent =
        soldTotal != null ? soldTotal : "-";
      return;
    }

    product.variants = variants;
    product.soldTotal = soldTotal;

    select.disabled = false;
    select.innerHTML = variants
      .map((v) => {
        const attrsText = Object.entries(v.attrs || {})
          .map(([k, val]) => `${k}: ${val}`)
          .join(", ");
        const label = attrsText || v.sku || `Biến thể #${v.id}`;
        return `<option value="${v.id}">${escapeHtml(label)}</option>`;
      })
      .join("");

    function applyVariant(variantId) {
      const target =
        variants.find((v) => v.id === Number(variantId)) ||
        variants[0];
      if (!target) return;
      priceCell.textContent = formatPrice(target.price);
      stockCell.textContent =
        typeof target.stock === "number" ? target.stock : "-";
      soldCell.textContent =
        typeof target.sold === "number"
          ? target.sold
          : soldTotal != null
          ? soldTotal
          : "-";
    }

    select.addEventListener("change", () => {
      applyVariant(select.value);
    });

    const firstId =
      select.value || (variants[0] ? variants[0].id : null);
    if (firstId != null) {
      select.value = firstId;
      applyVariant(firstId);
    }
  }

  setup();
}

/* ============ Phân trang ============ */

function renderProductsPagination(pagination) {
  const paginationEl = document.getElementById("products-pagination");
  if (!paginationEl) return;

  const totalPages = Math.max(1, pagination?.totalPages || 1);
  const current = pagination?.currentPage || 1;

  paginationEl.innerHTML = "";

  const createItem = (page, label, disabled, active = false) => {
    const li = document.createElement("li");
    li.className =
      "page-item" +
      (disabled ? " disabled" : "") +
      (active ? " active" : "");
    li.innerHTML = `
      <button class="page-link" type="button" data-page="${page}">
        ${label}
      </button>`;
    return li;
  };

  paginationEl.appendChild(
    createItem(current - 1, "«", current <= 1)
  );

  for (let i = 1; i <= totalPages; i++) {
    paginationEl.appendChild(
      createItem(i, i, false, i === current)
    );
  }

  paginationEl.appendChild(
    createItem(current + 1, "»", current >= totalPages)
  );

  paginationEl
    .querySelectorAll("button.page-link")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const page = Number(btn.dataset.page);
        if (!page || page === current || page < 1 || page > totalPages)
          return;
        currentPage = page;
        loadProducts();
      });
    });
}

/* ============ Modal sản phẩm (thêm / sửa) ============ */

function initProductModalEvents() {
  const form = document.getElementById("product-form");
  if (form) {
    form.addEventListener("submit", handleSubmitProductForm);
  }

  const btnAddVariant = document.getElementById("btn-add-variant");
  if (btnAddVariant) {
    btnAddVariant.addEventListener("click", () => {
      addVariantRow({});
    });
  }

  // Preview ảnh khi chọn file mới
  ["1", "2", "3"].forEach((index) => {
    const input = document.getElementById(`product-image-${index}`);
    if (!input) return;
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (!file) return;

      // chọn file mới => không xoá ảnh slot này nữa
      imageDeleteFlags[index] = false;

      const reader = new FileReader();
      reader.onload = (e) => {
        setProductImagePreview(index, e.target.result);
      };
      reader.readAsDataURL(file);
    });
  });

  // Nút Xoá ảnh
  document.querySelectorAll(".btn-remove-image").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = btn.dataset.index;
      if (!idx) return;
      markDeleteImage(idx);
    });
  });
}

function resetProductForm() {
  document.getElementById("product-id").value = "";
  document.getElementById("product-name").value = "";
  document.getElementById("product-slug").value = "";
  document.getElementById("product-brand").value = "";
  document.getElementById("product-short-desc").value = "";
  document.getElementById("product-descriptions").value = "";

  imageDeleteFlags = { 1: false, 2: false, 3: false };  // <--- thêm

  const hint = document.getElementById("product-modal-hint");
  if (hint) {
    hint.textContent =
      "Có thể thêm/sửa biến thể và tối đa 3 ảnh sản phẩm.";
  }

  document
    .querySelectorAll(".product-cat-checkbox")
    .forEach((cb) => {
      cb.checked = false;
    });

  const variantTbody = document.getElementById("variant-tbody");
  if (variantTbody) {
    variantTbody.innerHTML = "";
  }

  ["1", "2", "3"].forEach((index) => {
    const input = document.getElementById(`product-image-${index}`);
    if (input) input.value = "";
    setProductImagePreview(index, null);
  });
}

function openCreateProduct() {
  resetProductForm();
  renderVariantsInModal([]);

  const label = document.getElementById("productModalLabel");
  if (label) label.textContent = "Thêm sản phẩm";

  const hint = document.getElementById("product-modal-hint");
  if (hint) {
    hint.textContent =
      "Để trống slug để tự sinh. Thêm biến thể và 3 ảnh sản phẩm nếu cần. Nếu không khai báo biến thể, hệ thống sẽ tạo một biến thể mặc định.";
  }

  productModal?.show();
}

async function openEditProduct(id) {
  resetProductForm();
  const label = document.getElementById("productModalLabel");
  if (label) label.textContent = "Sửa sản phẩm";

  const hint = document.getElementById("product-modal-hint");
  if (hint) {
    hint.textContent =
      "Chỉnh sửa thông tin chung, danh mục, biến thể (giá/tồn kho) và tối đa 3 ảnh sản phẩm.";
  }

  try {
    const res = await fetch(`/api/admin/products/${id}`);
    if (!res.ok) throw new Error("Không thể tải chi tiết sản phẩm");
    const data = await res.json();

    const p = data.product;
    const variants = data.variants || [];
    const images = data.images || [];

    document.getElementById("product-id").value = p.id;
    document.getElementById("product-name").value = p.name || "";
    document.getElementById("product-slug").value = p.slug || "";
    document.getElementById("product-brand").value = p.brand || "";
    document.getElementById("product-short-desc").value =
      p.short_desc || "";
    document.getElementById("product-descriptions").value =
      p.descriptions || "";

    // categoryIds từ backend
    const categoryIds = p.categoryIds || [];
    const idSet = new Set(categoryIds.map((x) => String(x)));

    document
      .querySelectorAll(".product-cat-checkbox")
      .forEach((cb) => {
        cb.checked = idSet.has(cb.value);
      });

    // Biến thể trong modal
    const mappedVariants = (variants || []).map((v) => ({
      id: v.id,
      sku: v.sku,
      attrs: v.attrs || {},
      price: v.price,
      stock: v.stock,
      sold: v.sold || v.sold_qty || 0,
    }));
    renderVariantsInModal(mappedVariants);

    // Cập nhật cache cho list
    const cache = {
      variants: mappedVariants,
      soldTotal: p.sold ?? null,
    };
    productVariantCache[p.id] = cache;
    const lp = lastProducts.find((x) => x.id === p.id);
    if (lp) {
      lp.variants = mappedVariants;
      lp.soldTotal = cache.soldTotal;
    }

    // Ảnh: ưu tiên slug-1/2/3 giống product-detail.js
    if (p.slug) {
      setProductImagesFromSlug(p.slug);
    } else if (images && images.length > 0) {
      const sorted = [...images].sort(
        (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
      );
      setProductImagePreview(
        1,
        sorted[0] ? sorted[0].image_url || sorted[0].url : null
      );
      setProductImagePreview(
        2,
        sorted[1] ? sorted[1].image_url || sorted[1].url : null
      );
      setProductImagePreview(
        3,
        sorted[2] ? sorted[2].image_url || sorted[2].url : null
      );
    } else {
      ["1", "2", "3"].forEach((index) => setProductImagePreview(index, null));
    }

    imageDeleteFlags = { 1: false, 2: false, 3: false }; // <--- thêm

    ["1", "2", "3"].forEach((index) => {
      const input = document.getElementById(`product-image-${index}`);
      if (input) input.value = "";
    });

    productModal?.show();
  } catch (err) {
    console.error("Lỗi openEditProduct:", err);
    alert("Không thể tải chi tiết sản phẩm.");
  }
}

async function handleSubmitProductForm(e) {
  e.preventDefault();

  const id = document.getElementById("product-id").value.trim();
  const name = document.getElementById("product-name").value.trim();
  if (!name) {
    alert("Vui lòng nhập tên sản phẩm");
    return;
  }

  const slug = document.getElementById("product-slug").value.trim();
  const brand = document.getElementById("product-brand").value.trim();
  const short_desc =
    document.getElementById("product-short-desc").value;
  const descriptions =
    document.getElementById("product-descriptions").value;

  const categoryIds = [];
  document
    .querySelectorAll(".product-cat-checkbox:checked")
    .forEach((cb) => {
      categoryIds.push(cb.value);
    });

  // Lấy biến thể từ bảng
  const variants = [];
  document
    .querySelectorAll("#variant-tbody tr")
    .forEach((tr) => {
      const idInput = tr.querySelector(".variant-id");
      const skuInput = tr.querySelector(".variant-sku");
      const attrsInput = tr.querySelector(".variant-attrs");
      const priceInput = tr.querySelector(".variant-price");
      const stockInput = tr.querySelector(".variant-stock");

      if (!skuInput || !attrsInput || !priceInput || !stockInput) return;

      const vId = idInput ? parseInt(idInput.value, 10) || 0 : 0;
      const skuVal = (skuInput.value || "").trim();
      const attrsVal = (attrsInput.value || "").trim();
      const priceVal = Number(priceInput.value);
      let stockVal = parseInt(stockInput.value, 10);
      if (Number.isNaN(stockVal) || stockVal < 0) stockVal = 0;

      // Bỏ qua hàng trống hoàn toàn
      if (!skuVal && !attrsVal && Number.isNaN(priceVal) && !stockVal) {
        return;
      }

      variants.push({
        id: vId || undefined,
        sku: skuVal,
        attrs: parseVariantAttrs(attrsVal),
        price: Number.isNaN(priceVal) ? 0 : priceVal,
        stock: stockVal,
      });
    });

  if (variants.length === 0) {
    if (
      !confirm(
        "Bạn chưa khai báo biến thể nào. Hệ thống sẽ tạo một biến thể mặc định (giá & tồn kho = 0). Tiếp tục?"
      )
    ) {
      return;
    }
    variants.push({
      sku: "",
      attrs: {},
      price: 0,
      stock: 0,
    });
  }

  const isEdit = !!id;
  const url = isEdit
    ? `/api/admin/products/${id}`
    : "/api/admin/products";
  const method = isEdit ? "PUT" : "POST";

  try {
    const formData = new FormData();
    formData.append("name", name);
    if (slug) formData.append("slug", slug);
    if (brand) formData.append("brand", brand);
    formData.append("short_desc", short_desc || "");
    formData.append("descriptions", descriptions || "");

    // Backend hiện tại dùng 1 categoryId
    const primaryCategoryId = categoryIds[0] || "";
    if (primaryCategoryId) {
      formData.append("categoryId", primaryCategoryId);
    }

    if (variants.length > 0) {
      formData.append("variants", JSON.stringify(variants));
    }

    // Ảnh
    ["1", "2", "3"].forEach((index) => {
      const input = document.getElementById(`product-image-${index}`);
      if (input && input.files && input.files[0]) {
        formData.append(`image${index}`, input.files[0]);
      }
    });

    ["1", "2", "3"].forEach((index) => {
      if (imageDeleteFlags[index]) {
        formData.append(`deleteImage${index}`, "1");
      }
    });

    const res = await fetch(url, {
      method,
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Lỗi lưu sản phẩm");
    }

    const data = await res.json();
    alert(data.message || "Lưu sản phẩm thành công");

    productModal?.hide();
    currentPage = 1;
    loadProducts();
  } catch (err) {
    console.error("Lỗi submit product form:", err);
    alert(err.message || "Có lỗi xảy ra khi lưu sản phẩm.");
  }
}

/* ============ Modal kho (biến thể) – vẫn giữ, nhưng không dùng nút "Kho" nữa ============ */

function initStockModalEvents() {
  const form = document.getElementById("stock-form");
  if (form) {
    form.addEventListener("submit", handleStockFormSubmit);
  }
}

async function openStockModal(productId) {
  const idInput = document.getElementById("stock-product-id");
  if (!idInput) return;
  idInput.value = productId;

  const tbody = document.getElementById("stock-tbody");
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center small text-muted">
          Đang tải...
        </td>
      </tr>`;
  }

  try {
    const res = await fetch(`/api/admin/products/${productId}`);
    if (!res.ok) throw new Error("Không thể tải chi tiết sản phẩm");
    const data = await res.json();

    const variants = data.variants || [];
    const product = data.product;

    const label = document.getElementById("stockModalLabel");
    if (label) {
      label.textContent = `Quản lý kho - ${product.name} (#${product.id})`;
    }

    if (!tbody) return;

    if (variants.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center small text-muted">
            Sản phẩm chưa có biến thể.
          </td>
        </tr>`;
    } else {
      tbody.innerHTML = "";
      variants.forEach((v) => {
        const tr = document.createElement("tr");
        const attrsText = Object.entries(v.attrs || {})
          .map(([k, val]) => `${k}: ${val}`)
          .join(", ");
        tr.innerHTML = `
          <td>${v.id}</td>
          <td>${escapeHtml(v.sku || "")}</td>
          <td>${escapeHtml(attrsText || "")}</td>
          <td>
            <input
              type="number"
              class="form-control form-control-sm var-price"
              value="${v.price != null ? v.price : 0}"
              data-id="${v.id}"
            />
          </td>
          <td>
            <input
              type="number"
              class="form-control form-control-sm var-stock"
              value="${v.stock != null ? v.stock : 0}"
              data-id="${v.id}"
            />
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    stockModal?.show();
  } catch (err) {
    console.error("Lỗi openStockModal:", err);
    alert("Không thể tải kho sản phẩm.");
  }
}

async function handleStockFormSubmit(e) {
  e.preventDefault();

  const productId = Number(
    document.getElementById("stock-product-id").value
  );
  if (!productId) {
    alert("Mã sản phẩm không hợp lệ.");
    return;
  }

  const variants = [];

  document
    .querySelectorAll("#stock-tbody tr")
    .forEach((tr) => {
      const priceInput = tr.querySelector(".var-price");
      const stockInput = tr.querySelector(".var-stock");
      if (!priceInput || !stockInput) return;

      const vId = Number(priceInput.dataset.id);
      if (!vId) return;

      const priceNum = Number(priceInput.value) || 0;
      let stockNum = parseInt(stockInput.value, 10);
      if (Number.isNaN(stockNum) || stockNum < 0) stockNum = 0;

      variants.push({
        id: vId,
        price: priceNum,
        stock: stockNum,
      });
    });

  if (variants.length === 0) {
    alert("Không có biến thể nào để lưu.");
    return;
  }

  try {
    const res = await fetch(
      `/api/admin/products/${productId}/variants`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ variants }),
      }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Lỗi lưu kho sản phẩm");
    }

    const data = await res.json();
    alert(data.message || "Đã cập nhật kho sản phẩm.");

    delete productVariantCache[productId];

    stockModal?.hide();
    loadProducts();
  } catch (err) {
    console.error("Lỗi handleStockFormSubmit:", err);
    alert(err.message || "Có lỗi khi lưu kho sản phẩm.");
  }
}

/* ============ Xoá sản phẩm ============ */

async function deleteProduct(id) {
  if (!confirm("Bạn có chắc muốn xoá sản phẩm này?")) return;

  try {
    const res = await fetch(`/api/admin/products/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Lỗi xoá sản phẩm");
    }

    const data = await res.json();
    alert(data.message || "Đã xoá sản phẩm.");
    loadProducts();
  } catch (err) {
    console.error("Lỗi deleteProduct:", err);
    alert(err.message || "Có lỗi xảy ra khi xoá sản phẩm.");
  }
}
