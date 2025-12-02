// public/order-success.js

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

// 👉 ĐỔI CHỖ NÀY NẾU FOLDER KHÁC
// Nếu folder thật là "acess", để như dưới:
const PRODUCT_IMAGE_BASE_PATH = "/acess/product";
// Nếu bạn rename thành "access", đổi thành:
// const PRODUCT_IMAGE_BASE_PATH = "/access/product";

// 🔹 Dùng chung rule với cart
function getCartItemImageUrl(item) {
  if (item.image) {
    if (item.image.startsWith("http") || item.image.startsWith("/")) {
      return item.image;
    }
    return `${PRODUCT_IMAGE_BASE_PATH}/${item.image}`;
  }

  const slug =
    item.slug ||
    item.product_slug ||
    item.productSlug ||
    item.product_slug_name;

  if (slug) {
    return `${PRODUCT_IMAGE_BASE_PATH}/${slug}-1.jpg`;
  }

  return `${PRODUCT_IMAGE_BASE_PATH}/no-image.jpg`;
}

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("id");

  const msgEl = document.getElementById("order-success-message");

  if (!orderId) {
    if (msgEl) {
      msgEl.textContent = "Không tìm thấy thông tin đơn hàng.";
    }
    return;
  }

  // Đọc localStorage (dùng khi không gọi được API – guest checkout)
  let localData = null;
  try {
    const raw = localStorage.getItem("last_order_success");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        parsed.order &&
        String(parsed.order.id) === String(orderId)
      ) {
        localData = parsed;
      }
    }
  } catch (e) {
    console.warn("Không parse được last_order_success:", e);
  }

  // ƯU TIÊN: gọi API để lấy trạng thái mới nhất
  let usedApi = false;

  try {
    const res = await fetch(`/api/orders/${orderId}`);
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      usedApi = true;
      renderFromApi(data);
      renderFromLocal(localData);
      
    } else if (res.status === 401 || res.status === 404) {
      // Không truy cập được API (chưa login / đơn không thuộc user)
      if (localData) {
        renderFromLocal(localData);
      } else if (msgEl) {
        //renderFromLocal(localData);
        msgEl.textContent =
          data.message || "Không thể tải thông tin đơn hàng.";
      }
    } else {
      // Lỗi khác từ server
      if (msgEl) {
        msgEl.textContent =
          data.message || "Không thể tải thông tin đơn hàng từ máy chủ.";
      }
      if (localData) {
        // vẫn cố gắng hiển thị thông tin local
        renderFromLocal(localData);
      }
    }
  } catch (err) {
    console.error("Lỗi load đơn ở order-success.js:", err);
    if (msgEl) {
      msgEl.textContent = "Có lỗi xảy ra khi kết nối tới máy chủ.";
    }
    if (localData) {
      renderFromLocal(localData);
    }
  }

  // Nếu không dùng được API và cũng không có localData → báo lỗi
  if (!usedApi && !localData && msgEl && !msgEl.textContent) {
    msgEl.textContent = "Không tìm thấy thông tin đơn hàng.";
  }
});

function formatPrice(price) {
  const n = Number(price) || 0;
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

/**
 * Render khi có đầy đủ dữ liệu từ localStorage (vừa đặt xong, chưa login / chưa xem qua API)
 */
function renderFromLocal(data) {
  const { order, items, summary, shipping, guestCreated, emailForAccount } =
    data;

  const orderIdEl = document.getElementById("order-id");
  const orderEmailEl = document.getElementById("order-email");
  const orderStatusEl = document.getElementById("order-status");
  const orderCreatedAtEl = document.getElementById("order-created-at");
  const shippingBox = document.getElementById("order-shipping-info");
  const itemsBody = document.getElementById("order-items-body");
  const summaryBox = document.getElementById("order-summary-box");
  const accountInfoBox = document.getElementById("order-account-info");

  if (orderIdEl) orderIdEl.textContent = order.id;
  if (orderEmailEl)
    orderEmailEl.textContent =
      emailForAccount || (shipping && shipping.email) || "";

  if (orderStatusEl) {
    const statusKey = "pending";
    const label = STATUS_LABELS[statusKey] || "Chờ xác nhận";
    const badgeClass =
      STATUS_BADGE_CLASS[statusKey] || "text-bg-secondary";
    orderStatusEl.innerHTML = `<span class="badge ${badgeClass}">${label}</span>`;
  }

  if (orderCreatedAtEl) {
    // đơn mới tạo, chưa có timestamp từ server → tạm dùng thời gian hiện tại
    orderCreatedAtEl.textContent = new Date().toLocaleString("vi-VN");
  }

  if (shippingBox && shipping) {
    shippingBox.innerHTML = `
      <div><strong>${escapeHtml(
        shipping.receiver_name
      )}</strong> (${escapeHtml(shipping.full_name)})</div>
      <div>Email: ${escapeHtml(shipping.email)}</div>
      <div>Điện thoại: ${escapeHtml(shipping.phone)}</div>
      <div>Địa chỉ: ${escapeHtml(shipping.address_details)}, ${escapeHtml(
      shipping.district
    )}, ${escapeHtml(shipping.city)} ${
      shipping.postal_code
        ? "(" + escapeHtml(shipping.postal_code) + ")"
        : ""
    }</div>
    `;
  }

  // Sản phẩm + ảnh giống cart
  if (itemsBody && items && items.length) {
    itemsBody.innerHTML = "";
    items.forEach((it, index) => {

      console.log("[ORDER-SUCCESS][API] RAW ITEM", index, it); 

      const price = Number(it.price) || 0;
      const qty = Number(it.qty) || 0;
      const lineTotal = price * qty;

      const imgUrl = getCartItemImageUrl(it);

      console.log("[ORDER-SUCCESS][LOCAL] item", index, {
        slug: it.slug,
        product_slug: it.product_slug,
        image: it.image,
        imgUrl,
      });

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <img
            src="${escapeHtml(imgUrl)}"
            alt="${escapeHtml(it.name || "Sản phẩm")}"
            class="order-item-thumb"
            onerror="this.src='${PRODUCT_IMAGE_BASE_PATH}/no-image.jpg';"
          />
        </td>
        <td>
          <div class="fw-semibold">${escapeHtml(
            it.name || "Sản phẩm"
          )}</div>
          ${
            it.variantText
              ? `<div class="text-muted small">${escapeHtml(
                  it.variantText
                )}</div>`
              : ""
          }
        </td>
        <td class="text-center">${qty}</td>
        <td class="text-end">${formatPrice(price)}</td>
        <td class="text-end">${formatPrice(lineTotal)}</td>
      `;
      itemsBody.appendChild(tr);
    });
  }

  if (summaryBox && summary) {
    summaryBox.innerHTML = `
      <div class="d-flex justify-content-between">
        <span>Tạm tính</span>
        <span>${formatPrice(summary.subtotal)}</span>
      </div>
      <div class="d-flex justify-content-between">
        <span>Thuế (10%)</span>
        <span>${formatPrice(summary.tax)}</span>
      </div>
      <div class="d-flex justify-content-between">
        <span>Phí vận chuyển</span>
        <span>${formatPrice(summary.shipping)}</span>
      </div>
      <div class="d-flex justify-content-between">
        <span>Giảm giá</span>
        <span>${
          summary.discount > 0
            ? "-" + formatPrice(summary.discount)
            : "0₫"
        }</span>
      </div>
      <hr class="my-2" />
      <div class="d-flex justify-content-between fw-semibold">
        <span>Tổng thanh toán</span>
        <span>${formatPrice(summary.total)}</span>
      </div>
    `;
  }

  if (accountInfoBox) {
    if (guestCreated) {
      accountInfoBox.innerHTML = `
        <div class="alert alert-info small mb-0">
          Hệ thống đã tạo tài khoản cho bạn với thông tin:
          <br />- Email đăng nhập:
          <strong>${escapeHtml(emailForAccount || "")}</strong>
          <br />- Mật khẩu mặc định:
          <strong>123456</strong>
          <br />
          Vui lòng đăng nhập và đổi mật khẩu sau khi nhận email xác nhận.
        </div>
      `;
    } else {
      accountInfoBox.innerHTML = "";
    }
  }

  // Lịch sử trạng thái ở mode local: chỉ 1 trạng thái "Chờ xác nhận"
  renderStatusHistoryLocal();
}

/**
 * Render khi chỉ có dữ liệu từ API /api/orders/:id
 */
function renderFromApi(data) {
  const { order, items, statusHistory } = data;

  const orderIdEl = document.getElementById("order-id");
  const orderEmailEl = document.getElementById("order-email");
  const orderStatusEl = document.getElementById("order-status");
  const orderCreatedAtEl = document.getElementById("order-created-at");
  const shippingBox = document.getElementById("order-shipping-info");
  const itemsBody = document.getElementById("order-items-body");
  const summaryBox = document.getElementById("order-summary-box");
  const accountInfoBox = document.getElementById("order-account-info");

  if (orderIdEl) orderIdEl.textContent = order.id;
  if (orderEmailEl) orderEmailEl.textContent = order.email;

  const statusKey = order.status;
  const statusLabel =
    STATUS_LABELS[statusKey] || escapeHtml(statusKey || "");
  const badgeClass =
    STATUS_BADGE_CLASS[statusKey] || "text-bg-secondary";

  if (orderStatusEl) {
    orderStatusEl.innerHTML = `<span class="badge ${badgeClass}">${statusLabel}</span>`;
  }

  if (orderCreatedAtEl) {
    orderCreatedAtEl.textContent = new Date(
      order.created_at
    ).toLocaleString("vi-VN");
  }

  if (shippingBox) {
    shippingBox.innerHTML = `
      <div><strong>${escapeHtml(
        order.receiver_name
      )}</strong> (${escapeHtml(order.full_name)})</div>
      <div>Email: ${escapeHtml(order.email)}</div>
      <div>Điện thoại: ${escapeHtml(order.phone)}</div>
      <div>Địa chỉ: ${escapeHtml(order.address_details)}, ${escapeHtml(
      order.district
    )}, ${escapeHtml(order.city)} ${
      order.postal_code ? "(" + escapeHtml(order.postal_code) + ")" : ""
    }</div>
    `;
  }

  // Sản phẩm + ảnh
  if (itemsBody && items && items.length) {
    itemsBody.innerHTML = "";
    items.forEach((it, index) => {
      const price = Number(it.price) || 0;
      const qty =
        Number(it.qty) || Number(it.quantity || 0) || 0;
      const lineTotal = price * qty;

      const imgUrl = getCartItemImageUrl(it);

      console.log("[ORDER-SUCCESS][API] item", index, {
        slug: it.slug,
        product_slug: it.product_slug,
        image: it.image,
        imgUrl,
      });

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <img
            src="${escapeHtml(imgUrl)}"
            alt="${escapeHtml(it.product_name || it.name || "Sản phẩm")}"
            class="order-item-thumb"
            onerror="this.src='${PRODUCT_IMAGE_BASE_PATH}/no-image.jpg';"
          />
        </td>
        <td>
          <div class="fw-semibold">${escapeHtml(
            it.product_name || it.name || "Sản phẩm"
          )}</div>
          ${
            it.variant_text
              ? `<div class="text-muted small">${escapeHtml(
                  it.variant_text
                )}</div>`
              : ""
          }
        </td>
        <td class="text-center">${qty}</td>
        <td class="text-end">${formatPrice(price)}</td>
        <td class="text-end">${formatPrice(lineTotal)}</td>
      `;
      itemsBody.appendChild(tr);
    });
  }

  if (summaryBox && order) {
    summaryBox.innerHTML = `
      <div class="d-flex justify-content-between">
        <span>Tạm tính</span>
        <span>${formatPrice(order.subtotal)}</span>
      </div>
      <div class="d-flex justify-content-between">
        <span>Thuế (10%)</span>
        <span>${formatPrice(order.tax)}</span>
      </div>
      <div class="d-flex justify-content-between">
        <span>Phí vận chuyển</span>
        <span>${formatPrice(order.shipping_fee)}</span>
      </div>
      <div class="d-flex justify-content-between">
        <span>Giảm giá</span>
        <span>${
          order.discount_amount > 0
            ? "-" + formatPrice(order.discount_amount)
            : "0₫"
        }</span>
      </div>
      <hr class="my-2" />
      <div class="d-flex justify-content-between fw-semibold">
        <span>Tổng thanh toán</span>
        <span>${formatPrice(order.total_amount)}</span>
      </div>
    `;
  }

  if (accountInfoBox) {
    // mode API: không hiển thị thông tin tạo guest auto
    accountInfoBox.innerHTML = "";
  }

  // Render bảng lịch sử trạng thái từ API
  renderStatusHistory(statusHistory);
}

/**
 * Lịch sử trạng thái từ API
 */
function renderStatusHistory(statusHistory) {
  const tbody = document.getElementById("order-status-history-body");
  if (!tbody) return;

  if (!statusHistory || !statusHistory.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" class="text-center text-muted small">
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
    const statusKey = st.status;
    const label =
      STATUS_LABELS[statusKey] || escapeHtml(statusKey || "");
    const badgeClass =
      STATUS_BADGE_CLASS[statusKey] || "text-bg-secondary";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="badge ${badgeClass}">${label}</span></td>
      <td>${escapeHtml(st.note || "")}</td>
      <td>${new Date(st.created_at).toLocaleString("vi-VN")}</td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Lịch sử trạng thái cho đơn vừa tạo (localStorage): chỉ 1 dòng "Chờ xác nhận"
 */
function renderStatusHistoryLocal() {
  const tbody = document.getElementById("order-status-history-body");
  if (!tbody) return;

  const statusKey = "pending";
  const label = STATUS_LABELS[statusKey] || "Chờ xác nhận";
  const badgeClass =
    STATUS_BADGE_CLASS[statusKey] || "text-bg-secondary";

  tbody.innerHTML = `
    <tr>
      <td><span class="badge ${badgeClass}">${label}</span></td>
      <td>Đơn hàng vừa được tạo thành công.</td>
      <td>${new Date().toLocaleString("vi-VN")}</td>
    </tr>
  `;
}
