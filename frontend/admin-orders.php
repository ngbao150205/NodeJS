<?php
// admin-orders.php
ini_set('display_errors',1);
ini_set('display_startup_errors',1);
error_reporting(E_ALL);

session_start();
require __DIR__.'/lib/api.php';

$apiBase = 'http://localhost:8080/api';

// ====== KIỂM TRA ADMIN ======
$isAuth = false;
$authRole = '';
$authName = '';
$token = get_token();
$me    = null;

try {
    if ($token) {
        [$code, $me] = api_call('GET', "$apiBase/auth/me", null, true);
        if ($code === 200 && !empty($me['user'])) {
            $isAuth   = true;
            $authRole = $me['user']['role'] ?? '';
            $authName = $me['user']['full_name'] ?? ($me['user']['email'] ?? '');
        }
    }
} catch(Exception $e) {
    // ignore
}

if (!$isAuth || $authRole !== 'admin') {
    header("Location: login.php");
    exit;
}
?>
<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>Admin – Quản lý đơn hàng</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">

<style>
  :root{
    --brand:#0ea5e9;
    --brand-600:#0284c7;
  }
  body{
    background: radial-gradient(circle at 20% -10%, #eef7ff, transparent 40%),
                radial-gradient(circle at 100% 0, #f8f5ff, transparent 35%),
                #f7fafc;
    color:#1f2937;
  }
  .navbar{
    background:#ffffff !important;
    border-bottom:1px solid #e5e7eb;
  }
  .section-title{
    font-size:1.35rem; font-weight:700
  }
  .card-lite{
    background:#fff;
    border:1px solid #e5e7eb;
    box-shadow:0 6px 14px rgba(0,0,0,.04);
    border-radius:.75rem;
  }
  .btn-brand{
    background:var(--brand);
    border-color:var(--brand);
    color:#fff;
  }
  .btn-brand:hover{
    background:var(--brand-600);
    border-color:var(--brand-600);
  }
</style>
</head>

<body>
<nav class="navbar navbar-expand-lg sticky-top">
  <div class="container">
    <a class="navbar-brand fw-bold" style="color:var(--brand)" href="index.php">
      E-Store<span class="text-dark">.PC</span>
    </a>
    <div class="d-flex gap-3 align-items-center">
      <span class="small text-muted">Admin: <?= htmlspecialchars($authName) ?></span>
      <a href="admin-dashboard.php" class="btn btn-sm btn-outline-primary">Dashboard</a>
      <a href="admin-products.php" class="btn btn-sm btn-outline-secondary">Sản phẩm</a>
      <a href="admin-users.php" class="btn btn-sm btn-outline-secondary">Người dùng</a>
      <a href="admin-orders.php" class="btn btn-sm btn-outline-secondary">Đơn hàng</a>
      <a href="logout.php" class="btn btn-sm btn-outline-danger">Đăng xuất</a>
    </div>
  </div>
</nav>

<div class="container py-4">

  <div class="d-flex justify-content-between align-items-center mb-3">
    <div>
      <h2 class="section-title">Quản lý đơn hàng</h2>
      <div class="text-muted">Xem, lọc theo thời gian và cập nhật trạng thái đơn hàng.</div>
    </div>
  </div>

  <!-- BỘ LỌC -->
  <div class="card card-lite mb-3">
    <div class="card-body">
      <div class="row g-3 align-items-end">
        <div class="col-md-4">
          <label class="form-label small">Từ khóa (email / khách hàng / người nhận / SĐT)</label>
          <input id="filterKeyword" class="form-control" placeholder="Nhập từ khoá...">
        </div>
        <div class="col-md-3">
          <label class="form-label small">Trạng thái</label>
          <select id="filterStatus" class="form-select">
            <option value="">Tất cả</option>
            <option value="pending">Đang chờ xử lý</option>
            <option value="confirmed">Đã xác nhận</option>
            <option value="processing">Đang xử lý</option>
            <option value="shipping">Đang giao hàng</option>
            <option value="completed">Hoàn thành</option>
            <option value="cancelled">Đã huỷ</option>
          </select>
        </div>
        <div class="col-md-3">
          <label class="form-label small">Khoảng thời gian</label>
          <select id="filterTime" class="form-select" onchange="onTimeFilterChange()">
            <option value="">Tất cả</option>
            <option value="today">Hôm nay</option>
            <option value="yesterday">Hôm qua</option>
            <option value="this_week">Tuần này</option>
            <option value="this_month">Tháng này</option>
            <option value="range">Khoảng thời gian...</option>
          </select>
        </div>
        <div class="col-md-2 d-flex gap-2">
          <button class="btn btn-brand flex-grow-1" onclick="applyFilter()">Lọc</button>
          <button class="btn btn-outline-secondary" onclick="resetFilter()">Đặt lại</button>
        </div>
      </div>

      <!-- RANGE DATE -->
      <div class="row g-3 mt-2" id="dateRangeRow" style="display:none;">
        <div class="col-md-3">
          <label class="form-label small">Từ ngày</label>
          <input type="date" id="startDate" class="form-control">
        </div>
        <div class="col-md-3">
          <label class="form-label small">Đến ngày</label>
          <input type="date" id="endDate" class="form-control">
        </div>
        <div class="col-md-6 small text-muted d-flex align-items-end">
          Nếu để trống một trong hai, khoảng thời gian sẽ không áp dụng.
        </div>
      </div>
    </div>
  </div>

  <!-- DANH SÁCH ĐƠN HÀNG -->
  <div class="card card-lite p-3">
    <div class="table-responsive">
      <table class="table table-hover align-middle mb-0">
        <thead class="table-light">
          <tr>
            <th style="width:80px;">Mã ĐH</th>
            <th>Khách hàng</th>
            <th>Người nhận</th>
            <th style="width:130px;">SĐT</th>
            <th style="width:140px;">Tổng tiền</th>
            <th style="width:140px;">Giảm giá?</th>
            <th style="width:120px;">Trạng thái</th>
            <th style="width:170px;">Ngày tạo</th>
            <th class="text-end" style="width:150px;">Hành động</th>
          </tr>
        </thead>
        <tbody id="orderTable">
          <tr><td colspan="9" class="text-center p-4 text-muted">Đang tải...</td></tr>
        </tbody>
      </table>
    </div>

    <!-- PHÂN TRANG -->
    <nav class="mt-3">
      <ul class="pagination justify-content-end" id="pagination"></ul>
    </nav>
  </div>
</div>

<!-- ============ MODAL CHI TIẾT ĐƠN HÀNG ============ -->
<div class="modal fade" id="orderModal">
  <div class="modal-dialog modal-xl modal-dialog-scrollable">
    <div class="modal-content card-lite">
      <div class="modal-header">
        <h5 class="modal-title" id="modalTitle">Chi tiết đơn hàng</h5>
        <button class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body">
        <input type="hidden" id="orderId">

        <!-- THÔNG TIN ĐƠN HÀNG -->
        <div class="row g-3">
          <div class="col-md-4">
            <div class="mb-2">
              <strong>Mã đơn hàng:</strong> <span id="orderCode"></span>
            </div>
            <div class="mb-2">
              <strong>Ngày tạo:</strong> <span id="orderCreatedAt"></span>
            </div>
            <div class="mb-2">
              <label class="form-label">Trạng thái</label>
              <select id="order_status" class="form-select">
                <option value="pending">Đang chờ xử lý</option>
                <option value="confirmed">Đã xác nhận</option>
                <option value="processing">Đang xử lý</option>
                <option value="shipping">Đang giao hàng</option>
                <option value="completed">Hoàn thành</option>
                <option value="cancelled">Đã huỷ</option>
              </select>
            </div>
          </div>

          <div class="col-md-4">
            <h6>Khách hàng</h6>
            <div><strong>Tên:</strong> <span id="customerName"></span></div>
            <div><strong>Email:</strong> <span id="customerEmail"></span></div>
            <div><strong>SĐT:</strong> <span id="customerPhone"></span></div>
          </div>

          <div class="col-md-4">
            <h6>Địa chỉ giao hàng</h6>
            <div><strong>Người nhận:</strong> <span id="receiverName"></span></div>
            <div><strong>Địa chỉ:</strong> <span id="addressDetails"></span></div>
            <div><strong>Quận / Huyện:</strong> <span id="district"></span></div>
            <div><strong>Thành phố:</strong> <span id="city"></span></div>
            <div><strong>Mã bưu chính:</strong> <span id="postalCode"></span></div>
          </div>
        </div>

        <hr>

        <!-- SẢN PHẨM -->
        <h6 class="mb-2">Sản phẩm trong đơn</h6>
        <div class="table-responsive">
          <table class="table table-sm table-striped align-middle">
            <thead>
              <tr>
                <th>Tên sản phẩm</th>
                <th style="width:200px;">Biến thể</th>
                <th style="width:120px;">Đơn giá</th>
                <th style="width:80px;">SL</th>
                <th style="width:130px;">Thành tiền</th>
              </tr>
            </thead>
            <tbody id="orderItemsBody">
              <tr><td colspan="5" class="text-center text-muted">Đang tải...</td></tr>
            </tbody>
          </table>
        </div>

        <!-- TỔNG TIỀN -->
        <div class="row mt-3">
          <div class="col-md-6">
            <h6>Ghi chú cập nhật trạng thái</h6>
            <textarea id="status_note" class="form-control" rows="3"
              placeholder="Ví dụ: Khách đã xác nhận qua điện thoại, chuẩn bị giao hàng..."></textarea>
          </div>
          <div class="col-md-6">
            <div class="card border-0 bg-light">
              <div class="card-body">
                <h6 class="card-title">Tổng kết</h6>
                <div class="d-flex justify-content-between">
                  <span>Tạm tính:</span>
                  <strong id="subtotal"></strong>
                </div>
                <div class="d-flex justify-content-between">
                  <span>Thuế:</span>
                  <strong id="tax"></strong>
                </div>
                <div class="d-flex justify-content-between">
                  <span>Phí vận chuyển:</span>
                  <strong id="shipping_fee"></strong>
                </div>
                <div class="d-flex justify-content-between">
                  <span>Giảm giá mã giảm giá:</span>
                  <strong id="discount_amount"></strong>
                </div>
                <div class="d-flex justify-content-between">
                  <span>Giảm do điểm tích luỹ:</span>
                  <strong id="point_discount"></strong>
                </div>
                <div class="d-flex justify-content-between">
                  <span>Mã giảm giá áp dụng:</span>
                  <strong id="coupon_code"></strong>
                </div>
                <hr>
                <div class="d-flex justify-content-between fs-5">
                  <span>Tổng thanh toán:</span>
                  <strong id="total_amount"></strong>
                </div>
                <div class="mt-2 text-muted small">
                  Điểm đã dùng: <span id="loyalty_used"></span> – Điểm cộng thêm: <span id="loyalty_earned"></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <hr>

        <!-- LỊCH SỬ TRẠNG THÁI -->
        <h6 class="mb-2">Lịch sử trạng thái</h6>
        <ul class="list-group small" id="statusHistoryList">
          <li class="list-group-item text-muted">Không có lịch sử trạng thái.</li>
        </ul>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-bs-dismiss="modal">Đóng</button>
        <button class="btn btn-brand" onclick="saveOrder()">Lưu thay đổi</button>
      </div>
    </div>
  </div>
</div>

<!-- JS -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<script>
const API_ORDERS = "http://localhost:8080/api/admin/orders";
const TOKEN      = <?= json_encode($token ?: '') ?>;

let currentPage    = 1;
let totalPages     = 1;
const LIMIT        = 20; // 20 đơn / trang

let currentKeyword = "";
let currentStatus  = "";
let currentTime    = "";
let currentStart   = "";
let currentEnd     = "";

let orderModal = null;

function authHeader() {
  return {
    "Authorization": "Bearer " + TOKEN,
    "Content-Type": "application/json"
  };
}

function formatVND(n) {
  if (n === null || n === undefined) return "—";
  return Number(n).toLocaleString('vi-VN') + "đ";
}

function formatDate(dtStr) {
  if (!dtStr) return "";
  const d = new Date(dtStr);
  if (Number.isNaN(d.getTime())) return dtStr;
  const day   = String(d.getDate()).padStart(2,'0');
  const month = String(d.getMonth()+1).padStart(2,'0');
  const year  = d.getFullYear();
  const h = String(d.getHours()).padStart(2,'0');
  const m = String(d.getMinutes()).padStart(2,'0');
  return `${day}/${month}/${year} ${h}:${m}`;
}

function statusText(status) {
  switch (status) {
    case 'pending':    return 'Đang chờ xử lý';
    case 'confirmed':  return 'Đã xác nhận';
    case 'processing': return 'Đang xử lý';
    case 'shipping':   return 'Đang giao hàng';
    case 'completed':  return 'Hoàn thành';
    case 'cancelled':  return 'Đã huỷ';
    default:           return status || 'Không rõ';
  }
}

function statusBadge(status) {
  let cls = 'bg-secondary';
  switch (status) {
    case 'pending':    cls = 'bg-warning text-dark'; break;
    case 'confirmed':  cls = 'bg-info'; break;
    case 'processing': cls = 'bg-primary'; break;
    case 'shipping':   cls = 'bg-primary'; break;
    case 'completed':  cls = 'bg-success'; break;
    case 'cancelled':  cls = 'bg-danger'; break;
  }
  return `<span class="badge ${cls}">${statusText(status)}</span>`;
}

function discountLabel(order) {
  const hasCoupon  = !!order.coupon_code;
  const hasDisc    = Number(order.discount_amount || 0) > 0;
  const hasPoint   = Number(order.point_discount || 0) > 0;
  if (!hasCoupon && !hasDisc && !hasPoint) return '<span class="badge bg-light text-muted">Không</span>';

  let parts = [];
  if (hasCoupon) parts.push('Mã: ' + order.coupon_code);
  if (hasDisc)   parts.push('Giảm: ' + Number(order.discount_amount).toLocaleString('vi-VN') + 'đ');
  if (hasPoint)  parts.push('Điểm: ' + Number(order.point_discount).toLocaleString('vi-VN') + 'đ');

  return '<span class="badge bg-success text-white">Có</span><br><small class="text-muted">' + parts.join(', ') + '</small>';
}

// ============ BỘ LỌC THỜI GIAN ============
function onTimeFilterChange() {
  const val = document.getElementById('filterTime').value;
  const row = document.getElementById('dateRangeRow');
  if (val === 'range') {
    row.style.display = '';
  } else {
    row.style.display = 'none';
  }
}

// ============ LOAD ORDERS ============
async function loadOrders(page = 1) {
  currentPage = page;

  const params = new URLSearchParams({
    page: page,
    limit: LIMIT
  });
  if (currentKeyword) params.append('q', currentKeyword);
  if (currentStatus)  params.append('status', currentStatus);
  if (currentTime)    params.append('timeFilter', currentTime);
  if (currentTime === 'range' && currentStart && currentEnd) {
    params.append('start_date', currentStart);
    params.append('end_date', currentEnd);
  }

  const res = await fetch(API_ORDERS + "?" + params.toString(), {
    headers: { "Authorization": "Bearer " + TOKEN }
  });

  if (res.status === 401) {
    alert("Phiên đăng nhập hết hạn hoặc không có quyền. Vui lòng đăng nhập lại.");
    window.location.href = "login.php";
    return;
  }

  let data = {};
  try {
    data = await res.json();
  } catch (e) {
    console.error("Invalid JSON from /admin/orders", e);
  }

  const tb    = document.getElementById("orderTable");
  const items = data.items || [];

  if (!items.length) {
    tb.innerHTML = '<tr><td colspan="9" class="text-center p-4 text-muted">Không có đơn hàng nào.</td></tr>';
  } else {
    tb.innerHTML = items.map(o => `
      <tr>
        <td>#${o.id}</td>
        <td>
          <div>${o.full_name || '—'}</div>
          <div class="small text-muted">${o.email}</div>
        </td>
        <td>${o.receiver_name || '—'}</td>
        <td>${o.phone || '—'}</td>
        <td>${formatVND(o.total_amount)}</td>
        <td>${discountLabel(o)}</td>
        <td>${statusBadge(o.status)}</td>
        <td>${formatDate(o.created_at)}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary" onclick="openOrderModal(${o.id})">Xem / Sửa</button>
        </td>
      </tr>
    `).join("");
  }

  totalPages = data.pagination?.totalPages ?? data.totalPages ?? 1;
  renderPagination();
}

// ============ PHÂN TRANG ============
function renderPagination() {
  const ul = document.getElementById('pagination');
  ul.innerHTML = '';

  if (totalPages <= 1) return;

  const createItem = (page, label = null, disabled = false, active = false) => {
    const li = document.createElement('li');
    li.className = 'page-item';
    if (disabled) li.classList.add('disabled');
    if (active)   li.classList.add('active');

    const btn = document.createElement('button');
    btn.className = 'page-link';
    btn.type = 'button';
    btn.textContent = label || page;

    if (!disabled && !active) {
      btn.onclick = () => loadOrders(page);
    }

    li.appendChild(btn);
    return li;
  };

  ul.appendChild(createItem(currentPage - 1, '«', currentPage === 1));

  for (let p = 1; p <= totalPages; p++) {
    ul.appendChild(createItem(p, String(p), false, p === currentPage));
  }

  ul.appendChild(createItem(currentPage + 1, '»', currentPage === totalPages));
}

// ============ BỘ LỌC ============
function applyFilter() {
  currentKeyword = document.getElementById('filterKeyword').value.trim();
  currentStatus  = document.getElementById('filterStatus').value;
  currentTime    = document.getElementById('filterTime').value;
  currentStart   = document.getElementById('startDate').value;
  currentEnd     = document.getElementById('endDate').value;

  loadOrders(1);
}

function resetFilter() {
  document.getElementById('filterKeyword').value = "";
  document.getElementById('filterStatus').value  = "";
  document.getElementById('filterTime').value    = "";
  document.getElementById('startDate').value     = "";
  document.getElementById('endDate').value       = "";
  onTimeFilterChange();

  currentKeyword = "";
  currentStatus  = "";
  currentTime    = "";
  currentStart   = "";
  currentEnd     = "";
  loadOrders(1);
}

// ============ MODAL ============
async function openOrderModal(id) {
  const res = await fetch(API_ORDERS + "/" + id, {
    headers: { "Authorization": "Bearer " + TOKEN }
  });

  if (!res.ok) {
    alert("Không tải được thông tin đơn hàng #" + id);
    return;
  }

  let data = {};
  try {
    data = await res.json();
  } catch (e) {
    console.error("Invalid JSON /admin/orders/:id", e);
  }

  const o   = data.order || {};
  const its = data.items || [];
  const hs  = data.statusHistory || [];

  // Thông tin chung
  document.getElementById('modalTitle').textContent  = "Chi tiết đơn hàng #" + id;
  document.getElementById('orderId').value           = id;
  document.getElementById('orderCode').textContent   = "#" + id;
  document.getElementById('orderCreatedAt').textContent = formatDate(o.created_at);
  document.getElementById('order_status').value      = o.status || "pending";

  // Khách hàng
  document.getElementById('customerName').textContent  = o.full_name || '—';
  document.getElementById('customerEmail').textContent = o.email || '—';
  document.getElementById('customerPhone').textContent = o.phone || '—';

  // Địa chỉ giao hàng
  document.getElementById('receiverName').textContent   = o.receiver_name || '—';
  document.getElementById('addressDetails').textContent = o.address_details || '—';
  document.getElementById('district').textContent       = o.district || '—';
  document.getElementById('city').textContent           = o.city || '—';
  document.getElementById('postalCode').textContent     = o.postal_code || '—';

  // Tổng tiền + giảm giá
  document.getElementById('subtotal').textContent        = formatVND(o.subtotal);
  document.getElementById('tax').textContent             = formatVND(o.tax);
  document.getElementById('shipping_fee').textContent    = formatVND(o.shipping_fee);
  document.getElementById('discount_amount').textContent = formatVND(o.discount_amount);
  document.getElementById('point_discount').textContent  = formatVND(o.point_discount);
  document.getElementById('total_amount').textContent    = formatVND(o.total_amount);
  document.getElementById('coupon_code').textContent     = o.coupon_code || 'Không sử dụng';
  document.getElementById('loyalty_used').textContent    = o.loyalty_points_used ?? 0;
  document.getElementById('loyalty_earned').textContent  = o.loyalty_points_earned ?? 0;

  // Reset note
  document.getElementById('status_note').value = "";

  // Items
  const tbody = document.getElementById('orderItemsBody');
  if (!its.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Không có sản phẩm nào.</td></tr>';
  } else {
    tbody.innerHTML = its.map(it => `
      <tr>
        <td>${it.name}</td>
        <td>${it.variant_label || ''}</td>
        <td>${formatVND(it.unit_price)}</td>
        <td>${it.qty}</td>
        <td>${formatVND(it.line_total)}</td>
      </tr>
    `).join("");
  }

  // Lịch sử trạng thái
  const ul = document.getElementById('statusHistoryList');
  if (!hs.length) {
    ul.innerHTML = '<li class="list-group-item text-muted">Không có lịch sử trạng thái.</li>';
  } else {
    ul.innerHTML = hs.map(h => `
      <li class="list-group-item d-flex justify-content-between">
        <div>
          <div><strong>${statusText(h.status)}</strong></div>
          ${h.note ? `<div class="small text-muted">${h.note}</div>` : ''}
        </div>
        <div class="small text-muted">${formatDate(h.created_at)}</div>
      </li>
    `).join("");
  }

  orderModal.show();
}

async function saveOrder() {
  const id = document.getElementById('orderId').value;
  const payload = {
    status: document.getElementById('order_status').value,
    note:   document.getElementById('status_note').value.trim()
  };

  const res = await fetch(API_ORDERS + "/" + id, {
    method: "PUT",
    headers: authHeader(),
    body: JSON.stringify(payload)
  });

  let body = {};
  try { body = await res.json(); } catch(e) {}

  if (!res.ok) {
    alert("Cập nhật đơn hàng thất bại: " + (body.message || res.status));
    return;
  }

  orderModal.hide();
  loadOrders(currentPage);
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
  if (!TOKEN) {
    alert("Thiếu token đăng nhập admin. Vui lòng đăng nhập lại.");
    window.location.href = "login.php";
    return;
  }

  orderModal = new bootstrap.Modal(document.getElementById('orderModal'));

  loadOrders(1);
});
</script>
</body>
</html>
