<?php
// order-details.php
ini_set('display_errors',1);
ini_set('display_startup_errors',1);
error_reporting(E_ALL);

session_start();
require __DIR__.'/lib/api.php';

$apiBase = 'http://localhost:8080/api';

// ====== HÀM KẾT NỐI DB LOCAL ======
function db() {
    static $conn = null;
    if ($conn === null) {
        $conn = new mysqli('localhost', 'root', '', 'estorepc');
        if ($conn->connect_error) {
            die('Lỗi kết nối DB: ' . $conn->connect_error);
        }
        $conn->set_charset('utf8mb4');
    }
    return $conn;
}

function format_vnd($n){
    return number_format((int)$n,0,',','.').'đ';
}

// ====== KIỂM TRA ĐĂNG NHẬP ======
$isAuth   = false;
$authUser = null;
$authName = '';
$authEmail= '';
$authUserId = null;
$msg = '';

try {
    $t = get_token();
    if ($t) {
        [$cMe,$me] = api_call('GET',"$apiBase/auth/me",null,true);
        if ($cMe===200 && !empty($me['user'])) {
            $isAuth     = true;
            $authUser   = $me['user'];
            $authUserId = $authUser['id'] ?? null;
            $authName   = $authUser['full_name'] ?? '';
            $authEmail  = $authUser['email'] ?? '';
        } else {
            clear_token();
        }
    }
} catch (Exception $e) {
    clear_token();
}

if (!$isAuth || !$authUserId) {
    header('Location: login.php');
    exit;
}

// ====== LẤY ID ĐƠN HÀNG ======
$orderId = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if ($orderId <= 0) {
    echo "Thiếu ID đơn hàng.";
    exit;
}

$conn = db();

// ====== LẤY THÔNG TIN ĐƠN HÀNG (CHỈ CHO CHỦ ĐƠN) ======
$stmt = $conn->prepare("
    SELECT *
    FROM orders
    WHERE id = ? AND user_id = ?
    LIMIT 1
");
$stmt->bind_param('ii', $orderId, $authUserId);
$stmt->execute();
$orderRes = $stmt->get_result();
$order = $orderRes->fetch_assoc();
$stmt->close();

if (!$order) {
    echo "Không tìm thấy đơn hàng.";
    exit;
}

// ====== LẤY DANH SÁCH SẢN PHẨM TRONG ĐƠN ======
// join với products để lấy slug → suy ra đường dẫn ảnh
$stmt = $conn->prepare("
    SELECT 
        oi.*,
        p.slug AS product_slug
    FROM order_items oi
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ?
");
$stmt->bind_param('i', $orderId);
$stmt->execute();
$itemsRes = $stmt->get_result();
$orderItems = [];
while ($row = $itemsRes->fetch_assoc()) {
    // decode thuộc tính
    $row['attrs_decoded'] = [];
    if (!empty($row['attrs'])) {
        $decoded = json_decode($row['attrs'], true);
        if (is_array($decoded)) {
            $row['attrs_decoded'] = $decoded;
        }
    }

    // ====== XỬ LÝ ẢNH SẢN PHẨM ======
    $imgPath = 'acess/product/no-image.jpg';
    if (!empty($row['product_slug'])) {
        $slug = $row['product_slug'];

        // Thử slug-1.jpg, slug.jpg giống logic product-detail.php
        $candidate1 = "acess/product/{$slug}-1.jpg";
        $candidate2 = "acess/product/{$slug}.jpg";

        if (file_exists(__DIR__.'/'.$candidate1)) {
            $imgPath = $candidate1;
        } elseif (file_exists(__DIR__.'/'.$candidate2)) {
            $imgPath = $candidate2;
        }
    }
    $row['image_path'] = $imgPath;

    $orderItems[] = $row;
}
$stmt->close();

// ====== TÍNH TOÁN ĐƠN ======
$subtotal       = (int)$order['subtotal'];
$tax            = (int)$order['tax'];
$shipping_fee   = (int)$order['shipping_fee'];
$discount_amount= (int)$order['discount_amount'];
$total_amount   = (int)$order['total_amount'];
$coupon_code    = $order['coupon_code'];
$status         = $order['status'];

?>
<!doctype html>
<html lang="vi" data-bs-theme="light">
<head>
  <meta charset="utf-8">
  <title>Chi tiết đơn hàng #<?=htmlspecialchars($orderId)?> | E-Store.PC</title>
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
    .badge-soft{
      background:#e6f4ff; color:#0369a1; border:1px solid #bae6fd;
      text-transform:uppercase; letter-spacing:.12em; font-size:.65rem
    }
    .card-lite{ border:0; box-shadow:0 8px 20px rgba(15,23,42,.08); }
  </style>
</head>
<body>
<nav class="navbar">
  <div class="container d-flex justify-content-between align-items-center">
    <a class="navbar-brand fw-bold" style="color:var(--brand)" href="index.php">
      E-Store<span class="text-dark">.PC</span>
    </a>
    <div class="d-flex gap-2">
      <a href="orders.php" class="btn btn-sm btn-outline-secondary">Lịch sử đơn hàng</a>
      <a href="profile.php" class="btn btn-sm btn-outline-primary">Hồ sơ</a>
    </div>
  </div>
</nav>

<main class="py-4">
  <div class="container">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <div>
        <span class="badge badge-soft mb-1">CHI TIẾT ĐƠN HÀNG</span>
        <h3 class="mb-0">Đơn hàng #<?=$orderId?></h3>
        <div class="text-muted small">
          Ngày đặt: <?=htmlspecialchars($order['created_at'] ?? '')?>
        </div>
      </div>
      <div class="text-end">
        <div>
          Trạng thái:
          <?php
          $badgeClass = 'secondary';
          if ($status === 'pending')   $badgeClass = 'warning';
          elseif ($status === 'paid')  $badgeClass = 'success';
          elseif ($status === 'cancelled') $badgeClass = 'danger';
          ?>
          <span class="badge text-bg-<?=$badgeClass?>">
            <?=htmlspecialchars(ucfirst($status))?>
          </span>
        </div>
        <div class="mt-1">
          Tổng tiền: <strong><?=format_vnd($total_amount)?></strong>
        </div>
      </div>
    </div>

    <?php if($msg): ?>
      <div class="alert alert-danger"><?=$msg?></div>
    <?php endif; ?>

    <div class="row g-4">
      <!-- Thông tin giao hàng -->
      <div class="col-lg-4">
        <div class="card card-lite h-100">
          <div class="card-body">
            <h5 class="mb-3">Thông tin giao hàng</h5>
            <div class="mb-2">
              <div class="text-muted small">Người nhận</div>
              <div><strong><?=htmlspecialchars($order['receiver_name'] ?? '')?></strong></div>
            </div>
            <div class="mb-2">
              <div class="text-muted small">Số điện thoại</div>
              <div><?=htmlspecialchars($order['phone'] ?? '')?></div>
            </div>
            <div class="mb-2">
              <div class="text-muted small">Địa chỉ</div>
              <div>
                <?=htmlspecialchars($order['address_details'] ?? '')?><br>
                <?=htmlspecialchars($order['district'] ?? '')?>,
                <?=htmlspecialchars($order['city'] ?? '')?>
                <?php if(!empty($order['postal_code'])): ?>
                  (<?=htmlspecialchars($order['postal_code'])?>)
                <?php endif; ?>
              </div>
            </div>
            <hr>
            <div class="mb-2">
              <div class="text-muted small">Người đặt hàng</div>
              <div>
                <?=htmlspecialchars($order['full_name'] ?? '')?><br>
                <?=htmlspecialchars($order['email'] ?? '')?>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Sản phẩm & tổng tiền -->
      <div class="col-lg-8">
        <div class="card card-lite mb-3">
          <div class="card-body">
            <h5 class="mb-3">Sản phẩm đã mua</h5>
            <div class="table-responsive">
              <table class="table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th class="text-center" style="width:80px;">SL</th>
                    <th class="text-end" style="width:140px;">Đơn giá</th>
                    <th class="text-end" style="width:140px;">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                <?php foreach($orderItems as $it): ?>
                  <tr>
                    <td>
                      <div class="d-flex align-items-center gap-2">
                        <!-- Ảnh sản phẩm -->
                        <img src="<?=htmlspecialchars($it['image_path'])?>" width="60" class="rounded border">
                        <div>
                          <div class="fw-semibold"><?=htmlspecialchars($it['name'])?></div>
                          <?php if(!empty($it['attrs_decoded'])): ?>
                            <div class="small text-muted">
                              <?php foreach($it['attrs_decoded'] as $k=>$v): ?>
                                <?=htmlspecialchars($k)?>: <?=htmlspecialchars($v)?>&nbsp;
                              <?php endforeach; ?>
                            </div>
                          <?php endif; ?>
                          <?php if(!empty($it['product_id'])): ?>
                            <div class="small">
                              <a href="product-detail.php?slug=<?=urlencode($it['product_slug'])?>" class="text-decoration-none">
                                Xem lại sản phẩm
                              </a>
                            </div>
                          <?php endif; ?>
                        </div>
                      </div>
                    </td>
                    <td class="text-center"><?=$it['qty']?></td>
                    <td class="text-end"><?=format_vnd($it['unit_price'])?></td>
                    <td class="text-end"><?=format_vnd($it['line_total'])?></td>
                  </tr>
                <?php endforeach; ?>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="card card-lite">
          <div class="card-body">
            <h5 class="mb-3">Tóm tắt thanh toán</h5>
            <div class="d-flex justify-content-between">
              <span>Tạm tính</span>
              <span><?=format_vnd($subtotal)?></span>
            </div>
            <div class="d-flex justify-content-between">
              <span>Thuế</span>
              <span><?=format_vnd($tax)?></span>
            </div>
            <div class="d-flex justify-content-between">
              <span>Phí vận chuyển</span>
              <span><?=format_vnd($shipping_fee)?></span>
            </div>
            <?php if ($discount_amount > 0): ?>
              <div class="d-flex justify-content-between text-success">
                <span>Giảm giá<?=$coupon_code ? ' ('.htmlspecialchars($coupon_code).')' : ''?></span>
                <span>-<?=format_vnd($discount_amount)?></span>
              </div>
            <?php endif; ?>
            <hr>
            <div class="d-flex justify-content-between fw-bold">
              <span>Tổng thanh toán</span>
              <span><?=format_vnd($total_amount)?></span>
            </div>
            <div class="mt-3">
              <a href="orders.php" class="btn btn-outline-secondary btn-sm">← Quay lại lịch sử đơn hàng</a>
              <a href="products.php" class="btn btn-brand btn-sm ms-2">Tiếp tục mua sắm</a>
            </div>
          </div>
        </div>

      </div>
    </div>

  </div>
</main>

<footer class="py-3 mt-4 bg-white border-top">
  <div class="container d-flex justify-content-between small text-muted">
    <span>E-Store.PC • Order Details</span>
    <span>Hiển thị hình ảnh sản phẩm trong đơn</span>
  </div>
</footer>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
