<?php
// cart.php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

session_start();
require __DIR__.'/lib/api.php';

$apiBase = 'http://localhost:8080/api';

// Khởi tạo giỏ hàng trong session nếu chưa có
if (!isset($_SESSION['cart'])) {
    $_SESSION['cart'] = ['items' => []];
}

// ========= HÀM TÍNH TỔNG (CHỈ TÍNH SẢN PHẨM ĐƯỢC CHỌN) =========
function cart_calculate_totals() {
    $items = $_SESSION['cart']['items'] ?? [];
    $subtotal = 0;
    $selectedCount = 0;

    foreach ($items as $it) {
        $isSelected = !empty($it['selected']); // chỉ sản phẩm được tick
        if ($isSelected) {
            $subtotal += (int)$it['price'] * (int)$it['qty'];
            $selectedCount += (int)$it['qty'];
        }
    }

    // ví dụ: thuế 10%
    $tax = (int) round($subtotal * 0.1);

    // ví dụ: ship 30k nếu subtotal > 0 và < 2tr, còn lại free
    $shipping = ($subtotal > 0 && $subtotal < 2000000) ? 30000 : 0;

    $total = $subtotal + $tax + $shipping;

    return [
        'subtotal'      => $subtotal,
        'tax'           => $tax,
        'shipping'      => $shipping,
        'total'         => $total,
        'selectedCount' => $selectedCount,
    ];
}

// ========= XÁC ĐỊNH REQUEST AJAX =========
$isAjax = isset($_SERVER['HTTP_X_REQUESTED_WITH']) &&
          strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest';

// ========= XỬ LÝ ACTION =========
// add, add_variant: thêm hàng
// update: cập nhật số lượng
// remove: xoá sản phẩm
// toggle_select: tick / bỏ tick 1 sản phẩm
// select_all: tick / bỏ tick tất cả
$action = $_GET['action'] ?? $_POST['action'] ?? '';
$items  = &$_SESSION['cart']['items'];

if (in_array($action, ['add', 'add_variant', 'update', 'remove', 'toggle_select', 'select_all'], true)) {
    // Cho phép add bằng GET (từ products/product-detail) nhưng các action khác dùng POST + AJAX
    if ($_SERVER['REQUEST_METHOD'] === 'POST' || in_array($action, ['add','add_variant'], true)) {

        // ----- 1) THÊM SẢN PHẨM THEO SLUG (dùng API) -----
        if ($action === 'add') {
            $slug = $_GET['slug'] ?? $_POST['slug'] ?? '';
            if ($slug !== '') {
                try {
                    // Gọi API lấy chi tiết sản phẩm
                    [$code, $p] = api_call('GET', "$apiBase/product/".urlencode($slug), null, false);
                    if ($code === 200 && !empty($p)) {
                        // Lấy biến thể rẻ nhất (nếu có), nếu không thì dùng sản phẩm chính
                        $variant = $p['variants'][0] ?? null;
                        $idKey   = $variant ? 'v_'.$variant['id'] : 'p_'.$p['id'];
                        $price   = $variant['price'] ?? ($p['min_price'] ?? 0);

                        // Ảnh: ưu tiên ảnh tĩnh theo slug, fallback nếu không có
                        $imgPath = "acess/product/{$p['slug']}-1.jpg";
                        if (!file_exists(__DIR__.'/'.$imgPath)) {
                            $imgPath = "acess/product/no-image.jpg";
                        }

                        if (!isset($items[$idKey])) {
                            $items[$idKey] = [
                                'id'         => $variant ? $variant['id'] : $p['id'],
                                'type'       => $variant ? 'variant' : 'product',
                                'product_id' => $p['id'],
                                'name'       => $p['name'],
                                'attrs'      => $variant['attrs'] ?? [],
                                'price'      => $price,
                                'qty'        => 1,
                                'image'      => $imgPath,
                                'selected'   => 0, // mặc định chưa chọn
                            ];
                        } else {
                            $items[$idKey]['qty']++;
                        }
                    }
                } catch (Exception $e) {
                    // có thể log lỗi, nhưng không crash trang
                }
            }
        }

        // ----- 2) THÊM BIẾN THỂ THEO variant_id (dùng DB local) -----
        if ($action === 'add_variant') {
            $variantId    = (int)($_GET['variant_id'] ?? 0);
            $selectedFlag = !empty($_GET['selected']); // nếu Chọn mua -> selected=1

            if ($variantId > 0) {
                $conn = new mysqli("localhost", "root", "", "estorepc");
                if ($conn->connect_error) {
                    // không làm chết cả trang
                } else {
                    $sql = "SELECT pv.*, p.slug, p.name 
                            FROM product_variants pv
                            JOIN products p ON p.id = pv.product_id
                            WHERE pv.id = $variantId";
                    $res = $conn->query($sql);

                    if ($res && $res->num_rows > 0) {
                        $v = $res->fetch_assoc();

                        $key = "v_" . $v['id'];

                        if (!isset($items[$key])) {

                            $attrs = json_decode($v['attrs'], true);

                            // Ảnh tĩnh theo slug
                            $imgPath = "acess/product/{$v['slug']}-1.jpg";
                            if (!file_exists(__DIR__ . '/' . $imgPath)) {
                                $imgPath = "acess/product/no-image.jpg";
                            }

                            $items[$key] = [
                                'id'         => $v['id'],
                                'type'       => 'variant',
                                'product_id' => $v['product_id'],
                                'name'       => $v['name'],
                                'attrs'      => is_array($attrs) ? $attrs : [],
                                'price'      => (int)$v['price'],
                                'qty'        => 1,
                                'image'      => $imgPath,
                                'selected'   => $selectedFlag ? 1 : 0,
                            ];

                        } else {
                            $items[$key]['qty']++;
                            // Nếu lần này là "Chọn mua" -> đánh dấu selected = 1
                            if ($selectedFlag) {
                                $items[$key]['selected'] = 1;
                            }
                        }
                    }
                    $conn->close();
                }
            }
        }

        // ----- 3) CẬP NHẬT SỐ LƯỢNG (AJAX) -----
        if ($action === 'update' && $_SERVER['REQUEST_METHOD'] === 'POST') {
            $key = $_POST['key'] ?? '';
            $qty = max(1, (int)($_POST['qty'] ?? 1));
            if (isset($items[$key])) {
                $items[$key]['qty'] = $qty;
            }
        }

        // ----- 4) XOÁ MẶT HÀNG (AJAX) -----
        if ($action === 'remove' && $_SERVER['REQUEST_METHOD'] === 'POST') {
            $key = $_POST['key'] ?? '';
            if (isset($items[$key])) {
                unset($items[$key]);
            }
        }

        // ----- 5) TICK / BỎ TICK 1 SẢN PHẨM (AJAX) -----
        if ($action === 'toggle_select' && $_SERVER['REQUEST_METHOD'] === 'POST') {
            $key      = $_POST['key'] ?? '';
            $selected = !empty($_POST['selected']) ? 1 : 0;

            if (isset($items[$key])) {
                $items[$key]['selected'] = $selected;
            }
        }

        // ----- 6) CHỌN / BỎ CHỌN TẤT CẢ (AJAX) -----
        if ($action === 'select_all' && $_SERVER['REQUEST_METHOD'] === 'POST') {
            $selected = !empty($_POST['selected']) ? 1 : 0;
            foreach ($items as &$it) {
                $it['selected'] = $selected;
            }
            unset($it);
        }

        // Sau mọi thay đổi, tính lại tổng (chỉ tính sản phẩm được chọn)
        $totals = cart_calculate_totals();

        if ($isAjax) {
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'ok'     => true,
                'items'  => $items,
                'totals' => $totals,
            ]);
            exit;
        } else {
            // Không phải AJAX → quay lại trang giỏ hàng
            header('Location: cart.php');
            exit;
        }
    }
}

// ========= ĐẾN ĐÂY: HIỂN THỊ TRANG GIỎ HÀNG =========


$items  = $_SESSION['cart']['items'] ?? [];

// Đảm bảo item nào cũng có key 'selected'
foreach ($items as $k => $it) {
    if (!array_key_exists('selected', $it)) {
        $items[$k]['selected'] = 0; // mặc định chưa chọn
    }
}
// lưu lại vào session
$_SESSION['cart']['items'] = $items;

$totals = cart_calculate_totals();

// Tính trạng thái "chọn tất cả"
$allSelected = true;
$hasSelected = false;
foreach ($items as $it) {
    if (!empty($it['selected'])) {
        $hasSelected = true;
    } else {
        $allSelected = false;
    }
}
if (!$items) {
    $allSelected = false;
}

?>
<!doctype html>
<html lang="vi" data-bs-theme="light">
<head>
  <meta charset="utf-8">
  <title>Giỏ hàng | E-Store.PC</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- Bootstrap -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    :root{
      --brand:#0ea5e9;
      --brand-600:#0284c7;
    }
    body{
      background:#f3f4f6;
      color:#111827;
    }
    .navbar{
      background:#ffffff !important;
      border-bottom:1px solid #e5e7eb;
    }
    .btn-brand{ background:var(--brand); border-color:var(--brand); }
    .btn-brand:hover{ background:var(--brand-600); border-color:var(--brand-600); }
    .price{ color:var(--brand); font-weight:700; }
  </style>
</head>
<body>
<nav class="navbar navbar-expand-lg sticky-top">
  <div class="container">
    <a class="navbar-brand fw-bold" style="color:var(--brand)" href="index.php">E-Store<span class="text-dark">.PC</span></a>
    <button class="navbar-toggler border-0" data-bs-toggle="collapse" data-bs-target="#nav">
      <span class="navbar-toggler-icon"></span>
    </button>
    <div class="collapse navbar-collapse" id="nav">
      <ul class="navbar-nav me-auto">
        <li class="nav-item"><a class="nav-link" href="index.php">Trang chủ</a></li>
        <li class="nav-item"><a class="nav-link" href="products.php">Sản phẩm</a></li>
        <li class="nav-item"><a class="nav-link active" href="cart.php">Giỏ hàng</a></li>
      </ul>
    </div>
  </div>
</nav>

<main class="py-4">
  <div class="container">
    <h3 class="mb-3">Giỏ hàng của bạn</h3>

    <?php if (isset($_GET['need_select']) && $items): ?>
      <div class="alert alert-warning">
        Vui lòng chọn ít nhất một sản phẩm để tiến hành thanh toán.
      </div>
    <?php endif; ?>

    <?php if (!$items): ?>
      <div class="alert alert-info">Giỏ hàng đang trống. <a href="products.php">Tiếp tục mua sắm</a>.</div>
    <?php else: ?>
      <div class="row g-3">
        <div class="col-lg-8">
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <div class="d-flex justify-content-between mb-2">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="selectAll" <?=$allSelected?'checked':''?>>
                  <label class="form-check-label" for="selectAll">
                    Chọn tất cả sản phẩm
                  </label>
                </div>
              </div>
              <table class="table align-middle mb-0" id="cartTable">
                <thead>
                <tr>
                  <th style="width:40px;"></th>
                  <th>Sản phẩm</th>
                  <th class="text-end">Giá</th>
                  <th style="width:120px;">Số lượng</th>
                  <th class="text-end">Tạm tính</th>
                  <th></th>
                </tr>
                </thead>
                <tbody>
                <?php foreach($items as $key => $it): ?>
                  <tr data-key="<?=htmlspecialchars($key)?>">
                    <td>
                      <input type="checkbox"
                          class="form-check-input cart-select"
                          <?= !empty($it['selected']) ? 'checked' : '' ?>>
                    </td>
                    <td>
                      <div class="d-flex align-items-center gap-2">
                        <img src="<?=htmlspecialchars($it['image'])?>" width="60" class="rounded">
                        <div>
                          <div class="fw-semibold"><?=htmlspecialchars($it['name'])?></div>
                          <?php if(!empty($it['attrs'])): ?>
                            <div class="small text-muted">
                              <?php foreach($it['attrs'] as $k=>$v){
                                echo htmlspecialchars($k).': '.htmlspecialchars($v).' ';
                              } ?>
                            </div>
                          <?php endif; ?>
                        </div>
                      </div>
                    </td>
                    <td class="text-end cart-price" data-price="<?=$it['price']?>">
                      <?=number_format($it['price'],0,',','.')?>đ
                    </td>
                    <td>
                      <input type="number"
                             class="form-control form-control-sm cart-qty"
                             value="<?=$it['qty']?>"
                             min="1">
                    </td>
                    <td class="text-end cart-subtotal-col">
                      <?=number_format($it['price'] * $it['qty'],0,',','.')?>đ
                    </td>
                    <td class="text-end">
                      <button class="btn btn-sm btn-outline-danger cart-remove">&times;</button>
                    </td>
                  </tr>
                <?php endforeach; ?>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- TÓM TẮT GIỎ HÀNG (CHỈ TÍNH HÀNG ĐƯỢC CHỌN) -->
        <div class="col-lg-4">
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <h5 class="mb-3">Tóm tắt giỏ hàng</h5>
              <div class="small text-muted mb-2">
                Chỉ tính các sản phẩm <strong>đã được tích chọn</strong>.
              </div>
              <div class="d-flex justify-content-between">
                <span>Tạm tính</span>
                <span id="cartSubtotal"><?=number_format($totals['subtotal'],0,',','.')?>đ</span>
              </div>
              <div class="d-flex justify-content-between">
                <span>Thuế (10%)</span>
                <span id="cartTax"><?=number_format($totals['tax'],0,',','.')?>đ</span>
              </div>
              <div class="d-flex justify-content-between">
                <span>Phí vận chuyển</span>
                <span id="cartShipping"><?=number_format($totals['shipping'],0,',','.')?>đ</span>
              </div>
              <hr>
              <div class="d-flex justify-content-between fw-bold">
                <span>Tổng cộng</span>
                <span id="cartTotal"><?=number_format($totals['total'],0,',','.')?>đ</span>
              </div>
              <button id="btnCheckout" class="btn btn-brand w-100 mt-3">
                Tiến hành thanh toán
              </button>
              <div class="mt-2 small text-muted">
                * Vui lòng chọn ít nhất một sản phẩm trước khi thanh toán.
              </div>
            </div>
          </div>
          <div class="mt-2 small text-muted">
            * Giá và phí vận chuyển chỉ mang tính minh họa, tuỳ logic thực tế.
          </div>
        </div>
      </div>
    <?php endif; ?>
  </div>
</main>

<footer class="py-3 mt-4 bg-white border-top">
  <div class="container d-flex justify-content-between small text-muted">
    <span>E-Store.PC • Cart</span>
    <span>Cập nhật giỏ hàng & chọn sản phẩm theo thời gian thực</span>
  </div>
</footer>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<script>
(function(){
  const table = document.getElementById('cartTable');
  const selectAllCheckbox = document.getElementById('selectAll');
  const btnCheckout = document.getElementById('btnCheckout');

  if (!table) return;

  function formatVND(n) {
    return new Intl.NumberFormat('vi-VN').format(n) + 'đ';
  }

  async function postCart(action, payload) {
    const formData = new FormData();
    formData.append('action', action);
    Object.keys(payload).forEach(k => formData.append(k, payload[k]));

    const resp = await fetch('cart.php', {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      body: formData
    });
    return await resp.json();
  }

  function updateTotals(totals) {
    if (!totals) return;
    document.getElementById('cartSubtotal').textContent = formatVND(totals.subtotal);
    document.getElementById('cartTax').textContent      = formatVND(totals.tax);
    document.getElementById('cartShipping').textContent = formatVND(totals.shipping);
    document.getElementById('cartTotal').textContent    = formatVND(totals.total);
  }

  // Đổi số lượng & tick chọn
  table.addEventListener('change', async function(e){
    // Đổi số lượng
    if (e.target.classList.contains('cart-qty')) {
      const tr  = e.target.closest('tr');
      const key = tr.dataset.key;
      const qty = Math.max(1, parseInt(e.target.value || '1', 10));

      const data = await postCart('update', { key, qty });
      if (data && data.ok) {
        const priceCell = tr.querySelector('.cart-price');
        const price     = parseInt(priceCell.dataset.price, 10) || 0;
        const subCol    = tr.querySelector('.cart-subtotal-col');
        subCol.textContent = formatVND(price * qty);

        updateTotals(data.totals);
      }
      return;
    }

    // Tick / Bỏ tick 1 sản phẩm
    if (e.target.classList.contains('cart-select')) {
      const tr  = e.target.closest('tr');
      const key = tr.dataset.key;
      const selected = e.target.checked ? 1 : 0;

      const data = await postCart('toggle_select', { key, selected });
      if (data && data.ok) {
        updateTotals(data.totals);

        // Cập nhật trạng thái "chọn tất cả"
        const allCheckboxes = table.querySelectorAll('.cart-select');
        const checkedOnes   = table.querySelectorAll('.cart-select:checked');
        if (selectAllCheckbox) {
          selectAllCheckbox.checked = (allCheckboxes.length > 0 && checkedOnes.length === allCheckboxes.length);
        }
      }
      return;
    }
  });

  // Xoá sản phẩm
  table.addEventListener('click', async function(e){
    if (!e.target.classList.contains('cart-remove')) return;
    const tr  = e.target.closest('tr');
    const key = tr.dataset.key;

    const data = await postCart('remove', { key });
    if (data && data.ok) {
      tr.remove();

      if (data.totals) {
        updateTotals(data.totals);
      }

      // Nếu giỏ trống → reload về trạng thái "giỏ trống"
      const hasRow = table.querySelector('tbody tr');
      if (!hasRow) {
        window.location.reload();
      }
    }
  });

  // Chọn / bỏ chọn tất cả
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', async function(){
      const selected = this.checked ? 1 : 0;
      const data = await postCart('select_all', { selected });

      if (data && data.ok) {
        const allCheckboxes = table.querySelectorAll('.cart-select');
        allCheckboxes.forEach(cb => cb.checked = !!selected);
        updateTotals(data.totals);
      }
    });
  }

  // Nút "Tiến hành thanh toán": yêu cầu phải có ít nhất 1 sản phẩm được chọn
  if (btnCheckout) {
    btnCheckout.addEventListener('click', function(e){
      const selectedRows = table.querySelectorAll('.cart-select:checked');
      if (selectedRows.length === 0) {
        e.preventDefault();
        alert('Vui lòng chọn ít nhất một sản phẩm để thanh toán.');
        return;
      }
      // OK -> sang checkout
      window.location.href = 'checkout.php';
    });
  }
})();
</script>
</body>
</html>
