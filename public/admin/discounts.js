// public/admin/discounts.js

let discountPage = 1;
const discountPerPage = 10;
let filterQ = "";

document.addEventListener("DOMContentLoaded", () => {
  initDiscountFilterForm();
  initCreateDiscountForm();
  loadDiscounts();
});

function initDiscountFilterForm() {
  const form = document.getElementById("discount-filter-form");
  const qInput = document.getElementById("discount-filter-q");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    filterQ = (qInput.value || "").trim();
    discountPage = 1;
    loadDiscounts();
  });
}

async function loadDiscounts() {
  const tbody = document.getElementById("discounts-tbody");
  const paginationEl = document.getElementById("discounts-pagination");

  if (tbody) {
    tbody.innerHTML =
      '<tr><td colspan="8" class="text-center text-muted small py-3">Đang tải danh sách mã giảm giá...</td></tr>';
  }
  if (paginationEl) {
    paginationEl.innerHTML = "";
  }

  const params = new URLSearchParams();
  params.set("page", discountPage);
  params.set("limit", discountPerPage);
  if (filterQ) params.set("q", filterQ);

  try {
    const res = await fetch(`/api/admin/discounts?${params.toString()}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "Không thể tải danh sách mã giảm giá.");
    }

    renderDiscountsTable(data.discounts || []);
    renderDiscountsPagination(
      data.pagination || { totalPages: 1, currentPage: discountPage }
    );
  } catch (err) {
    console.error("Lỗi loadDiscounts:", err);
    if (tbody) {
      tbody.innerHTML =
        '<tr><td colspan="8" class="text-center text-danger small py-3">Lỗi tải danh sách mã giảm giá.</td></tr>';
    }
  }
}

function renderDiscountsTable(discounts) {
  const tbody = document.getElementById("discounts-tbody");
  if (!tbody) return;

  if (!discounts || discounts.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="8" class="text-center text-muted small py-3">Chưa có mã giảm giá nào.</td></tr>';
    return;
  }

  tbody.innerHTML = "";

  discounts.forEach((d) => {
    const tr = document.createElement("tr");

    const codeRaw = d.code || "";
    const createdText = formatDateTime(d.created_at);
    const used = d.used_count || 0;
    const effectiveMax =
      d.effective_max_uses != null
        ? d.effective_max_uses
        : Math.min(d.max_uses || 0, 10);
    const remaining =
      d.remaining_uses != null
        ? d.remaining_uses
        : Math.max(effectiveMax - used, 0);
    const maxDb = d.max_uses || 0;
    const ordersCount = d.orders_count || 0;

    const exhausted = effectiveMax > 0 && used >= effectiveMax;

    let usedDisplay = `${used} / ${effectiveMax}`;
    if (effectiveMax === 0) {
      usedDisplay = `${used} / 0`;
    }

    const badgeStatus = exhausted
      ? '<span class="badge bg-danger ms-1">Hết lượt</span>'
      : remaining <= 2 && effectiveMax > 0
      ? '<span class="badge bg-warning text-dark ms-1">Sắp hết lượt</span>'
      : "";

    const maxNote =
      maxDb > 10
        ? '<div class="text-muted small">* Server chỉ cho phép tối đa hiệu lực 10 lượt.</div>'
        : "";

    tr.innerHTML = `
      <td>${d.id}</td>
      <td><code>${escapeHtml(codeRaw)}</code></td>
      <td>${d.percent_off || 0}%</td>
      <td>
        ${usedDisplay}
        ${badgeStatus}
      </td>
      <td>
        ${maxDb}
        ${maxNote}
      </td>
      <td>${ordersCount}</td>
      <td>${createdText}</td>
      <td class="text-end">
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary btn-view-discount-orders"
          data-id="${d.id}"
          data-code="${codeRaw}"
          ${ordersCount === 0 ? "disabled" : ""}
        >
          Đơn áp dụng
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".btn-view-discount-orders").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const code = btn.getAttribute("data-code");
      if (id) {
        openDiscountOrdersModal(id, code);
      }
    });
  });
}

function renderDiscountsPagination(pagination) {
  const paginationEl = document.getElementById("discounts-pagination");
  if (!paginationEl) return;

  const totalPages = Math.max(1, pagination.totalPages || 1);
  const page = pagination.currentPage || 1;

  paginationEl.innerHTML = "";

  const addBtn = (p, label, disabled, active) => {
    const li = document.createElement("li");
    li.className =
      "page-item" + (disabled ? " disabled" : "") + (active ? " active" : "");
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
      if (!p || p === discountPage || p < 1 || p > totalPages) return;
      discountPage = p;
      loadDiscounts();
    });
  });
}

/* ========== TẠO MÃ GIẢM GIÁ ========== */

function initCreateDiscountForm() {
  const form = document.getElementById("discount-create-form");
  const codeInput = document.getElementById("discount-code");
  const percentInput = document.getElementById("discount-percent");
  const maxUsesInput = document.getElementById("discount-max-uses");
  const msgEl = document.getElementById("discount-create-message");

  if (!form) return;

  // nút random code
  const btnGen = document.getElementById("btn-generate-discount-code");
  if (btnGen && codeInput) {
    btnGen.addEventListener("click", () => {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let c = "";
      for (let i = 0; i < 5; i++) {
        c += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      codeInput.value = c;
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (msgEl) {
      msgEl.textContent = "";
      msgEl.className = "small text-muted";
    }

    const code = (codeInput.value || "").trim().toUpperCase();
    const percent = (percentInput.value || "").trim();
    const maxUses = (maxUsesInput.value || "").trim();

    if (!code || !percent || !maxUses) {
      if (msgEl) {
        msgEl.textContent =
          "Vui lòng nhập đầy đủ mã, phần trăm giảm và số lượt tối đa.";
        msgEl.className = "small text-danger";
      }
      return;
    }

    if (!/^[A-Z0-9]{5}$/.test(code)) {
      if (msgEl) {
        msgEl.textContent =
          "Mã giảm giá phải gồm đúng 5 ký tự chữ và số (A-Z, 0-9).";
        msgEl.className = "small text-danger";
      }
      return;
    }

    const percentNum = parseInt(percent, 10);
    if (Number.isNaN(percentNum) || percentNum <= 0 || percentNum > 100) {
      if (msgEl) {
        msgEl.textContent = "Phần trăm giảm phải là số nguyên từ 1 đến 100.";
        msgEl.className = "small text-danger";
      }
      return;
    }

    const maxUsesNum = parseInt(maxUses, 10);
    if (Number.isNaN(maxUsesNum) || maxUsesNum <= 0) {
      if (msgEl) {
        msgEl.textContent = "Số lượt tối đa phải là số nguyên dương.";
        msgEl.className = "small text-danger";
      }
      return;
    }

    try {
      const res = await fetch("/api/admin/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          percent_off: percentNum,
          max_uses: maxUsesNum,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Không thể tạo mã giảm giá.");
      }

      if (msgEl) {
        msgEl.textContent = "Đã tạo mã giảm giá thành công.";
        msgEl.className = "small text-success";
      }

      // reset form (giữ lại code cho dễ copy)
      form.reset();
      if (codeInput) codeInput.value = code;

      await loadDiscounts();
    } catch (err) {
      console.error("Lỗi tạo mã giảm giá:", err);
      if (msgEl) {
        msgEl.textContent =
          err.message || "Có lỗi xảy ra khi tạo mã giảm giá.";
        msgEl.className = "small text-danger";
      }
    }
  });
}

/* ========== MODAL ĐƠN HÀNG DÙNG MÃ ========== */

async function openDiscountOrdersModal(discountId, code) {
  const titleEl = document.getElementById("discount-orders-modal-title");
  const infoEl = document.getElementById("discount-orders-modal-info");
  const msgEl = document.getElementById("discount-orders-modal-message");
  const tbody = document.getElementById("discount-orders-tbody");

  if (titleEl) {
    titleEl.textContent = `Đơn hàng đã áp dụng mã ${code}`;
  }
  if (infoEl) infoEl.innerHTML = "";
  if (msgEl) {
    msgEl.className = "small text-muted mb-2";
    msgEl.textContent = "Đang tải danh sách đơn hàng...";
  }
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center small text-muted py-2">
          Đang tải...
        </td>
      </tr>
    `;
  }

  try {
    const res = await fetch(`/api/admin/discounts/${discountId}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "Không thể tải chi tiết mã giảm giá.");
    }

    const dc = data.discount;
    const orders = data.orders || [];

    if (infoEl && dc) {
      const effectiveMax =
        dc.effective_max_uses != null
          ? dc.effective_max_uses
          : Math.min(dc.max_uses || 0, 10);
      const used = dc.used_count || 0;
      const remaining =
        dc.remaining_uses != null
          ? dc.remaining_uses
          : Math.max(effectiveMax - used, 0);

      infoEl.innerHTML = `
        <div class="small">
          <strong>Mã:</strong> <code>${escapeHtml(dc.code)}</code> –
          <strong>Giảm:</strong> ${dc.percent_off}% –
          <strong>Đã dùng:</strong> ${used} / ${effectiveMax}
          (${remaining} lượt còn lại)
        </div>
      `;
    }

    if (msgEl) {
      msgEl.className = "small text-muted mb-2";
      msgEl.textContent =
        orders.length > 0
          ? `Có ${orders.length} đơn hàng đã sử dụng mã này.`
          : "Chưa có đơn hàng nào sử dụng mã này.";
    }

    renderDiscountOrdersTable(orders);
  } catch (err) {
    console.error("Lỗi load đơn hàng dùng mã giảm:", err);
    if (msgEl) {
      msgEl.className = "small text-danger mb-2";
      msgEl.textContent =
        err.message || "Không thể tải danh sách đơn hàng sử dụng mã này.";
    }
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center small text-muted py-2">
            Có lỗi xảy ra khi tải dữ liệu.
          </td>
        </tr>
      `;
    }
  }

  const modalEl = document.getElementById("discountOrdersModal");
  if (modalEl && window.bootstrap) {
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  }
}

function renderDiscountOrdersTable(orders) {
  const tbody = document.getElementById("discount-orders-tbody");
  if (!tbody) return;

  if (!orders || orders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center small text-muted py-2">
          Chưa có đơn hàng nào sử dụng mã này.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = "";

  orders.forEach((o) => {
    const tr = document.createElement("tr");
    const createdText = formatDateTime(o.created_at);
    const totalText = formatPrice(o.total_amount);

    tr.innerHTML = `
      <td>#${o.id}</td>
      <td>${escapeHtml(o.full_name || "")}<br/>
          <small class="text-muted">${escapeHtml(o.email || "")}</small>
      </td>
      <td>${escapeHtml(o.status || "")}</td>
      <td>${createdText}</td>
      <td class="text-end">${totalText}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* ========== HELPERS ========== */

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

function formatPrice(num) {
  const n = Number(num) || 0;
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
