<?php
// admin-users.php
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
<title>Admin – Quản lý người dùng</title>
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
      <a href="logout.php" class="btn btn-sm btn-outline-danger">Đăng xuất</a>
    </div>
  </div>
</nav>

<div class="container py-4">

  <div class="d-flex justify-content-between align-items-center mb-3">
    <div>
      <h2 class="section-title">Quản lý người dùng</h2>
      <div class="text-muted">Xem, cập nhật thông tin và cấm / gỡ cấm tài khoản người dùng.</div>
    </div>
  </div>

  <!-- BỘ LỌC -->
  <div class="card card-lite mb-3">
    <div class="card-body">
      <div class="row g-3 align-items-end">
        <div class="col-md-4">
          <label class="form-label small">Tìm kiếm (email / họ tên)</label>
          <input id="filterKeyword" class="form-control" placeholder="Nhập email hoặc họ tên...">
        </div>
        <div class="col-md-3">
          <label class="form-label small">Vai trò</label>
          <select id="filterRole" class="form-select">
            <option value="">Tất cả</option>
            <option value="customer">Khách hàng</option>
            <option value="admin">Quản trị viên</option>
          </select>
        </div>
        <div class="col-md-3">
          <label class="form-label small">Trạng thái</label>
          <select id="filterStatus" class="form-select">
            <option value="">Tất cả</option>
            <option value="active">Hoạt động</option>
            <option value="banned">Bị cấm</option>
          </select>
        </div>
        <div class="col-md-2 d-flex gap-2">
          <button class="btn btn-brand flex-grow-1" onclick="applyFilter()">Lọc</button>
          <button class="btn btn-outline-secondary" onclick="resetFilter()">Đặt lại</button>
        </div>
      </div>
    </div>
  </div>

  <div class="card card-lite p-3">
    <div class="table-responsive">
      <table class="table table-hover align-middle mb-0">
        <thead class="table-light">
          <tr>
            <th style="width:70px;">ID</th>
            <th>Email</th>
            <th>Họ tên</th>
            <th style="width:120px;">Provider</th>
            <th style="width:120px;">Vai trò</th>
            <th style="width:90px;">Điểm</th>
            <th style="width:110px;">Trạng thái</th>
            <th style="width:170px;">Ngày tạo</th>
            <th class="text-end" style="width:210px;">Hành động</th>
          </tr>
        </thead>
        <tbody id="userTable">
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

<!-- ============ MODAL SỬA USER ============ -->
<div class="modal fade" id="userModal">
  <div class="modal-dialog">
    <div class="modal-content card-lite">
      <div class="modal-header">
        <h5 class="modal-title" id="modalTitle">Sửa người dùng</h5>
        <button class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body">
        <input type="hidden" id="userId">

        <div class="mb-3">
          <label class="form-label">Email</label>
          <input id="email" class="form-control" readonly>
        </div>

        <div class="mb-3">
          <label class="form-label">Họ tên</label>
          <input id="full_name" class="form-control">
        </div>

        <div class="row g-2">
          <div class="col-md-6">
            <label class="form-label">Vai trò</label>
            <select id="role" class="form-select">
              <option value="customer">Khách hàng</option>
              <option value="admin">Quản trị viên</option>
            </select>
          </div>
          <div class="col-md-6">
            <label class="form-label">Điểm tích luỹ</label>
            <input type="number" min="0" id="loyalty_points" class="form-control">
          </div>
        </div>

        <div class="mt-3 form-check">
          <input type="checkbox" class="form-check-input" id="is_banned">
          <label class="form-check-label" for="is_banned">Tài khoản bị cấm</label>
        </div>
        <div class="form-text text-muted">
          Nếu được đánh dấu, người dùng sẽ không thể đăng nhập. Bạn không thể cấm tài khoản của chính mình.
        </div>

        <div class="mt-3">
          <label class="form-label">Provider</label>
          <input id="provider" class="form-control" readonly>
        </div>

        <div class="mt-2">
          <label class="form-label">Ngày tạo</label>
          <input id="created_at" class="form-control" readonly>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-bs-dismiss="modal">Huỷ</button>
        <button class="btn btn-brand" onclick="saveUser()">Lưu</button>
      </div>
    </div>
  </div>
</div>

<!-- JS -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<script>
const API_USERS = "http://localhost:8080/api/admin/users";
const TOKEN     = <?= json_encode($token ?: '') ?>;
const SELF_ID   = <?= json_encode($me['user']['id'] ?? null) ?>;

let currentPage = 1;
let totalPages  = 1;
const LIMIT     = 10;

let currentKeyword = "";
let currentRole    = "";
let currentStatus  = "";

let userModal = null;

function authHeader() {
  return {
    "Authorization": "Bearer " + TOKEN,
    "Content-Type": "application/json"
  };
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

function renderStatusBadge(isBanned) {
  if (isBanned) {
    return '<span class="badge bg-danger">Bị cấm</span>';
  }
  return '<span class="badge bg-success">Hoạt động</span>';
}

function renderRoleText(role) {
  if (role === 'admin') return 'Admin';
  return 'Khách hàng';
}

function renderBanButton(u) {
  if (SELF_ID && SELF_ID === u.id) {
    return ''; // không tự cấm mình
  }
  if (u.is_banned) {
    return `<button class="btn btn-sm btn-success ms-1" onclick="unbanUser(${u.id})">Gỡ cấm</button>`;
  } else {
    return `<button class="btn btn-sm btn-danger ms-1" onclick="banUser(${u.id})">Cấm</button>`;
  }
}

// ============ LOAD USERS ============
async function loadUsers(page = 1) {
  currentPage = page;

  const params = new URLSearchParams({
    page: page,
    limit: LIMIT
  });
  if (currentKeyword) params.append('q', currentKeyword);
  if (currentRole)    params.append('role', currentRole);
  if (currentStatus)  params.append('status', currentStatus);

  const res = await fetch(API_USERS + "?" + params.toString(), {
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
    console.error("Invalid JSON from /admin/users", e);
  }

  const tb    = document.getElementById("userTable");
  const items = data.items || [];

  if (!items.length) {
    tb.innerHTML = '<tr><td colspan="9" class="text-center p-4 text-muted">Không có người dùng nào.</td></tr>';
  } else {
    tb.innerHTML = items.map(u => `
      <tr>
        <td>${u.id}</td>
        <td>${u.email}</td>
        <td>${u.full_name}</td>
        <td>${u.provider}</td>
        <td>${renderRoleText(u.role)}</td>
        <td>${u.loyalty_points ?? 0}</td>
        <td>${renderStatusBadge(u.is_banned)}</td>
        <td>${formatDate(u.created_at)}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-warning" onclick="openEditModal(${u.id})">Sửa</button>
          ${renderBanButton(u)}
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
      btn.onclick = () => loadUsers(page);
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
  currentRole    = document.getElementById('filterRole').value;
  currentStatus  = document.getElementById('filterStatus').value;
  loadUsers(1);
}

function resetFilter() {
  document.getElementById('filterKeyword').value = "";
  document.getElementById('filterRole').value    = "";
  document.getElementById('filterStatus').value  = "";

  currentKeyword = "";
  currentRole    = "";
  currentStatus  = "";
  loadUsers(1);
}

// ============ MODAL ============
async function openEditModal(id) {
  const res = await fetch(API_USERS + "/" + id, {
    headers: { "Authorization": "Bearer " + TOKEN }
  });

  if (!res.ok) {
    alert("Không tải được thông tin người dùng #" + id);
    return;
  }

  let data = {};
  try {
    data = await res.json();
  } catch (e) {
    console.error("Invalid JSON /admin/users/:id", e);
  }

  const u = data.user || {};

  document.getElementById('modalTitle').textContent = "Sửa người dùng #" + id;
  document.getElementById('userId').value           = u.id || id;
  document.getElementById('email').value            = u.email || "";
  document.getElementById('full_name').value        = u.full_name || "";
  document.getElementById('role').value             = u.role || "customer";
  document.getElementById('loyalty_points').value   = u.loyalty_points ?? 0;
  document.getElementById('provider').value         = u.provider || "";
  document.getElementById('created_at').value       = formatDate(u.created_at);
  document.getElementById('is_banned').checked      = !!u.is_banned;

  // Nếu là chính mình, disable checkbox cấm
  if (SELF_ID && SELF_ID === u.id) {
    document.getElementById('is_banned').disabled = true;
  } else {
    document.getElementById('is_banned').disabled = false;
  }

  userModal.show();
}

async function saveUser() {
  const id = document.getElementById('userId').value;

  const payload = {
    full_name:      document.getElementById('full_name').value.trim(),
    role:           document.getElementById('role').value,
    loyalty_points: parseInt(document.getElementById('loyalty_points').value, 10) || 0,
    is_banned:      document.getElementById('is_banned').checked
  };

  if (!payload.full_name) {
    alert("Vui lòng nhập họ tên.");
    return;
  }

  const res = await fetch(API_USERS + "/" + id, {
    method: "PUT",
    headers: authHeader(),
    body: JSON.stringify(payload)
  });

  let body = {};
  try {
    body = await res.json();
  } catch (e) {}

  if (!res.ok) {
    alert("Cập nhật người dùng thất bại: " + (body.message || res.status));
    return;
  }

  userModal.hide();
  loadUsers(currentPage);
}

// ============ CẤM / GỠ CẤM ============
async function banUser(id) {
  if (!confirm("Xác nhận cấm người dùng #" + id + "?")) return;

  const res = await fetch(API_USERS + "/" + id + "/ban", {
    method: "POST",
    headers: { "Authorization": "Bearer " + TOKEN }
  });

  let body = {};
  try { body = await res.json(); } catch(e) {}

  if (!res.ok) {
    alert("Cấm người dùng thất bại: " + (body.message || res.status));
    return;
  }

  loadUsers(currentPage);
}

async function unbanUser(id) {
  if (!confirm("Xác nhận gỡ cấm người dùng #" + id + "?")) return;

  const res = await fetch(API_USERS + "/" + id + "/unban", {
    method: "POST",
    headers: { "Authorization": "Bearer " + TOKEN }
  });

  let body = {};
  try { body = await res.json(); } catch(e) {}

  if (!res.ok) {
    alert("Gỡ cấm người dùng thất bại: " + (body.message || res.status));
    return;
  }

  loadUsers(currentPage);
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
  if (!TOKEN) {
    alert("Thiếu token đăng nhập admin. Vui lòng đăng nhập lại.");
    window.location.href = "login.php";
    return;
  }

  userModal = new bootstrap.Modal(document.getElementById('userModal'));

  loadUsers(1);
});
</script>
</body>
</html>
