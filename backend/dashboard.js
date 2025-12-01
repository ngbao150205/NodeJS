// public/admin/dashboard.js

let chartRevenue = null;
let chartOrders = null;

document.addEventListener("DOMContentLoaded", () => {
  // Giả sử admin-common.js đã kiểm tra role admin rồi.
  loadOverview();
  initAdvancedFilterForm();
  loadAdvanced();
});

/* ============ DASHBOARD ĐƠN GIẢN ============ */

async function loadOverview() {
  try {
    const res = await fetch("/api/admin/dashboard/overview");
    if (!res.ok) throw new Error("Không thể tải overview admin");
    const data = await res.json();

    const ov = data.overview || {};
    const best = data.bestSellers || [];

    setText("kpi-total-users", ov.totalUsers || 0);
    setText("kpi-new-users-30d", ov.newUsers30d || 0);
    setText("kpi-total-orders", ov.totalOrders || 0);
    setText("kpi-total-revenue", formatPrice(ov.totalRevenue || 0));
    setText("kpi-revenue-30d", formatPrice(ov.revenue30d || 0));

    renderOrdersByStatus(ov.ordersByStatus || []);
    renderBestSellers(best);
  } catch (err) {
    console.error("Lỗi loadOverview:", err);
  }
}

function renderOrdersByStatus(list) {
  const ul = document.getElementById("kpi-orders-by-status");
  if (!ul) return;

  if (!list.length) {
    ul.innerHTML = `<li class="text-muted">Chưa có đơn hàng.</li>`;
    return;
  }

  const labelMap = {
    pending: "Chờ xác nhận",
    confirmed: "Đã xác nhận",
    shipping: "Đang giao",
    completed: "Hoàn tất",
    cancelled: "Đã hủy",
  };

  ul.innerHTML = "";
  list.forEach((st) => {
    const li = document.createElement("li");
    li.textContent = `${labelMap[st.status] || st.status}: ${st.count}`;
    ul.appendChild(li);
  });
}

function renderBestSellers(list) {
  const tbody = document.getElementById("admin-best-sellers-body");
  if (!tbody) return;

  if (!list.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" class="text-center text-muted">
          Chưa có dữ liệu bán hàng.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = "";
  list.forEach((p) => {
    const tr = document.createElement("tr");
    const link = `/product-detail.html?id=${p.productId}`;
    tr.innerHTML = `
      <td>
        <a href="${link}" target="_blank">${escapeHtml(p.name || "Sản phẩm")}</a>
      </td>
      <td class="text-center">${p.qtySold}</td>
      <td class="text-end">${formatPrice(p.revenue)}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* ============ DASHBOARD NÂNG CAO ============ */

function initAdvancedFilterForm() {
  const form = document.getElementById("advanced-filter-form");
  const startInput = document.getElementById("adv-start-date");
  const endInput = document.getElementById("adv-end-date");

  const now = new Date();
  const year = now.getFullYear();

  if (startInput && !startInput.value) {
    startInput.value = `${year}-01-01`;
  }
  if (endInput && !endInput.value) {
    endInput.value = `${year}-12-31`;
  }

  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    loadAdvanced();
  });
}

async function loadAdvanced() {
  const msgEl = document.getElementById("adv-filter-message");
  const groupSelect = document.getElementById("adv-group-by");
  const startInput = document.getElementById("adv-start-date");
  const endInput = document.getElementById("adv-end-date");

  const groupBy = groupSelect ? groupSelect.value || "month" : "month";
  const startDate = startInput?.value || "";
  const endDate = endInput?.value || "";

  if (msgEl) {
    msgEl.className = "small text-muted mt-1";
    msgEl.textContent = "Đang tải dữ liệu thống kê...";
  }

  try {
    const params = new URLSearchParams();
    params.set("groupBy", groupBy);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);

    const res = await fetch(`/api/admin/dashboard/advanced?${params.toString()}`);
    if (!res.ok) throw new Error("Không thể tải advanced dashboard");
    const data = await res.json();

    const series = data.series || [];
    const totals = data.totals || {};

    renderAdvancedTotals(totals);
    renderAdvancedTable(series);
    renderAdvancedCharts(series);

    if (msgEl) {
      msgEl.className = "small text-muted mt-1";
      msgEl.textContent = `Hiển thị dữ liệu từ ${data.filter.startDate} đến ${data.filter.endDate}, nhóm theo ${data.filter.groupBy}.`;
    }
  } catch (err) {
    console.error("Lỗi loadAdvanced:", err);
    if (msgEl) {
      msgEl.className = "small text-danger mt-1";
      msgEl.textContent = "Không thể tải dữ liệu thống kê. Vui lòng thử lại.";
    }
  }
}

function renderAdvancedTotals(t) {
  setText("adv-total-orders", t.orderCount || 0);
  setText("adv-total-revenue", formatPrice(t.revenue || 0));
  setText("adv-total-profit", formatPrice(t.profit || 0));
  setText("adv-total-products", t.distinctProducts || 0);
  setText("adv-total-categories", t.distinctCategories || 0);
  setText("adv-total-items", t.itemsSold || 0);
}

function renderAdvancedTable(series) {
  const tbody = document.getElementById("adv-table-body");
  if (!tbody) return;

  if (!series.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted">
          Không có dữ liệu cho khoảng thời gian đã chọn.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = "";
  series.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(row.label)}</td>
      <td class="text-center">${row.orderCount}</td>
      <td class="text-end">${formatPrice(row.revenue)}</td>
      <td class="text-end">${formatPrice(row.profit)}</td>
      <td class="text-center">${row.itemsSold}</td>
      <td class="text-center">${row.distinctProducts}</td>
      <td class="text-center">${row.distinctCategories}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderAdvancedCharts(series) {
  const labels = series.map((s) => s.label);
  const revenues = series.map((s) => s.revenue);
  const profits = series.map((s) => s.profit);
  const orders = series.map((s) => s.orderCount);
  const items = series.map((s) => s.itemsSold);

  // Chart doanh thu & profit
  const ctxRev = document.getElementById("chart-revenue");
  if (ctxRev) {
    if (chartRevenue) chartRevenue.destroy();
    chartRevenue = new Chart(ctxRev, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Doanh thu",
            data: revenues,
          },
          {
            label: '"Lợi nhuận"',
            data: profits,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        scales: {
          y: {
            ticks: {
              callback: (value) => formatShortCurrency(value),
            },
          },
        },
      },
    });
  }

  // Chart số đơn & số lượng sản phẩm bán
  const ctxOrders = document.getElementById("chart-orders");
  if (ctxOrders) {
    if (chartOrders) chartOrders.destroy();
    chartOrders = new Chart(ctxOrders, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Số đơn",
            data: orders,
          },
          {
            label: "SL sản phẩm",
            data: items,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        scales: {
          y: {
            beginAtZero: true,
          },
        },
      },
    });
  }
}

/* ============ Helpers ============ */

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function formatPrice(price) {
  const n = Number(price) || 0;
  return n.toLocaleString("vi-VN") + "₫";
}

function formatShortCurrency(v) {
  const n = Number(v) || 0;
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "k";
  return n.toString();
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
