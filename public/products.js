// public/products.js

let currentPage = 1;
const perPage = 12;

// bộ lọc
let currentCategory = "";
let currentSearch = "";
let currentBrand = "";
let currentPriceRange = ""; // "", "0-5000000", "5000000-10000000", ...
let currentRatingMin = "";

// sắp xếp
let currentSort = ""; // "", "name_asc", "name_desc", "price_asc", "price_desc"
const SORT_OPTIONS = [
  { key: "", label: "Mặc định" },
  { key: "newest", label: "Mới nhất" },
  { key: "bestseller", label: "Bán chạy nhất" },
  { key: "name_asc", label: "Tên (A → Z)" },
  { key: "name_desc", label: "Tên (Z → A)" },
  { key: "price_asc", label: "Giá tăng dần" },
  { key: "price_desc", label: "Giá giảm dần" },
];

// chế độ xem
let currentViewMode = "grid"; // 'grid' hoặc 'list'

// cache dữ liệu trang hiện tại
let lastProducts = [];
let lastPagination = null;

// 🔥 debounce cho live search
let searchDebounceTimer = null;

document.addEventListener("DOMContentLoaded", () => {
  initProductPage();
});

async function initProductPage() {
  // 1. đọc query trên URL: ?category=&q=&sort=&brand=&priceRange=&ratingMin=
  const params = new URLSearchParams(window.location.search);
  currentCategory = params.get("category") || "";
  currentSearch = params.get("q") || "";
  currentSort = params.get("sort") || "";
  currentBrand = params.get("brand") || "";
  currentPriceRange = params.get("priceRange") || "";
  currentRatingMin = params.get("ratingMin") || "";

  initViewToggle();
  initSortControls();
  initFilterForm();

  await loadCategories();
  await loadBrands();
  await loadProducts();
}

/* ================== SORT (SẮP XẾP) ================== */

function initSortControls() {
  renderSortDropdown();
  updateSortLabel();
}

function renderSortDropdown() {
  const menu = document.getElementById("sort-dropdown");
  if (!menu) return;

  menu.innerHTML = "";
  SORT_OPTIONS.forEach((opt) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <button
        type="button"
        class="dropdown-item d-flex justify-content-between align-items-center"
        data-sort="${opt.key}">
        <span>${opt.label}</span>
        <span class="ms-2 sort-check">${opt.key === currentSort ? "✓" : ""}</span>
      </button>
    `;
    menu.appendChild(li);
  });

  menu.querySelectorAll("button.dropdown-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const value = btn.dataset.sort || "";
      currentSort = value; // "" = Mặc định

      updateSortLabel();
      renderSortDropdown(); // vẽ lại dấu tick

      currentPage = 1;
      loadProducts();
    });
  });
}

function updateSortLabel() {
  const labelBtn = document.getElementById("sort-label");
  if (!labelBtn) return;
  const currentOpt =
    SORT_OPTIONS.find((o) => o.key === currentSort) || SORT_OPTIONS[0];
  labelBtn.textContent = "Sắp xếp: " + currentOpt.label;
}

/* ================== DANH MỤC & THƯƠNG HIỆU ================== */

async function loadCategories() {
  const container = document.getElementById("category-list");
  if (!container) return;

  try {
    const res = await fetch("/api/product-categories");
    if (!res.ok) throw new Error("Không thể tải danh mục");

    const data = await res.json();
    const categories = data.categories || [];

    container.innerHTML = "";

    // === Nút "Tất cả sản phẩm" ===
    const btnAll = document.createElement("button");
    btnAll.type = "button";
    btnAll.className = "list-group-item list-group-item-action";
    btnAll.dataset.category = "";
    btnAll.textContent = "Tất cả sản phẩm";
    container.appendChild(btnAll);

    // === Nút đặc biệt: Sản phẩm mới (sort theo created_at) ===
    const btnNewest = document.createElement("button");
    btnNewest.type = "button";
    btnNewest.className = "list-group-item list-group-item-action";
    btnNewest.dataset.special = "newest";
    btnNewest.textContent = "Sản phẩm mới";
    container.appendChild(btnNewest);

    // === Nút đặc biệt: Bán chạy nhất (sort theo sold) ===
    const btnBest = document.createElement("button");
    btnBest.type = "button";
    btnBest.className = "list-group-item list-group-item-action";
    btnBest.dataset.special = "bestseller";
    btnBest.textContent = "Bán chạy nhất";
    container.appendChild(btnBest);

    // === Các danh mục thực tế từ DB ===
    categories.forEach((cat) => {
      const nameLower = (cat.name || "").trim().toLowerCase();
      const slugLower = (cat.slug || "").trim().toLowerCase();

      // 🔥 BỎ QUA 2 danh mục đặc biệt từ DB:
      //   - Name: "Best Sellers", "New Products"
      //   - Slug: "best-sellers", "new-products" (hoặc các biến thể)
      if (
        nameLower === "best sellers" ||
        nameLower === "new products" ||
        slugLower === "best-sellers" ||
        slugLower === "new-products" ||
        slugLower === "best_sellers" ||
        slugLower === "new_products"
      ) {
        return; // không render 2 category này
      }

      const slugOrId = cat.slug || cat.id;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "list-group-item list-group-item-action";
      btn.dataset.category = slugOrId;
      btn.innerHTML = `
        ${escapeHtml(cat.name)}
        <span class="badge bg-light text-muted ms-1">${cat.productCount}</span>
      `;
      container.appendChild(btn);
    });

    const allButtons = container.querySelectorAll(".list-group-item");

    // Set active ban đầu
    allButtons.forEach((btn) => {
      const special = btn.dataset.special || "";
      const cat = btn.dataset.category ?? "";

      let isActive = false;

      if (special === "newest" && currentSort === "newest") {
        isActive = true;
      } else if (special === "bestseller" && currentSort === "bestseller") {
        isActive = true;
      } else if (!special) {
        // Nút "Tất cả" hoặc category thường
        if (!cat && !currentCategory && !currentSort) {
          isActive = true;
        } else if (
          cat &&
          currentCategory &&
          String(currentCategory) === String(cat)
        ) {
          isActive = true;
        }
      }

      if (isActive) {
        btn.classList.add("active");
      }

      btn.addEventListener("click", () => {
        allButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        const sp = btn.dataset.special || "";

        if (sp === "newest") {
          currentCategory = "";
          currentSort = "newest";
        } else if (sp === "bestseller") {
          currentCategory = "";
          currentSort = "bestseller";
        } else {
          currentCategory = btn.dataset.category || "";
          // Nếu đang ở sort đặc biệt mà chọn category → reset sort (tùy yêu cầu)
          if (currentSort === "newest" || currentSort === "bestseller") {
            currentSort = "";
          }
        }

        currentPage = 1;
        updateSortLabel();
        renderSortDropdown();
        loadProducts();
      });
    });
  } catch (err) {
    console.error("Lỗi loadCategories:", err);
    container.innerHTML = `
      <button
        type="button"
        class="list-group-item list-group-item-action active"
        data-category="">
        Tất cả sản phẩm
      </button>
      <div class="small text-danger mt-2">
        Không thể tải danh mục. Vui lòng thử lại sau.
      </div>
    `;
  }
}



async function loadBrands() {
  const select = document.getElementById("brand-select");
  if (!select) return;

  try {
    const res = await fetch("/api/product-brands");
    if (!res.ok) throw new Error("Không thể tải thương hiệu");

    const data = await res.json();
    const brands = data.brands || [];

    select.innerHTML = `<option value="">Tất cả thương hiệu</option>`;
    brands.forEach((b) => {
      const opt = document.createElement("option");
      opt.value = b;
      opt.textContent = b;
      if (b === currentBrand) opt.selected = true;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error("Lỗi loadBrands:", err);
  }
}

/* ================== FORM LỌC (TÌM KIẾM + BRAND + GIÁ + RATING) ================== */

function initFilterForm() {
  const form = document.getElementById("filter-form");
  const searchInput = document.getElementById("search-input");
  const brandSelect = document.getElementById("brand-select");
  const priceRangeSelect = document.getElementById("price-range");
  const ratingMinSelect = document.getElementById("rating-min");

  if (!form) return;

  // set giá trị ban đầu từ state
  if (searchInput && currentSearch) searchInput.value = currentSearch;
  if (brandSelect && currentBrand) brandSelect.value = currentBrand;
  if (priceRangeSelect && currentPriceRange)
    priceRangeSelect.value = currentPriceRange;
  if (ratingMinSelect && currentRatingMin)
    ratingMinSelect.value = currentRatingMin;

  // 🔥 LIVE SEARCH: chỉ áp dụng cho ô tìm kiếm tên / mô tả
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const newValue = (searchInput.value || "").trim();

      // nếu không đổi gì thì thôi
      if (newValue === currentSearch) return;

      currentSearch = newValue;
      currentPage = 1;

      // debounce để tránh gọi API liên tục
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
      }
      searchDebounceTimer = setTimeout(() => {
        loadProducts();
      }, 350);
    });
  }

  // Lọc bằng nút "Lọc" (brand, price, rating,...)
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    currentSearch = (searchInput.value || "").trim();
    currentBrand = brandSelect.value || "";
    currentPriceRange = priceRangeSelect.value || "";
    currentRatingMin = ratingMinSelect.value || "";

    currentPage = 1;
    loadProducts();
  });
}

/* ================== VIEW MODE (LƯỚI / DANH SÁCH) ================== */

function initViewToggle() {
  const btnGrid = document.getElementById("btn-view-grid");
  const btnList = document.getElementById("btn-view-list");
  if (!btnGrid || !btnList) return;

  btnGrid.addEventListener("click", () => {
    if (currentViewMode === "grid") return;
    currentViewMode = "grid";
    btnGrid.classList.add("active");
    btnList.classList.remove("active");
    renderProducts(lastProducts);
  });

  btnList.addEventListener("click", () => {
    if (currentViewMode === "list") return;
    currentViewMode = "list";
    btnList.classList.add("active");
    btnGrid.classList.remove("active");
    renderProducts(lastProducts);
  });
}

/* ================== LOAD & RENDER SẢN PHẨM ================== */

async function loadProducts() {
  const summaryEl = document.getElementById("product-summary");
  const listEl = document.getElementById("product-list");
  const paginationEl = document.getElementById("pagination");

  if (summaryEl) {
    summaryEl.textContent = "Đang tải danh sách sản phẩm...";
  }
  if (listEl) {
    listEl.innerHTML = "";
  }
  if (paginationEl) {
    paginationEl.innerHTML = "";
  }

  const params = new URLSearchParams();
  params.set("page", currentPage);
  params.set("limit", perPage);

  if (currentCategory) params.set("category", currentCategory);
  if (currentSearch) params.set("q", currentSearch);
  if (currentSort) params.set("sort", currentSort);
  if (currentBrand) params.set("brand", currentBrand);
  if (currentRatingMin) params.set("ratingMin", currentRatingMin);
  if (currentPriceRange) params.set("priceRange", currentPriceRange);

  // map priceRange -> priceMin / priceMax cho backend
  const { min: priceMin, max: priceMax } = getPriceRangeValues(
    currentPriceRange
  );
  if (priceMin != null) params.set("priceMin", priceMin);
  if (priceMax != null) params.set("priceMax", priceMax);

  try {
    const res = await fetch(`/api/products?${params.toString()}`);
    if (!res.ok) throw new Error("Không thể tải sản phẩm");

    const data = await res.json();
    lastProducts = data.products || [];
    lastPagination =
      data.pagination || {
        totalItems: 0,
        totalPages: 1,
        currentPage: currentPage,
        perPage,
      };

    renderProducts(lastProducts);
    renderSummary(summaryEl, lastProducts, lastPagination);
    renderPagination(lastPagination);
  } catch (err) {
    console.error("Lỗi loadProducts:", err);
    if (summaryEl) {
      summaryEl.textContent =
        "Không thể tải danh sách sản phẩm. Vui lòng thử lại.";
    }
    if (listEl) {
      listEl.innerHTML = `<div class="col-12 text-center text-danger small">Có lỗi xảy ra.</div>`;
    }
  }
}

function renderProducts(products) {
  const listEl = document.getElementById("product-list");
  if (!listEl) return;

  if (!products || products.length === 0) {
    listEl.innerHTML = `
      <div class="col-12 text-center text-muted small">
        Không có sản phẩm nào phù hợp với điều kiện tìm kiếm.
      </div>
    `;
    return;
  }

  listEl.innerHTML = "";

  products.forEach((p) => {
    const imgUrl = getProductImageUrl(p);

    if (currentViewMode === "grid") {
      // ====== VIEW LƯỚI ======
      const col = document.createElement("div");
      col.className = "col-6 col-md-4 col-lg-3";

      col.innerHTML = `
        <div class="card product-card product-card-hover shadow-sm h-100" data-id="${p.id}">
          <div class="product-img-wrapper">
            <img src="${imgUrl}" alt="${escapeHtml(p.name || "")}" />
          </div>
          <div class="card-body d-flex flex-column">
            <div class="product-title">${escapeHtml(p.name || "Sản phẩm")}</div>
            <div class="product-price">${formatPrice(p.price)}</div>
            <div class="product-desc mb-1">
              ${escapeHtml(p.shortDescription || "")}
            </div>
            <div class="mt-auto d-flex justify-content-between align-items-center small text-muted">
              <span>
                ${
                  p.categoryName
                    ? escapeHtml(p.categoryName)
                    : ""
                }${p.brand ? " • " + escapeHtml(p.brand) : ""}
              </span>
              <span>Đã bán: ${p.sold != null ? p.sold : 0}</span>
            </div>
          </div>
        </div>
      `;

      const card = col.querySelector(".product-card-hover");
      const img = col.querySelector("img");
      if (img) {
        img.onerror = () => {
          img.onerror = null;
          img.src =
            "https://via.placeholder.com/300x200?text=No+Image";
        };
      }
      card.addEventListener("click", () => {
        window.location.href = `/product-detail.html?id=${p.id}`;
      });

      listEl.appendChild(col);
    } else {
      // ====== VIEW DANH SÁCH ======
      const row = document.createElement("div");
      row.className = "col-12";

      row.innerHTML = `
        <div class="card product-card product-card-list product-card-hover shadow-sm" data-id="${p.id}">
          <div class="row g-0 align-items-stretch">
            <div class="col-4 col-sm-3">
              <div class="product-img-wrapper-list">
                <img src="${imgUrl}" alt="${escapeHtml(p.name || "")}" />
              </div>
            </div>
            <div class="col-8 col-sm-9">
              <div class="card-body d-flex flex-column">
                <h5 class="product-title mb-1">${escapeHtml(
                  p.name || "Sản phẩm"
                )}</h5>
                <div class="product-price mb-1">${formatPrice(p.price)}</div>
                <div class="small text-muted mb-1">
                  ${
                    p.categoryName
                      ? escapeHtml(p.categoryName)
                      : ""
                  }${p.brand ? " • " + escapeHtml(p.brand) : ""}
                </div>
                <div class="product-desc mb-2">
                  ${escapeHtml(p.shortDescription || "")}
                </div>
                <div class="mt-auto d-flex justify-content-between align-items-center small text-muted">
                  <span>Đã bán: ${p.sold != null ? p.sold : 0}</span>
                  <span>⭐ ${
                    p.avg_rating != null
                      ? Number(p.avg_rating).toFixed(1)
                      : "0.0"
                  }</span>
                </div>
                <div class="mt-2 d-flex justify-content-end gap-2">
                  <button class="btn btn-sm btn-outline-primary btn-detail" type="button">
                    Xem chi tiết
                  </button>
                  <button class="btn btn-sm btn-primary btn-buy-now" type="button">
                    Mua ngay
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      const card = row.querySelector(".product-card-hover");
      const btnDetail = row.querySelector(".btn-detail");
      const btnBuyNow = row.querySelector(".btn-buy-now");
      const img = row.querySelector("img");

      if (img) {
        img.onerror = () => {
          img.onerror = null;
          img.src =
            "https://via.placeholder.com/300x200?text=No+Image";
        };
      }

      card.addEventListener("click", () => {
        window.location.href = `/product-detail.html?id=${p.id}`;
      });

      btnDetail.addEventListener("click", (e) => {
        e.stopPropagation();
        window.location.href = `/product-detail.html?id=${p.id}`;
      });

      btnBuyNow.addEventListener("click", (e) => {
        e.stopPropagation();
        alert("Chức năng 'Mua ngay' sẽ được triển khai sau (liên kết checkout).");
      });

      listEl.appendChild(row);
    }
  });
}

function renderSummary(el, products, pagination) {
  if (!el) return;
  const { totalItems, currentPage, totalPages } = pagination;
  el.textContent = `Tìm thấy ${totalItems} sản phẩm. Đang hiển thị trang ${currentPage} / ${totalPages}.`;
}

// Luôn hiển thị phân trang, kể cả khi chỉ có 1 trang
function renderPagination(pagination) {
  const paginationEl = document.getElementById("pagination");
  if (!paginationEl) return;

  const totalPages = Math.max(1, pagination.totalPages || 1);
  const currentPageLocal = pagination.currentPage || 1;

  paginationEl.innerHTML = "";

  // Prev
  const prevLi = document.createElement("li");
  prevLi.className =
    "page-item" + (currentPageLocal <= 1 ? " disabled" : "");
  prevLi.innerHTML = `
    <button class="page-link" type="button" data-page="${
      currentPageLocal - 1
    }">&laquo;</button>
  `;
  paginationEl.appendChild(prevLi);

  // Pages
  for (let i = 1; i <= totalPages; i++) {
    const li = document.createElement("li");
    li.className = "page-item" + (i === currentPageLocal ? " active" : "");
    li.innerHTML = `
      <button class="page-link" type="button" data-page="${i}">${i}</button>
    `;
    paginationEl.appendChild(li);
  }

  // Next
  const nextLi = document.createElement("li");
  nextLi.className =
    "page-item" + (currentPageLocal >= totalPages ? " disabled" : "");
  nextLi.innerHTML = `
    <button class="page-link" type="button" data-page="${
      currentPageLocal + 1
    }">&raquo;</button>
  `;
  paginationEl.appendChild(nextLi);

  // Gắn event
  paginationEl.querySelectorAll("button.page-link").forEach((btn) => {
    btn.addEventListener("click", () => {
      const page = Number(btn.dataset.page);
      if (
        !page ||
        page === currentPage ||
        page < 1 ||
        page > totalPages
      )
        return;
      currentPage = page;
      loadProducts();
    });
  });
}

/* ================== HELPERS ================== */

function getPriceRangeValues(rangeKey) {
  switch (rangeKey) {
    case "0-5000000":
      return { min: 0, max: 5000000 };
    case "5000000-10000000":
      return { min: 5000000, max: 10000000 };
    case "10000000-20000000":
      return { min: 10000000, max: 20000000 };
    case "20000000-0":
      return { min: 20000000, max: null };
    default:
      return { min: null, max: null };
  }
}

function getProductImageUrl(p) {
  if (p.slug) {
    return `/acess/product/${p.slug}-1.jpg`;
  }
  if (p.image) return p.image;
  return "https://via.placeholder.com/300x200?text=No+Image";
}

function formatPrice(price) {
  if (price == null) return "Liên hệ";
  const num = Number(price);
  if (Number.isNaN(num)) return "Liên hệ";
  return num.toLocaleString("vi-VN") + "₫";
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
