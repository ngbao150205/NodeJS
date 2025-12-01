<?php
// admin-discounts.php
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
<title>Admin – Quản lý mã giảm giá</title>
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
      <a href="admin-discounts.php" class="btn btn-sm btn-outline-secondary">Mã giảm giá</a>
      <a href="logout.php" class="btn btn-sm btn-outline-danger">Đăng xuất</a>
    </div>
  </div>
</nav>

<div class="container py-4">

  <div class="d-flex justify-content-between align-items-center mb-3">
    <div>
      <h2 class="section-title">Quản lý mã giảm giá</h2>
      <div class="text-muted">Xem và tạo các mã giảm giá, theo dõi số lần sử dụng và các đơn đã áp dụng.</div>
    </div>

    <button class="btn btn-brand" onclick="openCreateModal()">+ Tạo mã giảm giá</button>
  </div>

  <!-- BỘ LỌC -->
  <div class="card card-lite mb-3">
    <div class="card-body">
      <div class="row g-3 align-items-end">
        <div class="col-md-4">
          <label class="form-label small">Tìm theo mã giảm giá</label>
          <input id="filterKeyword" class="form-control" placeholder="Ví dụ: SALE1...">
        </div>
        <div class="col-md-4 d-flex gap-2">
          <button class="btn btn-brand flex-grow-1" onclick="applyFilter()">Lọc</button>
          <button class="btn btn-outline-secondary" onclick="resetFilter()">Đặt lại</button>
        </div>
      </div>
    </div>
  </div>

  <!-- DANH SÁCH MÃ GIẢM GIÁ -->
  <div class="card card-lite p-3">
    <div class="table-responsive">
      <table class="table table-hover align-middle mb-0">
        <thead class="table-light">
          <tr>
            <th style="width:70px;">ID</th>
            <th style="width:100px;">Mã</th>
            <th style="width:120px;">Giảm (%)</th>
            <th style="width:130px;">Giới hạn (lượt)</th>
            <th style="width:120px;">Đã dùng</th>
            <th style="width:120px;">Còn lại</th>
            <th style="width:200px;">Ngày tạo</th>
            <th class="text-end" style="width:150px;">Hành động</th>
          </tr>
        </thead>
        <tbody id="discountTable">
          <tr><td colspan="8" class="text-center p-4 text-muted">Đang tải...</td></tr>
        </tbody>
      </table>
    </div>

    <!-- PHÂN TRANG -->
    <nav class="mt-3">
      <ul class="pagination justify-content-end" id="pagination"></ul>
    </nav>
  </div>
</div>

<!-- ============ MODAL TẠO MÃ GIẢM GIÁ ============ -->
<div class="modal fade" id="createDiscountModal">
  <div class="modal-dialog">
    <div class="modal-content card-lite">
      <div class="modal-header">
        <h5 class="modal-title">Tạo mã giảm giá mới</h5>
        <button class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body">
        <div class="mb-3">
          <label class="form-label">Mã giảm giá (tối đa 5 ký tự)</label>
          <input id="code" class="form-control" maxlength="5" placeholder="VD: SALE1"
                 oninput="this.value=this.value.toUpperCase();">
          <small class="text-muted">Chỉ chữ và số, không dấu, tối đa 5 ký tự.</small>
        </div>
        <div class="mb-3">
          <label class="form-label">Giảm (%)</label>
          <input id="percent_off" type="number" min="1" max="100" class="form-control" placeholder="VD: 10">
          <small class="text-muted">Giảm theo phần trăm từ 1 đến 100.</small>
        </div>
        <div class="mb-3">
          <label class="form-label">Số lượt sử dụng tối đa</label>
          <input id="max_uses" type="number" min="1" class="form-control" placeholder="VD: 10" value="10">
          <small class="text-muted">Nếu để trống hoặc nhập không hợp lệ, hệ thống sẽ mặc định là 10.</small>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-bs-dismiss="modal">Huỷ</button>
        <button class="btn btn-brand" onclick="saveDiscount()">Lưu</button>
      </div>
    </div>
  </div>
</div>

<!-- ============ MODAL CHI TIẾT MÃ + ĐƠN HÀNG ============ -->
<div class="modal fade" id="detailDiscountModal">
  <div class="modal-dialog modal-xl modal-dialog-scrollable">
    <div class="modal-content card-lite">
      <div class="modal-header">
        <h5 class="modal-title" id="detailModalTitle">Chi tiết mã giảm giá</h5>
        <button class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body">
        <input type="hidden" id="detailId">

        <div class="row g-3 mb-3">
          <div class="col-md-4">
            <div><strong>ID:</strong> <span id="detailIdText"></span></div>
            <div><strong>Mã:</strong> <span id="detailCode"></span></div>
          </div>
          <div class="col-md-4">
            <div><strong>Giảm (%):</strong> <span id="detailPercent"></span></div>
            <div><strong>Ngày tạo:</strong> <span id="detailCreatedAt"></span></div>
          </div>
          <div class="col-md-4">
            <div><strong>Giới hạn lượt:</strong> <span id="detailMaxUses"></span></div>
            <div><strong>Đã dùng:</strong> <span id="detailUsedCount"></span></div>
            <div><strong>Còn lại:</strong> <span id="detailRemaining"></span></div>
          </div>
        </div>

        <hr>

        <h6 class="mb-2">Danh sách đơn hàng đã áp dụng mã giảm giá</h6>
        <div class="table-responsive">
          <table class="table table-sm table-striped align-middle mb-0">
            <thead>
              <tr>
                <th style="width:80px;">Mã ĐH</th>
                <th>Khách hàng</th>
                <th style="width:120px;">SĐT</th>
                <th style="width:130px;">Tổng tiền</th>
                <th style="width:130px;">Giảm giá</th>
                <th style="width:150px;">Trạng thái</th>
                <th style="width:180px;">Ngày tạo</th>
              </tr>
            </thead>
            <tbody id="detailOrdersBody">
              <tr><td colspan="7" class="text-center text-muted">Đang tải...</td></tr>
            </tbody>
          </table>
        </div>

      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-bs-dismiss="modal">Đóng</button>
      </div>
    </div>
  </div>
</div>

<!-- JS -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<script>
const API_DISCOUNTS = "http://localhost:8080/api/admin/discount-codes";
const TOKEN         = <?= json_encode($token ?: '') ?>;

let currentPage     = 1;
let totalPages      = 1;
const LIMIT         = 20;

let currentKeyword  = "";

let createModal  = null;
let detailModal  = null;

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

// ============ LOAD DANH SÁCH MÃ ============
async function loadDiscounts(page = 1) {
  currentPage = page;

  const params = new URLSearchParams({
    page: page,
    limit: LIMIT
  });
  if (currentKeyword) params.append('q', currentKeyword);

  const res = await fetch(API_DISCOUNTS + "?" + params.toString(), {
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
    console.error("Invalid JSON from /admin/discount-codes", e);
  }

  const tb    = document.getElementById("discountTable");
  const items = data.items || [];

  if (!items.length) {
    tb.innerHTML = '<tr><td colspan="8" class="text-center p-4 text-muted">Không có mã giảm giá nào.</td></tr>';
  } else {
    tb.innerHTML = items.map(d => {
      const remaining = Math.max((d.max_uses || 0) - (d.used_count || 0), 0);
      const remBadge  = remaining <= 0
        ? '<span class="badge bg-danger">Hết lượt</span>'
        : remaining <= 2
          ? '<span class="badge bg-warning text-dark">' + remaining + '</span>'
          : '<span class="badge bg-success">' + remaining + '</span>';

      return `
        <tr>
          <td>${d.id}</td>
          <td><span class="fw-bold">${d.code}</span></td>
          <td>${d.percent_off}%</td>
          <td>${d.max_uses}</td>
          <td>${d.used_count}</td>
          <td>${remBadge}</td>
          <td>${formatDate(d.created_at)}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary" onclick="openDetailModal(${d.id})">
              Chi tiết / Đơn hàng
            </button>
          </td>
        </tr>
      `;
    }).join("");
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
      btn.onclick = () => loadDiscounts(page);
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
  loadDiscounts(1);
}

function resetFilter() {
  document.getElementById('filterKeyword').value = "";
  currentKeyword = "";
  loadDiscounts(1);
}

// ============ MODAL TẠO MỚI ============
function openCreateModal() {
  document.getElementById('code').value        = "";
  document.getElementById('percent_off').value = "";
  document.getElementById('max_uses').value    = "10"; // mặc định 10
  createModal.show();
}

async function saveDiscount() {
  const code        = document.getElementById('code').value.trim().toUpperCase();
  const percent_str = document.getElementById('percent_off').value.trim();
  let   max_uses_str= document.getElementById('max_uses').value.trim();

  if (!code || !percent_str) {
    alert("Vui lòng nhập đầy đủ Mã và phần trăm giảm.");
    return;
  }

  // nếu để trống thì dùng mặc định "10"
  if (!max_uses_str) {
    max_uses_str = "10";
  }

  const percent  = parseInt(percent_str, 10);
  const max_uses = parseInt(max_uses_str, 10);

  if (code.length > 5) {
    alert("Mã giảm giá tối đa 5 ký tự.");
    return;
  }
  if (isNaN(percent) || percent < 1 || percent > 100) {
    alert("Giá trị giảm phải từ 1 đến 100 (%).");
    return;
  }
  if (isNaN(max_uses) || max_uses < 1) {
    alert("Số lượt sử dụng tối đa phải >= 1.");
    return;
  }

  const payload = { code, percent_off: percent, max_uses };

  const res = await fetch(API_DISCOUNTS, {
    method: "POST",
    headers: authHeader(),
    body: JSON.stringify(payload)
  });

  let body = {};
  try { body = await res.json(); } catch(e) {}

  if (!res.ok) {
    alert("Tạo mã giảm giá thất bại: " + (body.message || res.status));
    return;
  }

  createModal.hide();
  loadDiscounts(currentPage);
}

// ============ MODAL CHI TIẾT + ĐƠN HÀNG ============
async function openDetailModal(id) {
  const res = await fetch(API_DISCOUNTS + "/" + id, {
    headers: { "Authorization": "Bearer " + TOKEN }
  });

  if (!res.ok) {
    alert("Không tải được thông tin mã giảm giá #" + id);
    return;
  }

  let data = {};
  try {
    data = await res.json();
  } catch (e) {
    console.error("Invalid JSON /admin/discount-codes/:id", e);
  }

  const d = data.discount || {};
  const orders = data.orders || [];

  const remaining = Math.max((d.max_uses || 0) - (d.used_count || 0), 0);

  document.getElementById('detailId').value            = d.id;
  document.getElementById('detailIdText').textContent  = d.id;
  document.getElementById('detailCode').textContent    = d.code;
  document.getElementById('detailPercent').textContent = d.percent_off + '%';
  document.getElementById('detailCreatedAt').textContent = formatDate(d.created_at);
  document.getElementById('detailMaxUses').textContent   = d.max_uses;
  document.getElementById('detailUsedCount').textContent = d.used_count;
  document.getElementById('detailRemaining').textContent = remaining;

  const tbody = document.getElementById('detailOrdersBody');
  if (!orders.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Chưa có đơn hàng nào sử dụng mã này.</td></tr>';
  } else {
    tbody.innerHTML = orders.map(o => {
      const statusText = (() => {
        switch (o.status) {
          case 'pending':    return 'Đang chờ xử lý';
          case 'confirmed':  return 'Đã xác nhận';
          case 'processing': return 'Đang xử lý';
          case 'shipping':   return 'Đang giao hàng';
          case 'completed':  return 'Hoàn thành';
          case 'cancelled':  return 'Đã huỷ';
          default:           return o.status || 'Không rõ';
        }
      })();

      let badgeCls = 'bg-secondary';
      switch (o.status) {
        case 'pending':    badgeCls = 'bg-warning text-dark'; break;
        case 'confirmed':  badgeCls = 'bg-info'; break;
        case 'processing': badgeCls = 'bg-primary'; break;
        case 'shipping':   badgeCls = 'bg-primary'; break;
        case 'completed':  badgeCls = 'bg-success'; break;
        case 'cancelled':  badgeCls = 'bg-danger'; break;
      }

      return `
        <tr>
          <td>#${o.id}</td>
          <td>
            <div>${o.full_name || '—'}</div>
            <div class="small text-muted">${o.email}</div>
          </td>
          <td>${o.phone || '—'}</td>
          <td>${formatVND(o.total_amount)}</td>
          <td>
            Giảm mã: ${formatVND(o.discount_amount)}<br>
            Giảm điểm: ${formatVND(o.point_discount)}
          </td>
          <td><span class="badge ${badgeCls}">${statusText}</span></td>
          <td>${formatDate(o.created_at)}</td>
        </tr>
      `;
    }).join("");
  }

  detailModal.show();
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
  if (!TOKEN) {
    alert("Thiếu token đăng nhập admin. Vui lòng đăng nhập lại.");
    window.location.href = "login.php";
    return;
  }

  createModal = new bootstrap.Modal(document.getElementById('createDiscountModal'));
  detailModal = new bootstrap.Modal(document.getElementById('detailDiscountModal'));

  loadDiscounts(1);
});
</script>
</body>
</html>
