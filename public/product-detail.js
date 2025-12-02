// public/product-detail.js

let currentProductId = null;
let currentUser = null;
let currentProductData = null;
let currentVariants = [];
let currentImages = [];
let currentImageIndex = 0;
let socket = null;

let zoomModal = null;
let zoomImgEl = null;

/* ======================== POLYFILL CART (nếu chưa có) ======================== */

(function ensureCartHelper() {
  if (!window.Cart) {
    console.warn("Cart helper chưa có, tạo Cart polyfill dùng localStorage.");
    const READ_KEYS = ["cart_items_v1", "cart_items", "cart"]; // cố gắng đọc nhiều key cũ
    const WRITE_KEY = "cart_items_v1";

    window.Cart = {
      getItems() {
        for (const key of READ_KEYS) {
          try {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
          } catch (e) {
            console.error("Lỗi đọc giỏ hàng từ localStorage (key=" + key + "):", e);
          }
        }
        return [];
      },
      setItems(items) {
        try {
          localStorage.setItem(WRITE_KEY, JSON.stringify(items || []));
        } catch (e) {
          console.error("Lỗi lưu giỏ hàng vào localStorage:", e);
        }
      },
    };
  }
})();

/* ======================== DOM READY ======================== */

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  currentProductId = parseInt(params.get("id"), 10) || null;

  if (!currentProductId) {
    console.error("Thiếu id sản phẩm trên URL (?id=...).");
    return;
  }

  // Modal phóng to ảnh (nếu có trong HTML)
  const zoomModalEl = document.getElementById("imageZoomModal");
  zoomImgEl = document.getElementById("zoom-image");
  if (zoomModalEl && window.bootstrap && bootstrap.Modal) {
    zoomModal = new bootstrap.Modal(zoomModalEl);
  }

  // Lấy thông tin user hiện tại
  await fetchCurrentUser();

  // Kết nối socket (nếu có socket.io ở server)
  setupSocket(currentProductId);

  // Load chi tiết sản phẩm
  await loadProductDetail();

  // Nút giỏ hàng
  initDetailCartButtons();
});

/* ======================== SOCKET.IO ======================== */

function setupSocket(productId) {
  if (typeof io === "undefined") {
    console.warn("Socket.IO client chưa được load.");
    return;
  }

  socket = io();

  socket.on("connect", () => {
    socket.emit("product:join", { productId });
  });

  socket.on("product:commentAdded", (payload) => {
    if (!payload || payload.productId !== productId) return;
    appendCommentToList(payload.comment);
  });

  socket.on("product:ratingUpdated", (payload) => {
    if (!payload || payload.productId !== productId) return;
    updateRatingSummaryUI(payload.ratingSummary);
  });
}

function updateRatingSummaryUI(summary) {
  if (!summary) return;
  const avgEl = document.getElementById("rating-avg");
  const totalEl = document.getElementById("rating-total");

  if (avgEl) avgEl.textContent = summary.avg_rating;
  if (totalEl) totalEl.textContent = summary.total_reviews;

  const starsContainer = document.getElementById("rating-stars-display");
  if (starsContainer) {
    const avg = parseFloat(summary.avg_rating) || 0;
    renderStarsDisplay(starsContainer, avg);
  }
}

function renderStarsDisplay(container, avg) {
  const fullStars = Math.round(avg);
  let html = "";
  for (let i = 1; i <= 5; i++) {
    if (i <= fullStars) {
      html += `<span class="text-warning">★</span>`;
    } else {
      html += `<span class="text-muted">☆</span>`;
    }
  }
  container.innerHTML = html;
}

function appendCommentToList(comment) {
  if (!comment) return;
  const list = document.getElementById("comment-list");
  if (!list) return;

  const div = document.createElement("div");
  div.className = "mb-2 border-bottom pb-2";

  const createdAtText = formatDatetime(comment.created_at);

  div.innerHTML = `
    <div class="small fw-semibold">${escapeHtml(comment.author_name || "Khách")}</div>
    <div class="small">${escapeHtml(comment.content || "")}</div>
    <div class="text-muted small">${createdAtText}</div>
  `;

  list.prepend(div);
}

function formatDatetime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("vi-VN");
}

/* ======================== USER HIỆN TẠI ======================== */

async function fetchCurrentUser() {
  try {
    const res = await fetch("/api/auth/me");
    if (!res.ok) return;
    const data = await res.json();
    currentUser = data && data.user ? data.user : null;
  } catch (err) {
    console.error("Lỗi lấy thông tin user:", err);
  }
}

/* ======================== LOAD CHI TIẾT SẢN PHẨM ======================== */

async function loadProductDetail() {
  try {
    const res = await fetch(`/api/products/${currentProductId}`);
    if (!res.ok) {
      const infoSec = document.getElementById("product-info-section");
      if (infoSec) {
        infoSec.innerHTML =
          '<div class="col-12 text-danger">Không thể tải thông tin sản phẩm.</div>';
      }
      return;
    }

    const data = await res.json();
    currentProductData = data.product || null;

    // Ảnh từ slug: slug-1/2/3.jpg trong public/acesss/product/
    currentImages = [];
    currentImageIndex = 0;

    if (data.product && data.product.slug) {
      const slug = data.product.slug;
      currentImages = [1, 2, 3].map(
        (i) => `/acess/product/${slug}-${i}.jpg`
      );
    } else if (data.images && data.images.length > 0) {
      currentImages = data.images.map((img) => img.url);
    }

    renderProductInfo(data);
    renderImages();
    renderVariants(data.variants || []);
    renderDescriptions(data.product);
    renderRatingsAndComments(data);

    initRatingForm(data.ratingSummary);
    initCommentForm();
  } catch (err) {
    console.error("Lỗi loadProductDetail:", err);
  }
}

/* ======================== THÔNG TIN CHUNG ======================== */

function renderProductInfo(data) {
  const { product, ratingSummary } = data;

  const breadcrumbName = document.getElementById("breadcrumb-product-name");
  const nameEl = document.getElementById("product-name");
  const brandEl = document.getElementById("product-brand");
  const soldEl = document.getElementById("product-sold");
  const shortDescEl = document.getElementById("product-short-desc");

  if (breadcrumbName) breadcrumbName.textContent = product.name || "Chi tiết";
  if (nameEl) nameEl.textContent = product.name || "Sản phẩm";
  if (brandEl)
    brandEl.textContent = `Thương hiệu: ${product.brand || "Đang cập nhật"}`;
  if (soldEl)
    soldEl.textContent = "Đã bán: " + (product.sold != null ? product.sold : 0);
  if (shortDescEl)
    shortDescEl.textContent = product.short_desc || "Chưa có mô tả ngắn.";

  const avg = ratingSummary.avg_rating || 0;
  const total = ratingSummary.total_reviews || 0;

  const starsSmallEl = document.getElementById("product-rating-stars");
  const summarySmallEl = document.getElementById("product-rating-summary");
  const starsLargeEl = document.getElementById("rating-summary-stars-large");
  const summaryLargeEl = document.getElementById("rating-summary-text");

  const starsHtml = renderStars(avg);
  if (starsSmallEl) starsSmallEl.innerHTML = starsHtml;
  if (summarySmallEl)
    summarySmallEl.textContent = `${avg} / 5 • ${total} đánh giá`;

  if (starsLargeEl) starsLargeEl.innerHTML = starsHtml;
  if (summaryLargeEl)
    summaryLargeEl.textContent = `${avg} / 5 (${total} đánh giá)`;
}

/* ======================== HÌNH ẢNH + ZOOM ======================== */

function renderImages() {
  const mainWrapper = document.getElementById("main-image-wrapper");
  const thumbRow = document.getElementById("thumb-images-row");

  if (!mainWrapper || !thumbRow) return;

  if (!currentImages || currentImages.length === 0) {
    mainWrapper.innerHTML =
      '<span class="text-muted small">Chưa có hình ảnh sản phẩm.</span>';
    thumbRow.innerHTML = "";
    return;
  }

  const currentUrl = currentImages[currentImageIndex];

  mainWrapper.innerHTML = `
    <button class="main-img-nav-btn left" type="button" data-dir="prev">
      &#10094;
    </button>
    <img class="main-image" src="${currentUrl}" alt="Ảnh sản phẩm" />
    <button class="main-img-nav-btn right" type="button" data-dir="next">
      &#10095;
    </button>
  `;

  const mainImgEl = mainWrapper.querySelector("img.main-image");
  if (mainImgEl) {
    mainImgEl.addEventListener("click", () => {
      openZoom(currentImages[currentImageIndex]);
    });
    mainImgEl.onerror = () => {
      mainImgEl.onerror = null;
      mainImgEl.src = "https://via.placeholder.com/800x600?text=No+Image";
    };
  }

  thumbRow.innerHTML = "";
  currentImages.forEach((url, index) => {
    const col = document.createElement("div");
    col.className = "col-4 col-sm-3 col-md-3 col-lg-3";
    col.innerHTML = `
      <div class="thumb-img ${index === currentImageIndex ? "active" : ""}" data-index="${index}">
        <img src="${url}" alt="Ảnh ${index + 1}" />
      </div>
    `;
    thumbRow.appendChild(col);
  });

  thumbRow.querySelectorAll(".thumb-img").forEach((el) => {
    el.addEventListener("click", () => {
      const idx = Number(el.dataset.index);
      if (Number.isNaN(idx)) return;
      currentImageIndex = idx;
      updateMainImage();
      updateActiveThumb();
    });
  });

  mainWrapper.querySelectorAll(".main-img-nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dir = btn.dataset.dir;
      if (dir === "prev") {
        currentImageIndex =
          (currentImageIndex - 1 + currentImages.length) % currentImages.length;
      } else {
        currentImageIndex =
          (currentImageIndex + 1) % currentImages.length;
      }
      updateMainImage();
      updateActiveThumb();
    });
  });
}

function updateMainImage() {
  const mainWrapper = document.getElementById("main-image-wrapper");
  const img = mainWrapper ? mainWrapper.querySelector("img.main-image") : null;
  if (!img || !currentImages || currentImages.length === 0) return;
  img.src = currentImages[currentImageIndex];
}

function updateActiveThumb() {
  const thumbRow = document.getElementById("thumb-images-row");
  if (!thumbRow) return;
  thumbRow.querySelectorAll(".thumb-img").forEach((el) => {
    const idx = Number(el.dataset.index);
    if (idx === currentImageIndex) {
      el.classList.add("active");
    } else {
      el.classList.remove("active");
    }
  });
}

function openZoom(url) {
  if (!zoomImgEl || !zoomModal) return;
  zoomImgEl.src = url;
  zoomModal.show();
}

/* ======================== BIẾN THỂ ======================== */

function renderVariants(variants) {
  currentVariants = variants || [];
  const container = document.getElementById("variant-list");
  const priceRangeEl = document.getElementById("product-price-range");

  if (!container || !priceRangeEl) return;

  // Nếu KHÔNG có biến thể: vẫn cho phép mua, chỉ không có thông tin variant
  if (!variants || variants.length === 0) {
    container.innerHTML =
      '<div class="small text-muted">Sản phẩm này chưa có biến thể.</div>';
    priceRangeEl.textContent = "Giá: Đang cập nhật";

    const btnAdd = document.getElementById("btn-add-to-cart");
    const btnBuy = document.getElementById("btn-buy-now");
    if (btnAdd) btnAdd.disabled = false;
    if (btnBuy) btnBuy.disabled = false;
    return;
  }

  const prices = variants.map((v) => Number(v.price));
  const min = Math.min(...prices);
  const max = Math.max(...prices);

  if (min === max) {
    priceRangeEl.textContent = "Giá: " + formatPrice(min);
  } else {
    priceRangeEl.textContent =
      "Giá: " + formatPrice(min) + " — " + formatPrice(max);
  }

  container.innerHTML = "";
  const groupName = "variantRadio";

  variants.forEach((v, index) => {
    let attrs = v.attrs || {};
    if (typeof attrs === "string") {
      try {
        attrs = JSON.parse(attrs);
      } catch {
        attrs = {};
      }
    }
    const attrsText = Object.entries(attrs || {})
      .map(([k, val]) => `${k}: ${val}`)
      .join(" • ");

    const id = `variant-${v.id}`;

    const wrapper = document.createElement("div");
    wrapper.className = "form-check mb-1 small";
    wrapper.innerHTML = `
      <input class="form-check-input" type="radio" name="${groupName}" id="${id}"
             value="${v.id}" ${index === 0 ? "checked" : ""}>
      <label class="form-check-label" for="${id}">
        <span class="fw-semibold">${attrsText || v.sku || "Biến thể"}</span>
        <span class="ms-1 text-danger">${formatPrice(v.price)}</span>
        <span class="ms-2 text-muted">Kho: ${v.stock}</span>
      </label>
    `;
    container.appendChild(wrapper);
  });

  const btnAdd = document.getElementById("btn-add-to-cart");
  const btnBuy = document.getElementById("btn-buy-now");
  if (btnAdd) btnAdd.disabled = false;
  if (btnBuy) btnBuy.disabled = false;
}

function getSelectedVariant() {
  if (!currentVariants || currentVariants.length === 0) return null;
  const checked = document.querySelector('input[name="variantRadio"]:checked');
  if (!checked) return currentVariants[0];
  const vid = parseInt(checked.value, 10);
  return currentVariants.find((v) => Number(v.id) === vid) || currentVariants[0];
}

/* ======================== MÔ TẢ ======================== */

function renderDescriptions(product) {
  const el = document.getElementById("product-descriptions");
  if (!el) return;
  el.textContent = product.descriptions || "Chưa có mô tả chi tiết.";
}

/* ======================== RATING + COMMENT ======================== */

function renderRatingsAndComments(data) {
  const ratingListEl = document.getElementById("rating-list");
  const commentListEl = document.getElementById("comment-list");

  const ratings = data.ratings || [];
  const comments = data.comments || [];

  if (ratingListEl) {
    if (ratings.length === 0) {
      ratingListEl.innerHTML =
        '<div class="small text-muted">Chưa có đánh giá nào.</div>';
    } else {
      ratingListEl.innerHTML = "";
      ratings.forEach((r) => {
        const div = document.createElement("div");
        div.className = "mb-2 border-bottom pb-1 small";
        div.innerHTML = `
          <div class="d-flex justify-content_between">
            <div>
              <strong>${escapeHtml(r.author_name || "Người dùng")}</strong>
              <span class="ms-2 rating-stars">${renderStars(r.stars)}</span>
            </div>
            <div class="text-muted">
              ${new Date(r.created_at).toLocaleString("vi-VN")}
            </div>
          </div>
        `;
        ratingListEl.appendChild(div);
      });
    }
  }

  if (commentListEl) {
    if (comments.length === 0) {
      commentListEl.innerHTML =
        '<div class="small text-muted">Chưa có bình luận nào.</div>';
    } else {
      commentListEl.innerHTML = "";
      comments.forEach((c) => {
        const div = document.createElement("div");
        div.className = "mb-2 border-bottom pb-1 small";
        div.innerHTML = `
          <div class="d-flex justify-content-between">
            <strong>${escapeHtml(c.author_name || "Người dùng")}</strong>
            <span class="text-muted">${new Date(
              c.created_at
            ).toLocaleString("vi-VN")}</span>
          </div>
          <div>${escapeHtml(c.content)}</div>
        `;
        commentListEl.appendChild(div);
      });
    }
  }
}

function initRatingForm(ratingSummary) {
  const wrapper = document.getElementById("rating-form-wrapper");
  if (!wrapper) return;

  if (!currentUser) {
    wrapper.innerHTML = `
      <div class="alert alert-light border small mb-0">
        Vui lòng <a href="/login.html">đăng nhập</a> để đánh giá sản phẩm.
      </div>
    `;
    return;
  }

  wrapper.innerHTML = `
    <form id="rating-form" class="small">
      <div class="mb-2">
        <label class="form-label">Chọn số sao:</label>
        <select class="form-select form-select-sm" name="stars" required>
          <option value="">-- Chọn --</option>
          <option value="5">5 sao - Rất hài lòng</option>
          <option value="4">4 sao - Hài lòng</option>
          <option value="3">3 sao - Bình thường</option>
          <option value="2">2 sao - Chưa tốt</option>
          <option value="1">1 sao - Không hài lòng</option>
        </select>
      </div>
      <button type="submit" class="btn btn-primary btn-sm">Gửi đánh giá</button>
    </form>
    <div id="rating-form-message" class="small mt-1"></div>
  `;

  const form = document.getElementById("rating-form");
  const msgEl = document.getElementById("rating-form-message");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msgEl.textContent = "";

    const formData = new FormData(form);
    const stars = formData.get("stars");

    if (!stars) {
      msgEl.textContent = "Vui lòng chọn số sao.";
      return;
    }

    try {
      const res = await fetch(`/api/products/${currentProductId}/rating`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ stars }),
      });

      const data = await res.json();
      if (!res.ok) {
        msgEl.textContent = data.message || "Có lỗi xảy ra.";
        return;
      }

      msgEl.textContent = "Đã gửi đánh giá.";
      await loadProductDetail();
    } catch (err) {
      console.error("Lỗi gửi đánh giá:", err);
      msgEl.textContent = "Có lỗi xảy ra khi gửi đánh giá.";
    }
  });
}

function initCommentForm() {
  const wrapper = document.getElementById("comment-form-wrapper");
  if (!wrapper) return;

  if (currentUser) {
    wrapper.innerHTML = `
      <form id="comment-form" class="small">
        <div class="mb-2">
          <label class="form-label">Nội dung bình luận:</label>
          <textarea class="form-control form-control-sm" name="content" rows="3" required></textarea>
        </div>
        <button type="submit" class="btn btn-outline-primary btn-sm">Gửi bình luận</button>
        <div id="comment-form-message" class="small mt-1"></div>
      </form>
    `;
  } else {
    wrapper.innerHTML = `
      <form id="comment-form" class="small">
        <div class="mb-2">
          <label class="form-label">Tên của bạn (tùy chọn):</label>
          <input type="text" class="form-control form-control-sm" name="author_name" placeholder="Khách" />
        </div>
        <div class="mb-2">
          <label class="form-label">Nội dung bình luận:</label>
          <textarea class="form-control form-control-sm" name="content" rows="3" required></textarea>
        </div>
        <button type="submit" class="btn btn-outline-primary btn-sm">Gửi bình luận</button>
        <div id="comment-form-message" class="small mt-1"></div>
      </form>
    `;
  }

  const form = document.getElementById("comment-form");
  const msgEl = document.getElementById("comment-form-message");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msgEl.textContent = "";

    const formData = new FormData(form);
    const content = (formData.get("content") || "").trim();
    const author_name = (formData.get("author_name") || "").trim();

    if (!content) {
      msgEl.textContent = "Vui lòng nhập nội dung bình luận.";
      return;
    }

    const payload = { content };
    if (!currentUser) {
      payload.author_name = author_name;
    }

    try {
      const res = await fetch(`/api/products/${currentProductId}/comment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        msgEl.textContent = data.message || "Có lỗi xảy ra.";
        return;
      }

      msgEl.textContent = "Đã gửi bình luận.";
      form.reset();
      await loadProductDetail();
    } catch (err) {
      console.error("Lỗi gửi bình luận:", err);
      msgEl.textContent = "Có lỗi xảy ra khi gửi bình luận.";
    }
  });
}

/* ======================== GIỎ HÀNG: THÊM VÀO / MUA NGAY ======================== */

function initDetailCartButtons() {
  const btnAdd = document.getElementById("btn-add-to-cart");
  const btnBuyNow = document.getElementById("btn-buy-now");

  if (!btnAdd && !btnBuyNow) return;

  function getDetailCartItem() {
    if (!currentProductData) {
      alert("Đang tải dữ liệu sản phẩm, vui lòng thử lại.");
      return null;
    }

    // số lượng
    const qtyInput = document.getElementById("detail-qty");
    let qty = Math.max(1, Number(qtyInput?.value || 1));
    if (qtyInput) qtyInput.value = qty;

    // biến thể (có thể null nếu sản phẩm không có biến thể)
    const variant = getSelectedVariant();
    let price = 0;
    let variantText = "";
    let variantId = null;

    if (variant) {
      variantId = variant.id;
      if (variant.price != null) {
        price = Number(variant.price) || 0;
      }
      let attrsObj = variant.attrs;
      if (typeof attrsObj === "string") {
        try {
          attrsObj = JSON.parse(attrsObj);
        } catch {
          attrsObj = {};
        }
      }
      variantText = Object.values(attrsObj || {}).join(" / ") || variant.sku || "";
    }

    return {
      productId: currentProductId,
      variantId,
      name: currentProductData.name || "Sản phẩm",
      price,
      qty,
      variantText,
      slug: currentProductData.slug,
    };
  }

  function addToCart(redirectToCart) {
    if (!window.Cart || typeof Cart.getItems !== "function" || typeof Cart.setItems !== "function") {
      alert("Giỏ hàng chưa sẵn sàng.");
      return;
    }

    const item = getDetailCartItem();
    if (!item) return;

    let items = Cart.getItems() || [];

    // Nếu "mua ngay": bỏ chọn các item khác
    if (redirectToCart) {
      items.forEach((it) => {
        it.selected = false;
      });
    }

    // tìm item cùng productId + variantId
    let foundIndex = -1;
    items.forEach((it, idx) => {
      if (
        Number(it.productId) === Number(item.productId) &&
        Number(it.variantId || 0) === Number(item.variantId || 0)
      ) {
        foundIndex = idx;
      }
    });

    if (foundIndex >= 0) {
      items[foundIndex].qty =
        Number(items[foundIndex].qty || 0) + item.qty;
      if (redirectToCart) {
        items[foundIndex].selected = true;
      }
    } else {
      items.push({
        productId: item.productId,
        variantId: item.variantId,
        name: item.name + (item.variantText ? ` (${item.variantText})` : ""),
        price: item.price,
        qty: item.qty,
        variantText: item.variantText,
        slug: item.slug,  
        selected: redirectToCart ? true : undefined,
      });
    }

    Cart.setItems(items);

    if (redirectToCart) {
      window.location.href = "/cart.html";
    } else {
      alert("Đã thêm sản phẩm vào giỏ hàng.");
    }
  }

  if (btnAdd) {
    btnAdd.addEventListener("click", () => addToCart(false));
  }
  if (btnBuyNow) {
    btnBuyNow.addEventListener("click", () => addToCart(true));
  }
}

/* ======================== HELPERS ======================== */

function renderStars(value) {
  const v = Number(value) || 0;
  const full = Math.floor(v);
  const empty = 5 - full;
  return "★".repeat(full) + "☆".repeat(empty);
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
