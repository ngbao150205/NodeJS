// public/admin/orders.js

let orderPage = 1;
const orderPerPage = 10;

let filterQ = "";
let filterStatus = "";
let filterDateFrom = "";
let filterDateTo = "";

document.addEventListener("DOMContentLoaded", () => {
  initOrderFilterForm();
  initOrderModalEvents();
  loadOrders();
  const btn = document.getElementById("btn-update-order-status");
  if (btn) {
    btn.addEventListener("click", handleUpdateOrderStatus);
  }
});

/* ========== HELPERS ========== */

function formatPrice(num) {
  const n = Number(num) || 0;
  return n.toLocaleString("vi-VN") + "₫";
}

function formatDateTime(dt) {
  if (!dt) return "";
  try {
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return dt;
    return d.toLocaleString("vi-VN");
  } catch {
    return dt;
  }
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderStatusBadge(status) {
  let label = status;
  let cls = "secondary";

  switch (status) {
    case "pending":
      label = "Đang chờ xử lý";
      cls = "secondary";
      break;
    case "confirmed":
      label = "Đã xác nhận";
      cls = "primary";
      break;
    case "shipping":
      label = "Đang giao";
      cls = "info";
      break;
    case "completed":
      label = "Hoàn thành";
      cls = "success";
      break;
    case "cancelled":
      label = "Đã hủy";
      cls = "danger";
      break;
    default:
      label = status || "Không rõ";
      cls = "secondary";
      break;
  }

  return `<span class="badge bg-${cls}">${escapeHtml(label)}</span>`;
}

/* ========== FILTER FORM ========== */

function initOrderFilterForm() {
  const form = document.getElementById("order-filter-form");
  const qInput = document.getElementById("order-filter-q");
  const statusSelect = document.getElementById("order-filter-status");
  const dateFromInput = document.getElementById("order-filter-date-from");
  const dateToInput = document.getElementById("order-filter-date-to");

  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    filterQ = (qInput.value || "").trim();
    filterStatus = statusSelect.value || "";
    filterDateFrom = dateFromInput.value || "";
    filterDateTo = dateToInput.value || "";
    orderPage = 1;
    loadOrders();
  });
}

/* ========== LOAD ORDERS ========== */

async function loadOrders() {
  const tbody = document.getElementById("orders-tbody");
  const paginationEl = document.getElementById("orders-pagination");

  if (tbody) {
    tbody.innerHTML =
      '<tr><td colspan="8" class="text-center text-muted small">Đang tải...</td></tr>';
  }
  if (paginationEl) {
    paginationEl.innerHTML = "";
  }

  const params = new URLSearchParams();
  params.set("page", orderPage);
  params.set("limit", orderPerPage);
  if (filterQ) params.set("q", filterQ);
  if (filterStatus) params.set("status", filterStatus);
  if (filterDateFrom) params.set("date_from", filterDateFrom);
  if (filterDateTo) params.set("date_to", filterDateTo);

  try {
    const res = await fetch(`/api/admin/orders?${params.toString()}`);
    if (!res.ok) {
      throw new Error("Không thể tải danh sách đơn hàng");
    }
    const data = await res.json();
    renderOrdersTable(data.orders || []);
    renderOrdersPagination(data.pagination || {});
  } catch (err) {
    console.error("Lỗi loadOrders:", err);
    if (tbody) {
      tbody.innerHTML =
        '<tr><td colspan="8" class="text-center text-danger small">Lỗi tải danh sách đơn hàng.</td></tr>';
    }
  }
}

function renderOrdersTable(orders) {
  const tbody = document.getElementById("orders-tbody");
  if (!tbody) return;

  if (!orders || orders.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="8" class="text-center text-muted small">Không có đơn hàng.</td></tr>';
    return;
  }

  tbody.innerHTML = "";

  orders.forEach((o) => {
    const tr = document.createElement("tr");
    const customerName = o.full_name || "(không có tên)";
    const receiverName = o.receiver_name || "";
    const phone = o.phone || "";
    const totalAmount = formatPrice(o.total_amount);
    const statusHtml = renderStatusBadge(o.status);
    const createdAt = formatDateTime(o.created_at);

    tr.innerHTML = `
      <td>#${o.id}</td>
      <td>
        <div>${escapeHtml(customerName)}</div>
        <div class="text-muted small">${escapeHtml(o.email || "")}</div>
      </td>
      <td>${escapeHtml(receiverName || "")}</td>
      <td>${escapeHtml(phone || "")}</td>
      <td class="text-end">${totalAmount}</td>
      <td>${statusHtml}</td>
      <td>${createdAt}</td>
      <td>
        <button
          class="btn btn-sm btn-outline-primary btn-view-order"
          data-id="${o.id}"
        >
          Xem
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".btn-view-order").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      openOrderModal(id);
    });
  });
}

function renderOrdersPagination(pagination) {
  const paginationEl = document.getElementById("orders-pagination");
  if (!paginationEl) return;

  const totalPages = Math.max(1, pagination.totalPages || 1);
  const page = pagination.currentPage || 1;

  paginationEl.innerHTML = "";

  const addBtn = (p, label, disabled, active) => {
    const li = document.createElement("li");
    li.className =
      "page-item" +
      (disabled ? " disabled" : "") +
      (active ? " active" : "");
    li.innerHTML = `<button class="page-link" type="button" data-page="${p}">${label}</button>`;
    paginationEl.appendChild(li);
  };

  addBtn(page - 1, "«", page <= 1, false);
  for (let i = 1; i <= totalPages; i++) {
    addBtn(i, i, false, i === page);
  }
  addBtn(page + 1, "»", page >= totalPages, false);

  paginationEl.querySelectorAll("button.page-link").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = Number(btn.dataset.page);
      if (!p || p === orderPage || p < 1 || p > totalPages) return;
      orderPage = p;
      loadOrders();
    });
  });
}

/* ========== ORDER MODAL ========== */

function initOrderModalEvents() {
  const btnUpdate = document.getElementById("btn-update-order-status");
  if (btnUpdate) {
    btnUpdate.addEventListener("click", handleUpdateOrderStatus);
  }
}

async function openOrderModal(orderId) {
  const modalEl = document.getElementById("orderModal");
  const modal = new bootstrap.Modal(modalEl);

  // Reset UI
  document.getElementById("order-id").value = "";
  document.getElementById("order-code").textContent = "";
  document.getElementById("order-status-badge").innerHTML = "";
  document.getElementById("order-created-at").textContent = "";
  document.getElementById("order-email").textContent = "";
  document.getElementById("order-full-name").textContent = "";
  document.getElementById("order-receiver-name").textContent = "";
  document.getElementById("order-phone").textContent = "";
  document.getElementById("order-address").textContent = "";
  document.getElementById("order-subtotal").textContent = "";
  document.getElementById("order-tax").textContent = "";
  document.getElementById("order-shipping-fee").textContent = "";
  document.getElementById("order-discount").textContent = "";
  document.getElementById("order-point-discount").textContent = "";
  document.getElementById("order-total").textContent = "";
  document.getElementById("order-coupon-code").textContent = "";
  document.getElementById("order-status-note").value = "";

  const itemsTbody = document.getElementById("order-items-tbody");
  const historyEl = document.getElementById("order-status-history");
  itemsTbody.innerHTML =
    '<tr><td colspan="5" class="text-center small text-muted">Đang tải...</td></tr>';
  historyEl.innerHTML =
    '<li class="list-group-item small text-muted">Đang tải...</li>';

  try {
    const res = await fetch(`/api/admin/orders/${orderId}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Không thể tải chi tiết đơn hàng");
    }
    const data = await res.json();
    const { order, items, statusHistory } = data;

    document.getElementById("order-id").value = order.id;
    document.getElementById("order-code").textContent = "#" + order.id;
    document.getElementById("order-status-badge").innerHTML =
      renderStatusBadge(order.status);
    document.getElementById("order-created-at").textContent =
      formatDateTime(order.created_at);

    document.getElementById("order-email").textContent = order.email || "";
    document.getElementById("order-full-name").textContent =
      order.full_name || "";
    document.getElementById("order-receiver-name").textContent =
      order.receiver_name || "";
    document.getElementById("order-phone").textContent = order.phone || "";

    const addressParts = [];
    if (order.address_details) addressParts.push(order.address_details);
    if (order.district) addressParts.push(order.district);
    if (order.city) addressParts.push(order.city);
    if (order.postal_code) addressParts.push(order.postal_code);
    document.getElementById("order-address").textContent =
      addressParts.join(", ") || "(không có địa chỉ)";

    document.getElementById("order-subtotal").textContent = formatPrice(
      order.subtotal
    );
    document.getElementById("order-tax").textContent = formatPrice(order.tax);
    document.getElementById("order-shipping-fee").textContent = formatPrice(
      order.shipping_fee
    );
    document.getElementById("order-discount").textContent =
      order.discount_amount && order.discount_amount > 0
        ? "-" + formatPrice(order.discount_amount)
        : "0₫";
    document.getElementById("order-point-discount").textContent =
      order.point_discount && order.point_discount > 0
        ? "-" + formatPrice(order.point_discount)
        : "0₫";
    document.getElementById("order-total").textContent = formatPrice(
      order.total_amount
    );
    document.getElementById("order-coupon-code").textContent =
      order.coupon_code || "(không áp dụng)";

    // set select status hiện tại
    const statusSelect = document.getElementById("order-status-select");
    if (statusSelect) {
      statusSelect.value = order.status || "pending";
    }

    // render items
    if (!items || items.length === 0) {
      itemsTbody.innerHTML =
        '<tr><td colspan="5" class="text-center small text-muted">Không có sản phẩm.</td></tr>';
    } else {
      itemsTbody.innerHTML = "";
      items.forEach((it) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${escapeHtml(it.product_name || "")}</td>
          <td>${escapeHtml(it.variant_text || "")}</td>
          <td class="text-end">${formatPrice(it.price)}</td>
          <td class="text-center">${it.qty}</td>
          <td class="text-end">${formatPrice(it.line_total)}</td>
        `;
        itemsTbody.appendChild(tr);
      });
    }

    // render history
    if (!statusHistory || statusHistory.length === 0) {
      historyEl.innerHTML =
        '<li class="list-group-item small text-muted">Chưa có lịch sử trạng thái.</li>';
    } else {
      historyEl.innerHTML = "";
      statusHistory.forEach((h) => {
        const li = document.createElement("li");
        li.className = "list-group-item";
        li.innerHTML = `
          <div class="d-flex justify-content-between">
            <div>
              ${renderStatusBadge(h.status)}
              ${
                h.note
                  ? `<span class="ms-2">${escapeHtml(h.note)}</span>`
                  : ""
              }
            </div>
            <div class="text-muted small">
              ${formatDateTime(h.created_at)}
            </div>
          </div>
        `;
        historyEl.appendChild(li);
      });
    }

    document.getElementById("orderModalLabel").textContent =
      "Đơn hàng #" + order.id;

    modal.show();
  } catch (err) {
    console.error("Lỗi openOrderModal:", err);
    alert(err.message || "Không thể tải chi tiết đơn hàng.");
  }
}

async function handleUpdateOrderStatus() {
  const id = document.getElementById("order-id").value;
  const status = document.getElementById("order-status-select").value;
  const note = (document.getElementById("order-status-note").value || "").trim();

  if (!id) {
    alert("Thiếu ID đơn hàng.");
    return;
  }
  if (!status) {
    alert("Vui lòng chọn trạng thái.");
    return;
  }

  if (!confirm(`Bạn muốn đổi trạng thái đơn #${id} thành "${status}"?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/admin/orders/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, note }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || "Lỗi cập nhật trạng thái đơn hàng.");
    }

    alert(data.message || "Đã cập nhật trạng thái đơn hàng.");

    // Refresh lại danh sách + chi tiết
    await loadOrders();      // reload list
    await openOrderModal(id);
     window.location.reload();
    // reload modal
  } catch (err) {
    console.error(err);
    alert(err.message || "Có lỗi xảy ra.");
  }
}

