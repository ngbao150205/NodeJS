// public/account-orders.js

let allOrders = [];
let activeStatus = "all";

const STATUS_LABELS = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  shipping: "Đang giao hàng",
  completed: "Đã giao hàng",
  cancelled: "Đã hủy",
};

const STATUS_BADGE_CLASS = {
  pending: "text-bg-secondary",
  confirmed: "text-bg-info",
  shipping: "text-bg-primary",
  completed: "text-bg-success",
  cancelled: "text-bg-danger",
};

document.addEventListener("DOMContentLoaded", () => {
  initStatusTabs();
  loadMyOrders();
});

function initStatusTabs() {
  const tabs = document.querySelectorAll("#orders-status-tabs .nav-link");
  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabs.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeStatus = btn.dataset.status || "all";
      renderOrders();
    });
  });
}

async function loadMyOrders() {
  const msgEl = document.getElementById("account-orders-message");
  const tbody = document.getElementById("orders-table-body");

  if (msgEl) {
    msgEl.className = "small mb-3 text-muted";
    msgEl.textContent = "Đang tải danh sách đơn hàng...";
  }

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center small text-muted py-3">
          Đang tải dữ liệu...
        </td>
      </tr>
    `;
  }

  try {
    const res = await fetch("/api/account/orders");
    if (res.status === 401) {
      if (msgEl) {
        msgEl.className = "small mb-3 text-danger";
        msgEl.innerHTML =
          'Bạn cần <a href="/login.html">đăng nhập</a> để xem lịch sử đơn hàng.';
      }
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="text-center small text-muted py-3">
              Chưa có dữ liệu đơn hàng vì bạn chưa đăng nhập.
            </td>
          </tr>
        `;
      }
      return;
    }

    const data = await res.json();
    if (!res.ok) {
      if (msgEl) {
        msgEl.className = "small mb-3 text-danger";
        msgEl.textContent =
          data.message || "Không thể tải danh sách đơn hàng.";
      }
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="text-center small text-muted py-3">
              Không thể tải danh sách đơn hàng.
            </td>
          </tr>
        `;
      }
      return;
    }

    allOrders = data.orders || [];

    if (msgEl) {
      msgEl.className = "small mb-3 text-muted";
      msgEl.textContent =
        allOrders.length > 0
          ? `Bạn có ${allOrders.length} đơn hàng.`
          : "Bạn chưa có đơn hàng nào.";
    }

    renderOrders();
  } catch (err) {
    console.error("Lỗi loadMyOrders:", err);
    if (msgEl) {
      msgEl.className = "small mb-3 text-danger";
      msgEl.textContent = "Có lỗi xảy ra khi kết nối tới máy chủ.";
    }
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center small text-muted py-3">
            Có lỗi xảy ra khi kết nối tới máy chủ.
          </td>
        </tr>
      `;
    }
  }
}

function renderOrders() {
  const tbody = document.getElementById("orders-table-body");
  if (!tbody) return;

  let list = allOrders.slice().sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  if (activeStatus !== "all") {
    list = list.filter((o) => o.status === activeStatus);
  }

  if (!list.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center small text-muted py-3">
          Không có đơn hàng nào cho trạng thái này.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = "";

  list.forEach((o) => {
    const tr = document.createElement("tr");

    const createdText = o.created_at
      ? new Date(o.created_at).toLocaleString("vi-VN")
      : "";

    const totalText = formatPrice(o.total_amount);

    let productsText = "";
    if (o.items && o.items.length) {
      const names = o.items.map((it) => `${it.name} (x${it.qty})`);
      if (names.length <= 2) {
        productsText = names.join(", ");
      } else {
        productsText =
          names.slice(0, 2).join(", ") +
          `, ... (+${names.length - 2} sản phẩm khác)`;
      }
    } else {
      productsText = "(Không có dữ liệu sản phẩm)";
    }

    const badgeClass =
      STATUS_BADGE_CLASS[o.status] || "text-bg-secondary";
    const label =
      STATUS_LABELS[o.status] || escapeHtml(o.status || "");

    tr.innerHTML = `
      <td>#${o.id}</td>
      <td>${createdText}</td>
      <td>
        <button
          type="button"
          class="btn btn-link p-0 border-0 align-middle status-history-btn"
          data-order-id="${o.id}"
        >
          <span class="badge ${badgeClass}">${label}</span>
        </button>
      </td>
      <td class="small text-muted">
        ${escapeHtml(productsText)}
      </td>
      <td class="text-end">${totalText}</td>
      <td class="text-end">
        <a
          href="/order-success.html?id=${o.id}"
          class="btn btn-sm btn-outline-primary"
        >
          Xem chi tiết
        </a>
      </td>
    `;

    // Gắn event click cho nút trạng thái → mở modal lịch sử
    const btn = tr.querySelector(".status-history-btn");
    if (btn) {
      btn.addEventListener("click", () => {
        const orderId = btn.dataset.orderId;
        openStatusHistoryModal(orderId);
      });
    }

    tbody.appendChild(tr);
  });
}

// 🔹 Mở Modal lịch sử trạng thái cho 1 đơn hàng
async function openStatusHistoryModal(orderId) {
  const msgEl = document.getElementById(
    "order-status-history-modal-message"
  );
  const tbody = document.getElementById("order-status-history-modal-body");

  if (msgEl) {
    msgEl.className = "small mb-2 text-muted";
    msgEl.textContent = "Đang tải lịch sử trạng thái...";
  }
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" class="text-center small text-muted py-2">
          Đang tải...
        </td>
      </tr>
    `;
  }

  try {
    const res = await fetch(`/api/orders/${orderId}`);
    const data = await res.json();

    if (res.status === 401) {
      if (msgEl) {
        msgEl.className = "small mb-2 text-danger";
        msgEl.innerHTML =
          'Bạn cần <a href="/login.html">đăng nhập</a> để xem chi tiết đơn hàng.';
      }
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="3" class="text-center small text-muted py-2">
              Không thể tải lịch sử trạng thái vì bạn chưa đăng nhập.
            </td>
          </tr>
        `;
      }
    } else if (!res.ok) {
      if (msgEl) {
        msgEl.className = "small mb-2 text-danger";
        msgEl.textContent =
          data.message || "Không thể tải lịch sử trạng thái.";
      }
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="3" class="text-center small text-muted py-2">
              Không thể tải lịch sử trạng thái.
            </td>
          </tr>
        `;
      }
    } else {
      if (msgEl) {
        msgEl.className = "small mb-2 text-muted";
        msgEl.textContent =
          "Các trạng thái được sắp xếp từ mới nhất đến cũ hơn.";
      }
      renderStatusHistoryModal(data.statusHistory || []);
    }
  } catch (err) {
    console.error("Lỗi load status history:", err);
    if (msgEl) {
      msgEl.className = "small mb-2 text-danger";
      msgEl.textContent = "Có lỗi xảy ra khi kết nối tới máy chủ.";
    }
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3" class="text-center small text-muted py-2">
            Có lỗi xảy ra khi kết nối tới máy chủ.
          </td>
        </tr>
      `;
    }
  }

  const modalEl = document.getElementById("orderStatusHistoryModal");
  if (modalEl && window.bootstrap) {
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  }
}

// Render các dòng trong modal lịch sử trạng thái
function renderStatusHistoryModal(statusHistory) {
  const tbody = document.getElementById("order-status-history-modal-body");
  if (!tbody) return;

  if (!statusHistory || !statusHistory.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" class="text-center small text-muted py-2">
          Chưa có lịch sử trạng thái cho đơn hàng này.
        </td>
      </tr>
    `;
    return;
  }

  const sorted = statusHistory
    .slice()
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  tbody.innerHTML = "";
  sorted.forEach((st) => {
    const label =
      STATUS_LABELS[st.status] || escapeHtml(st.status || "");
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${label}</td>
      <td>${escapeHtml(st.note || "")}</td>
      <td>${new Date(st.created_at).toLocaleString("vi-VN")}</td>
    `;
    tbody.appendChild(tr);
  });
}

function formatPrice(price) {
  const n = Number(price) || 0;
  return n.toLocaleString("vi-VN") + "₫";
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
