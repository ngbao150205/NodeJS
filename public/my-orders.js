// public/my-orders.js

const STATUS_MAP = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  shipping: "Đang giao hàng",
  delivered: "Đã giao hàng",
};

document.addEventListener("DOMContentLoaded", async () => {
  const msgEl = document.getElementById("my-orders-message");

  try {
    const res = await fetch("/api/my-orders");
    if (res.status === 401) {
      if (msgEl) {
        msgEl.className = "mb-3 text-danger small";
        msgEl.textContent = "Vui lòng đăng nhập để xem lịch sử đơn hàng.";
      }
      // Nếu có trang login thì redirect:
      // window.location.href = "/login.html";
      return;
    }

    const data = await res.json();
    if (!res.ok) {
      if (msgEl) {
        msgEl.className = "mb-3 text-danger small";
        msgEl.textContent = data.message || "Không thể tải danh sách đơn hàng.";
      }
      return;
    }

    const orders = data.orders || [];
    if (!orders.length) {
      if (msgEl) {
        msgEl.className = "mb-3 text-muted small";
        msgEl.textContent = "Bạn chưa có đơn hàng nào.";
      }
      return;
    }

    renderOrdersByStatus(orders);
  } catch (err) {
    console.error("Lỗi tải my-orders:", err);
    if (msgEl) {
      msgEl.className = "mb-3 text-danger small";
      msgEl.textContent = "Có lỗi xảy ra khi kết nối tới máy chủ.";
    }
  }
});

function renderOrdersByStatus(orders) {
  const cols = {
    pending: document.getElementById("orders-col-pending"),
    confirmed: document.getElementById("orders-col-confirmed"),
    shipping: document.getElementById("orders-col-shipping"),
    delivered: document.getElementById("orders-col-delivered"),
  };

  // Clear
  Object.values(cols).forEach((col) => {
    if (col) col.innerHTML = "";
  });

  orders.forEach((o) => {
    const statusKey = o.status || "pending";
    const col = cols[statusKey];
    if (!col) return;

    const card = document.createElement("div");
    card.className = "border rounded p-2 mb-2";

    card.innerHTML = `
      <div><strong>#${o.id}</strong></div>
      <div class="text-muted small">
        Ngày: ${new Date(o.created_at).toLocaleString("vi-VN")}
      </div>
      <div class="small">
        Tổng: <strong>${formatPrice(o.total_amount)}</strong>
      </div>
      <div class="text-truncate small" title="${escapeHtml(
        o.items_summary || ""
      )}">
        ${escapeHtml(o.items_summary || "")}
      </div>
      <div class="mt-1">
        <a href="/order-success.html?id=${o.id}" class="btn btn-sm btn-outline-primary">
          Xem chi tiết
        </a>
      </div>
    `;

    col.appendChild(card);
  });
}

function formatPrice(value) {
  const n = Number(value) || 0;
  return n.toLocaleString("vi-VN") + "₫";
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
