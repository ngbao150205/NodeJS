<?php
// admin-products.php
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
    // ignore, bên dưới sẽ redirect nếu không phải admin
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
<title>Admin – Quản lý sản phẩm</title>
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
  .btn-brand{
    background:var(--brand);
    border-color:var(--brand);
    color:#fff;
  }
  .btn-brand:hover{
    background:var(--brand-600);
    border-color:var(--brand-600);
  }
  .card-lite{
    background:#fff;
    border:1px solid #e5e7eb;
    box-shadow:0 6px 14px rgba(0,0,0,.04);
    border-radius:.75rem;
  }
  .image-slot{
    background:#f9fafb;
    border:1px dashed #cbd5f5;
    border-radius:.75rem;
    cursor:pointer;
    min-height:140px;
    display:flex;
    align-items:center;
    justify-content:center;
    flex-direction:column;
  }
  .image-slot img{
    max-height:120px;
    object-fit:contain;
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
      <a href="logout.php" class="btn btn-sm btn-outline-danger">Đăng xuất</a>
    </div>
  </div>
</nav>

<div class="container py-4">

  <div class="d-flex justify-content-between align-items-center mb-3">
    <div>
      <h2 class="section-title">Quản lý sản phẩm</h2>
      <div class="text-muted">Thêm / sửa / xoá sản phẩm, lọc theo danh mục & quản lý biến thể, tồn kho.</div>
    </div>

    <button class="btn btn-brand" onclick="openCreateModal()">+ Thêm sản phẩm</button>
  </div>

  <!-- BỘ LỌC -->
  <div class="card card-lite mb-3">
    <div class="card-body">
      <div class="row g-3 align-items-end">
        <div class="col-md-4">
          <label class="form-label small">Danh mục</label>
          <select id="filterCategory" class="form-select">
            <option value="">Tất cả danh mục</option>
            <option value="laptop">Laptop</option>
            <option value="monitor">Monitor</option>
            <option value="hard-drive">SSD / HDD</option>
          </select>
        </div>
        <div class="col-md-4">
          <label class="form-label small">Tìm theo tên sản phẩm</label>
          <input id="filterKeyword" class="form-control" placeholder="Nhập tên sản phẩm...">
        </div>
        <div class="col-md-4 d-flex gap-2">
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
            <th>Tên</th>
            <th>Hãng</th>
            <th>Danh mục</th>
            <th>Slug</th>
            <th class="text-center" style="min-width:180px;">Biến thể</th>
            <th class="text-end" style="width:120px;">Giá</th>
            <th class="text-center" style="width:100px;">Tồn kho</th>
            <th class="text-end" style="width:220px;">Hành động</th>
          </tr>
        </thead>
        <tbody id="productTable">
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

<!-- ======================= MODAL SỬA / THÊM ======================= -->
<div class="modal fade" id="productModal">
  <div class="modal-dialog modal-lg">
    <div class="modal-content card-lite">
      <div class="modal-header">
        <h5 class="modal-title" id="modalTitle">Thêm sản phẩm</h5>
        <button class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body">

        <input type="hidden" id="productId">

        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label">Tên sản phẩm</label>
            <input id="name" class="form-control" placeholder="Ví dụ: Laptop Acer Nitro 5">
          </div>
          <div class="col-md-3">
            <label class="form-label">Hãng</label>
            <input id="brand" class="form-control" placeholder="Acer, Asus, Lenovo...">
          </div>
          <div class="col-md-3">
            <label class="form-label">Slug (đường dẫn)</label>
            <input id="slug" class="form-control" placeholder="acer-nitro-5-2023">
          </div>
        </div>

        <div class="mt-3">
          <label class="form-label">Tóm tắt (short desc)</label>
          <textarea id="short_desc" class="form-control" rows="2" placeholder="Mô tả ngắn hiển thị ở danh sách sản phẩm"></textarea>
        </div>

        <div class="mt-3">
          <label class="form-label">Mô tả chi tiết</label>
          <textarea id="description" class="form-control" rows="4" placeholder="Mô tả chi tiết sản phẩm"></textarea>
        </div>

        <div class="mt-3">
          <label class="form-label">Danh mục chính</label>
          <select id="category_slug" class="form-select">
            <option value="laptop">Laptop</option>
            <option value="monitor">Monitor</option>
            <option value="hard-drive">SSD / HDD</option>
          </select>
          <small class="text-muted">Chỉ dùng 3 danh mục chính: Laptop, Monitor, SSD/HDD.</small>
        </div>

        <hr class="my-3">

        <h6>Biến thể & tồn kho</h6>
        <div id="variantsContainer"></div>
        <button type="button" class="btn btn-sm btn-outline-primary mt-2" onclick="addVariantRow()">+ Thêm biến thể</button>
        <small class="text-muted d-block mt-1">
          Mỗi biến thể có SKU riêng, mô tả ngắn (label), giá và số lượng tồn kho.
        </small>

        <hr class="my-3">

        <h6>Ảnh sản phẩm</h6>
        <div class="row g-3">
          <!-- Slot 1 -->
          <div class="col-4">
            <div class="image-slot" onclick="triggerFileInput(1)">
              <img id="preview1" class="img-fluid mb-2 d-none" alt="Ảnh 1">
              <div id="placeholder1" class="text-muted small">Chọn ảnh 1</div>
            </div>
            <input type="file" id="image1" accept="image/*" class="d-none" onchange="onFileChange(1)">
            <button type="button"
                    class="btn btn-sm btn-link text-danger px-0"
                    onclick="clearImageSlot(1, event)">
              Xoá ảnh
            </button>
          </div>

          <!-- Slot 2 -->
          <div class="col-4">
            <div class="image-slot" onclick="triggerFileInput(2)">
              <img id="preview2" class="img-fluid mb-2 d-none" alt="Ảnh 2">
              <div id="placeholder2" class="text-muted small">Chọn ảnh 2</div>
            </div>
            <input type="file" id="image2" accept="image/*" class="d-none" onchange="onFileChange(2)">
            <button type="button"
                    class="btn btn-sm btn-link text-danger px-0"
                    onclick="clearImageSlot(2, event)">
              Xoá ảnh
            </button>
          </div>

          <!-- Slot 3 -->
          <div class="col-4">
            <div class="image-slot" onclick="triggerFileInput(3)">
              <img id="preview3" class="img-fluid mb-2 d-none" alt="Ảnh 3">
              <div id="placeholder3" class="text-muted small">Chọn ảnh 3</div>
            </div>
            <input type="file" id="image3" accept="image/*" class="d-none" onchange="onFileChange(3)">
            <button type="button"
                    class="btn btn-sm btn-link text-danger px-0"
                    onclick="clearImageSlot(3, event)">
              Xoá ảnh
            </button>
          </div>
        </div>
        <small class="text-muted d-block mt-1">
          Ảnh sẽ được lưu vào thư mục <code>frontend/acess/product/</code> với tên
          <code>&lt;slug&gt;-1.jpg</code>, <code>&lt;slug&gt;-2.jpg</code>, <code>&lt;slug&gt;-3.jpg</code>.
        </small>

      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-bs-dismiss="modal">Huỷ</button>
        <button class="btn btn-brand" onclick="saveProduct()">Lưu</button>
      </div>
    </div>
  </div>
</div>
<!-- ======================= END MODAL ======================= -->

<!-- Bootstrap JS -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>

<script>
const API_PRODUCTS = "http://localhost:8080/api/admin/products";
const TOKEN        = <?= json_encode($token ?: '') ?>;

// trạng thái filter + phân trang
let currentPage     = 1;
let totalPages      = 1;
const LIMIT         = 10; // 10 sản phẩm / trang
let currentCategory = "";
let currentKeyword  = "";

// modal bootstrap
let productModal = null;

// quản lý ảnh trong modal
let currentImages    = [null, null, null];      // [{id, image_url, sort_order}, ...]
let imageDeleteFlags = [false, false, false];   // true = slot đó bị đánh dấu xoá

// cache biến thể cho list
const variantCache = {}; // { [productId]: [ {id, sku, label, price, stock}, ... ] }

function authHeader() {
  return {
    "Authorization": "Bearer " + TOKEN,
    "Content-Type": "application/json"
  };
}

function formatVND(n) {
  if (!n && n !== 0) return "—";
  return Number(n).toLocaleString('vi-VN') + "đ";
}

// ---------- ẢNH SẢN PHẨM TRONG MODAL ----------
function resetImageSlots() {
  currentImages    = [null, null, null];
  imageDeleteFlags = [false, false, false];

  for (let i = 1; i <= 3; i++) {
    const img   = document.getElementById('preview' + i);
    const ph    = document.getElementById('placeholder' + i);
    const input = document.getElementById('image' + i);

    if (img) {
      img.src = '';
      img.classList.add('d-none');
    }
    if (ph) {
      ph.classList.remove('d-none');
    }
    if (input) {
      input.value = '';
    }
  }
}

// dùng khi load từ API (URL ảnh)
function setPreviewFromUrl(slot, url) {
  const img = document.getElementById('preview' + slot);
  const ph  = document.getElementById('placeholder' + slot);
  if (!img || !ph) return;

  if (url) {
    img.src = url;
    img.classList.remove('d-none');
    ph.classList.add('d-none');
  } else {
    img.src = '';
    img.classList.add('d-none');
    ph.classList.remove('d-none');
  }
}

function triggerFileInput(slot) {
  const input = document.getElementById('image' + slot);
  if (input) input.click();
}

function onFileChange(slot) {
  const input = document.getElementById('image' + slot);
  const img   = document.getElementById('preview' + slot);
  const ph    = document.getElementById('placeholder' + slot);

  if (!input || !img || !ph) return;

  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = e => {
      img.src = e.target.result;
      img.classList.remove('d-none');
      ph.classList.add('d-none');
    };
    reader.readAsDataURL(input.files[0]);

    // có file mới thì không xoá slot này
    imageDeleteFlags[slot - 1] = false;
  }
}

function clearImageSlot(slot, evt) {
  if (evt) evt.stopPropagation();

  const input = document.getElementById('image' + slot);
  const img   = document.getElementById('preview' + slot);
  const ph    = document.getElementById('placeholder' + slot);

  if (input) input.value = '';
  if (img) {
    img.src = '';
    img.classList.add('d-none');
  }
  if (ph) {
    ph.classList.remove('d-none');
  }

  // nếu đang sửa và slot này đang có ảnh cũ -> đánh dấu xoá
  if (currentImages[slot - 1]) {
    imageDeleteFlags[slot - 1] = true;
  }
}

// upload & xoá ảnh sau khi lưu sản phẩm thành công
async function saveProductImages(productId) {
  const formData = new FormData();
  let hasFile = false;

  for (let i = 1; i <= 3; i++) {
    const input = document.getElementById('image' + i);
    if (input && input.files && input.files[0]) {
      formData.append('image' + i, input.files[0]);
      hasFile = true;
    }
  }

  try {
    // upload / thay ảnh
    if (hasFile) {
      const resUpload = await fetch(API_PRODUCTS + "/" + productId + "/images", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + TOKEN
          // KHÔNG set Content-Type, để browser tự set boundary
        },
        body: formData
      });

      if (!resUpload.ok) {
        console.error("Upload images failed", await resUpload.text());
        alert("Lưu sản phẩm thành công nhưng tải ảnh thất bại.");
      }
    }

    // xoá ảnh đã đánh dấu
    for (let i = 1; i <= 3; i++) {
      const input = document.getElementById('image' + i);
      // chỉ xoá khi: flag = true và không có file mới thay thế
      if (imageDeleteFlags[i - 1] && (!input || !input.files || !input.files[0])) {
        await fetch(API_PRODUCTS + "/" + productId + "/images/" + i, {
          method: "DELETE",
          headers: { "Authorization": "Bearer " + TOKEN }
        });
      }
    }
  } catch (e) {
    console.error("saveProductImages error", e);
    alert("Có lỗi khi lưu ảnh sản phẩm.");
  }
}

// ---------- BIẾN THỂ TRÊN LIST SẢN PHẨM ----------

function updateVariantDisplay(productId, variant) {
  const priceEl = document.getElementById('variant-price-' + productId);
  const stockEl = document.getElementById('variant-stock-' + productId);

  if (!priceEl || !stockEl) return;

  if (!variant) {
    priceEl.textContent = '—';
    stockEl.textContent = '—';
  } else {
    priceEl.textContent = formatVND(variant.price);
    stockEl.textContent = (variant.stock ?? 0);
  }
}

function fillVariantUI(productId, variants) {
  const select = document.querySelector('select.variant-select[data-product-id="' + productId + '"]');
  if (!select) return;

  select.innerHTML = '';

  if (!variants.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Không có biến thể';
    select.appendChild(opt);
    updateVariantDisplay(productId, null);
    return;
  }

  variants.forEach((v, idx) => {
    const opt = document.createElement('option');
    opt.value = v.id;
    const label = v.label || v.sku || ('Biến thể #' + (idx + 1));
    opt.textContent = label;
    if (idx === 0) opt.selected = true;
    select.appendChild(opt);
  });

  // hiển thị theo biến thể đầu tiên
  updateVariantDisplay(productId, variants[0]);
}

async function loadProductVariants(productId) {
  // nếu đã cache thì dùng luôn
  if (variantCache[productId]) {
    fillVariantUI(productId, variantCache[productId]);
    return;
  }

  try {
    const res = await fetch(API_PRODUCTS + "/" + productId, {
      headers: { "Authorization": "Bearer " + TOKEN }
    });
    if (!res.ok) {
      console.error("Không load được biến thể sản phẩm", productId, res.status);
      fillVariantUI(productId, []);
      return;
    }
    const data = await res.json();
    const vars = data.variants || [];
    variantCache[productId] = vars;
    fillVariantUI(productId, vars);
  } catch (e) {
    console.error("loadProductVariants error", productId, e);
    fillVariantUI(productId, []);
  }
}

function onVariantSelectChange(productId, variantId) {
  const variants = variantCache[productId] || [];
  const v = variants.find(v => String(v.id) === String(variantId));
  updateVariantDisplay(productId, v || null);
}

// ============ LOAD DANH SÁCH SẢN PHẨM ============
async function loadProducts(page = 1) {
  currentPage = page;

  const params = new URLSearchParams({
    page: page,
    limit: LIMIT
  });
  if (currentCategory) params.append('category', currentCategory);
  if (currentKeyword)  params.append('q', currentKeyword);

  const res = await fetch(API_PRODUCTS + "?" + params.toString(), {
    headers: { "Authorization": "Bearer " + TOKEN }
  });

  if (res.status === 401) {
    alert("Phiên đăng nhập hết hạn hoặc không có quyền. Vui lòng đăng nhập lại.");
    window.location.href = "login.php";
    return;
  }

  const data = await res.json();
  const tb   = document.getElementById("productTable");

  const items = data.items || [];

  if (!items.length) {
    tb.innerHTML = '<tr><td colspan="9" class="text-center p-4 text-muted">Không có sản phẩm nào.</td></tr>';
  } else {
    tb.innerHTML = items.map(p => `
      <tr data-product-id="${p.id}">
        <td>${p.id}</td>
        <td>${p.name}</td>
        <td>${p.brand || ''}</td>
        <td>${p.categories || '—'}</td>
        <td>${p.slug}</td>
        <td class="text-center">
          <select class="form-select form-select-sm variant-select"
                  data-product-id="${p.id}"
                  onchange="onVariantSelectChange(${p.id}, this.value)">
            <option value="">Đang tải...</option>
          </select>
        </td>
        <td class="text-end">
          <span id="variant-price-${p.id}">—</span>
        </td>
        <td class="text-center">
          <span id="variant-stock-${p.id}">—</span>
        </td>
        <td class="text-end">
          <button class="btn btn-sm btn-warning me-1" onclick="openEditModal(${p.id})">Sửa</button>
          <button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.id})">Xoá</button>
        </td>
      </tr>
    `).join("");

    // Sau khi render table, load biến thể cho từng sản phẩm
    items.forEach(p => {
      loadProductVariants(p.id);
    });
  }

  // cập nhật phân trang
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

    const a = document.createElement('button');
    a.className = 'page-link';
    a.type = 'button';
    a.textContent = label || page;
    if (!disabled && !active) {
      a.onclick = () => loadProducts(page);
    }

    li.appendChild(a);
    return li;
  };

  // prev
  ul.appendChild(createItem(currentPage - 1, '«', currentPage === 1));

  for (let p = 1; p <= totalPages; p++) {
    ul.appendChild(createItem(p, String(p), false, p === currentPage));
  }

  // next
  ul.appendChild(createItem(currentPage + 1, '»', currentPage === totalPages));
}

// ============ BỘ LỌC ============
function applyFilter() {
  const catSel = document.getElementById('filterCategory');
  const kwInp  = document.getElementById('filterKeyword');

  currentCategory = catSel.value || "";
  currentKeyword  = kwInp.value.trim();
  loadProducts(1);
}

function resetFilter() {
  document.getElementById('filterCategory').value = "";
  document.getElementById('filterKeyword').value  = "";
  currentCategory = "";
  currentKeyword  = "";
  loadProducts(1);
}

// ============ QUẢN LÝ BIẾN THỂ TRONG MODAL ============
function addVariantRow(variant = {}) {
  const container = document.getElementById('variantsContainer');
  const row = document.createElement('div');
  row.className = 'row g-2 align-items-end mb-2';

  row.innerHTML = `
    <div class="col-md-3">
      <label class="form-label small">SKU</label>
      <input class="form-control variant-sku" value="${variant.sku || ''}">
    </div>
    <div class="col-md-3">
      <label class="form-label small">Label</label>
      <input class="form-control variant-label" placeholder="VD: 16GB RAM / 512GB SSD" value="${variant.label || ''}">
    </div>
    <div class="col-md-3">
      <label class="form-label small">Giá (VNĐ)</label>
      <input type="number" min="0" class="form-control variant-price" value="${variant.price ?? ''}">
    </div>
    <div class="col-md-2">
      <label class="form-label small">Tồn kho</label>
      <input type="number" min="0" class="form-control variant-stock" value="${variant.stock ?? ''}">
    </div>
    <div class="col-md-1 text-end">
      <button type="button" class="btn btn-sm btn-outline-danger" onclick="this.closest('.row').remove()">×</button>
    </div>
  `;
  container.appendChild(row);
}

function clearVariantRows() {
  document.getElementById('variantsContainer').innerHTML = '';
}

// ============ MODAL ============
function openCreateModal() {
  document.getElementById("modalTitle").textContent = "Thêm sản phẩm";
  document.getElementById("productId").value = "";
  document.getElementById("name").value = "";
  document.getElementById("brand").value = "";
  document.getElementById("slug").value = "";
  document.getElementById("short_desc").value = "";
  document.getElementById("description").value = "";
  document.getElementById("category_slug").value = "laptop";

  clearVariantRows();
  // Mặc định có 2 biến thể trống
  addVariantRow();
  addVariantRow();

  // reset ảnh
  resetImageSlots();

  productModal.show();
}

async function openEditModal(id) {
  const res = await fetch(API_PRODUCTS + "/" + id, {
    headers: { "Authorization": "Bearer " + TOKEN }
  });
  if (!res.ok) {
    alert("Không tải được thông tin sản phẩm #" + id);
    return;
  }
  const data = await res.json();
  const p    = data.product || {};
  const vars = data.variants || [];
  const imgs = data.images || [];

  document.getElementById("modalTitle").textContent = "Sửa sản phẩm #" + id;
  document.getElementById("productId").value = id;
  document.getElementById("name").value = p.name || "";
  document.getElementById("brand").value = p.brand || "";
  document.getElementById("slug").value = p.slug || "";
  document.getElementById("short_desc").value = p.short_desc || "";
  document.getElementById("description").value = p.descriptions || "";
  document.getElementById("category_slug").value = p.category_slug || "laptop";

  clearVariantRows();
  if (vars.length) {
    vars.forEach(v => addVariantRow({
      sku:   v.sku,
      label: v.label,
      price: v.price,
      stock: v.stock
    }));
  } else {
    addVariantRow();
    addVariantRow();
  }

  // ẢNH: reset rồi load từ API
  resetImageSlots();
  imgs.forEach(img => {
    const slot = img.sort_order || 1;
    if (slot >= 1 && slot <= 3) {
      currentImages[slot - 1] = img;
      setPreviewFromUrl(slot, img.image_url);
    }
  });

  productModal.show();
}

// ============ SAVE ============
async function saveProduct() {
  const id = document.getElementById("productId").value;

  const payload = {
    name:         document.getElementById("name").value.trim(),
    brand:        document.getElementById("brand").value.trim(),
    slug:         document.getElementById("slug").value.trim(),
    short_desc:   document.getElementById("short_desc").value.trim(),
    descriptions: document.getElementById("description").value.trim(),
    category_slug:document.getElementById("category_slug").value,
    variants:     []
  };

  if (!payload.name || !payload.slug) {
    alert("Vui lòng nhập ít nhất Tên sản phẩm và Slug.");
    return;
  }

  const rows = document.querySelectorAll('#variantsContainer .row');
  rows.forEach(row => {
    const sku   = row.querySelector('.variant-sku').value.trim();
    const label = row.querySelector('.variant-label').value.trim();
    const price = parseInt(row.querySelector('.variant-price').value, 10);
    const stock = parseInt(row.querySelector('.variant-stock').value, 10);

    if (!sku && !label && isNaN(price) && isNaN(stock)) {
      // dòng trống -> bỏ qua
      return;
    }

    payload.variants.push({
      sku,
      label,
      price: isNaN(price) ? 0 : price,
      stock: isNaN(stock) ? 0 : stock
    });
  });

  if (payload.variants.length < 1) {
    alert("Vui lòng nhập ít nhất 1 biến thể.");
    return;
  }

  let method = id ? "PUT" : "POST";
  let url    = id ? (API_PRODUCTS + "/" + id) : API_PRODUCTS;

  const res = await fetch(url, {
    method,
    headers: authHeader(),
    body: JSON.stringify(payload)
  });

  let body = {};
  try {
    body = await res.json();
  } catch (e) {}

  if (!res.ok) {
    alert("Lưu sản phẩm thất bại: " + (body.message || res.status));
    return;
  }

  const productId = id || body.id; // POST trả về id, PUT dùng id đang sửa

  // Lưu / cập nhật / xoá ảnh
  if (productId) {
    await saveProductImages(productId);
  }

  productModal.hide();
  loadProducts(currentPage);
}

// ============ DELETE ============
async function deleteProduct(id) {
  if (!confirm("Xác nhận xoá sản phẩm #" + id + "?")) return;

  const res = await fetch(API_PRODUCTS + "/" + id, {
    method: "DELETE",
    headers: { "Authorization": "Bearer " + TOKEN }
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    alert("Xoá thất bại: " + (err.message || res.status));
    return;
  }

  loadProducts(currentPage);
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
  if (!TOKEN) {
    alert("Thiếu token đăng nhập admin. Vui lòng đăng nhập lại.");
    window.location.href = "login.php";
    return;
  }

  productModal = new bootstrap.Modal(document.getElementById("productModal"));

  loadProducts(1);
});
</script>
</body>
</html>
