// home.js

document.addEventListener("DOMContentLoaded", () => {
  loadHomeData();
});

async function loadHomeData() {
  try {
    const res = await fetch("/api/home");
    if (!res.ok) throw new Error("Không thể tải dữ liệu trang chủ");
    const data = await res.json();

    const newProducts = data.newProducts || [];
    const bestSellers = data.bestSellers || [];
    const productsByCategory = data.productsByCategory || {};

    // Mỗi danh sách chỉ hiển thị tối đa 5 sản phẩm
    renderProductRow("new-products-row", newProducts.slice(0, 5));
    renderProductRow("best-sellers-row", bestSellers.slice(0, 5));
    renderProductRow(
      "cat-laptop-row",
      (productsByCategory["laptop"] || []).slice(0, 5)
    );
    renderProductRow(
      "cat-monitor-row",
      (productsByCategory["monitor"] || []).slice(0, 5)
    );
    renderProductRow(
      "cat-hard-drive-row",
      (productsByCategory["hard-drive"] || []).slice(0, 5)
    );
  } catch (err) {
    console.error("Lỗi load trang chủ:", err);
  }
}

function renderProductRow(containerId, products) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!products || products.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-muted small text-center">
        Chưa có sản phẩm để hiển thị.
      </div>
    `;
    return;
  }

  container.innerHTML = "";
  products.forEach((p) => {
    const col = document.createElement("div");
    col.className = "col";

    const imgUrl = getProductImageUrl(p);

    col.innerHTML = `
      <div class="card product-card shadow-sm border-0 h-100 product-card-hover" data-id="${p.id}">
        <div class="product-img-wrapper">
          <img src="${imgUrl}" alt="${escapeHtml(p.name || "")}" />
        </div>
        <div class="card-body d-flex flex-column">
          <div class="product-title">${escapeHtml(p.name || "Sản phẩm")}</div>
          <div class="product-price">${formatPrice(p.price)}</div>
          <div class="product-meta mt-auto d-flex justify-content-between align-items-center small text-muted">
            <span>${p.brand ? escapeHtml(p.brand) : ""}</span>
            <span>Đã bán: ${p.sold != null ? p.sold : 0}</span>
          </div>
        </div>
      </div>
    `;

    const card = col.querySelector(".product-card-hover");
    card.addEventListener("click", () => {
      window.location.href = `/product-detail.html?id=${p.id}`;
    });

    container.appendChild(col);
  });
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
