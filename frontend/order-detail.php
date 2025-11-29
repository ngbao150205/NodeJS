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

function human_status_label(string $status): string {
    $statusLower = strtolower($status);
    switch ($statusLower) {
        case 'paid':
        case 'completed':
        case 'delivered':
            return 'Hoàn tất';
        case 'shipping':
        case 'shipped':
        case 'on-delivery':
            return 'Đang giao';
        case 'processing':
            return 'Đang xử lý';
        case 'cancelled':
        case 'canceled':
            return 'Đã huỷ';
        case 'pending':
        default:
            return 'Chờ xử lý';
    }
}

// ====== LẤY ID ĐƠN HÀNG TỪ QUERY ======
$orderId = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if ($orderId <= 0) {
    echo "Thiếu ID đơn hàng.";
    exit;
}

// ====== KIỂM TRA ĐĂNG NHẬP ======
$isAuth     = false;
$authUser   = null;
$authName   = '';
$authEmail  = '';
$authUserId = null;
$msg        = '';

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
    // redirect kèm lại link đơn hàng
    $redirectUrl = 'order-details.php?id=' . $orderId;
    header('Location: login.php?redirect='.urlencode($redirectUrl));
    exit;
}

$conn = db();

// ====== LẤY THÔNG TIN ĐƠN HÀNG (CHỈ CHO CHỦ ĐƠN) ======
$sqlOrder = "
    SELECT *
    FROM orders
    WHERE id = ? AND user_id = ?
    LIMIT 1
";
$stmt = $conn->prepare($sqlOrder);
if (!$stmt) {
    die('Lỗi SQL (order): '.$conn->error);
}
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
$sqlItems = "
    SELECT 
        oi.*,
        p.slug AS product_slug
    FROM order_items oi
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ?
";
$stmt = $conn->prepare($sqlItems);
if (!$stmt) {
    die('Lỗi SQL (order_items): '.$conn->error);
}
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

// ====== LẤY LỊCH SỬ TRẠNG THÁI ĐƠN HÀNG ======
$statusHistory = [];
$sqlHist = "
    SELECT status, note, created_at
    FROM order_status_history
    WHERE order_id = ?
    ORDER BY created_at DESC
";
$stmtHist = $conn->prepare($sqlHist);
if ($stmtHist) {
    $stmtHist->bind_param('i', $orderId);
    $stmtHist->execute();
    $resHist = $stmtHist->get_result();
    while ($row = $resHist->fetch_assoc()) {
        $statusHistory[] = $row;
    }
    $stmtHist->close();
}
$hasHistory = !empty($statusHistory);

// ====== TÍNH TOÁN ĐƠN & ĐIỂM THƯỞNG ======
$subtotal        = (int)$order['subtotal'];
$tax             = (int)$order['tax'];
$shipping_fee    = (int)$order['shipping_fee'];
$discount_amount = (int)$order['discount_amount'];
$total_amount    = (int)$order['total_amount'];
$coupon_code     = $order['coupon_code'];
$status          = $order['status'];

$loyaltyUsed     = (int)($order['loyalty_points_used']   ?? 0);
$loyaltyEarned   = (int)($order['loyalty_points_earned'] ?? 0);
$pointDiscount   = (int)($order['point_discount']        ?? 0);
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
<nav class="navbar navbar-expand-lg sticky-top">
  <div class="container">
    <a class="navbar-brand fw-bold" style="color:var(--brand)" href="index.php">
      E-Store<span class="text-dark">.PC</span>
    </a>
    <button class="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#nav">
      <span class="navbar-toggler-icon"></span>
    </button>
    <div class="collapse navbar-collapse" id="nav">
      <ul class="navbar-nav me-auto">
        <li class="nav-item"><a class="nav-link" href="index.php">Trang chủ</a></li>
        <li class="nav-item"><a class="nav-link" href="products.php">Sản phẩm</a></li>
        <li class="nav-item"><a class="nav-link" href="cart.php">Giỏ hàng</a></li>
        <li class="nav-item"><a class="nav-link active" href="orders.php">Đơn mua</a></li>
      </ul>
      <div class="d-flex align-items-center gap-2">
        <?php if ($isAuth): ?>
          <div class="dropdown">
            <button class="btn btn-sm btn-outline-primary dropdown-toggle" data-bs-toggle="dropdown">
              👋 <?= htmlspecialchars($authName ?: $authEmail) ?>
            </button>
            <ul class="dropdown-menu dropdown-menu-end">
              <li><a class="dropdown-item" href="profile.php">Hồ sơ cá nhân</a></li>
              <li><a class="dropdown-item" href="orders.php">Đơn mua</a></li>
              <li><hr class="dropdown-divider"></li>
              <li><a class="dropdown-item text-danger" href="logout.php">Đăng xuất</a></li>
            </ul>
          </div>
        <?php else: ?>
          <a href="login.php" class="btn btn-sm btn-outline-primary">Đăng nhập</a>
          <a href="register.php" class="btn btn-sm btn-brand">Đăng ký</a>
        <?php endif; ?>
      </div>
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
        <div class="mb-1">
          Trạng thái:
          <?php
          $badgeClass  = 'secondary';
          $statusLabel = human_status_label((string)$status);
          $sLower      = strtolower((string)$status);
          if (in_array($sLower, ['paid','completed','delivered'], true)) {
              $badgeClass = 'success';
          } elseif (in_array($sLower, ['shipping','shipped','on-delivery'], true)) {
              $badgeClass = 'info';
          } elseif (in_array($sLower, ['cancelled','canceled'], true)) {
              $badgeClass = 'danger';
          } elseif ($sLower === 'processing') {
              $badgeClass = 'primary';
          } elseif ($sLower === 'pending') {
              $badgeClass = 'warning';
          }
          ?>
          <span class="badge text-bg-<?=$badgeClass?>">
            <?=htmlspecialchars($statusLabel)?>
          </span>
        </div>
        <div class="mt-1">
          Tổng tiền: <strong><?=format_vnd($total_amount)?></strong>
        </div>

        <?php if ($hasHistory): ?>
          <!-- NÚT MỞ MODAL LỊCH SỬ TRẠNG THÁI -->
          <button type="button"
                  class="btn btn-sm btn-outline-secondary mt-2"
                  data-bs-toggle="modal"
                  data-bs-target="#statusHistoryModal">
            Xem lịch sử trạng thái
          </button>
        <?php endif; ?>
      </div>
    </div>

    <?php if($msg): ?>
      <div class="alert alert-danger"><?=$msg?></div>
    <?php endif; ?>

    <div class="row g-4">
      <!-- Thông tin giao hàng -->
      <div class="col-lg-4">
        <div class="card card-lite">
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

        <!-- GỢI Ý XEM LỊCH SỬ -->
        <div class="card card-lite mt-3">
          <div class="card-body small text-muted">
            Bạn có thể xem <strong>lịch sử trạng thái đơn hàng</strong> (đang chờ xử lý, đã xác nhận, đang giao, đã giao...)
            bằng cách bấm nút <strong>"Xem lịch sử trạng thái"</strong> ở phía trên.
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
                          <?php if(!empty($it['product_id']) && !empty($it['product_slug'])): ?>
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
                <span>Giảm giá<?= $coupon_code ? ' (Mã '.htmlspecialchars($coupon_code).')' : '' ?></span>
                <span>-<?=format_vnd($discount_amount)?></span>
              </div>
            <?php endif; ?>

            <?php if ($loyaltyUsed > 0 || $pointDiscount > 0): ?>
              <div class="d-flex justify-content-between text-success">
                <span>Giảm từ điểm thưởng (<?= $loyaltyUsed ?> điểm)</span>
                <span>-<?=format_vnd($pointDiscount)?></span>
              </div>
            <?php endif; ?>

            <hr>
            <div class="d-flex justify-content-between fw-bold">
              <span>Tổng thanh toán</span>
              <span><?=format_vnd($total_amount)?></span>
            </div>

            <?php if ($loyaltyEarned > 0): ?>
              <div class="mt-2 small text-success">
                Bạn đã được cộng <strong><?= $loyaltyEarned ?> điểm thưởng</strong> cho đơn hàng này.
                Điểm có thể dùng để giảm giá cho các đơn hàng tiếp theo.
              </div>
            <?php endif; ?>

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
    <span>Chi tiết đơn, trạng thái & điểm thưởng</span>
  </div>
</footer>

<!-- MODAL LỊCH SỬ TRẠNG THÁI ĐƠN HÀNG -->
<div class="modal fade" id="statusHistoryModal" tabindex="-1" aria-labelledby="statusHistoryLabel" aria-hidden="true">
  <div class="modal-dialog modal-dialog-scrollable modal-lg">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="statusHistoryLabel">
          Lịch sử trạng thái đơn hàng #<?=htmlspecialchars($orderId)?>
        </h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Đóng"></button>
      </div>
      <div class="modal-body">
        <?php if ($statusHistory): ?>
          <p class="small text-muted">
            Các lần cập nhật trạng thái, <strong>mới nhất hiển thị trước</strong>.
          </p>
          <div class="list-group">
            <?php foreach ($statusHistory as $h): ?>
              <div class="list-group-item">
                <div class="d-flex justify-content-between">
                  <div>
                    <strong><?=htmlspecialchars(human_status_label($h['status']))?></strong>
                    <?php if (!empty($h['note'])): ?>
                      <div class="small text-muted"><?=htmlspecialchars($h['note'])?></div>
                    <?php endif; ?>
                  </div>
                  <div class="small text-muted text-end">
                    <?=htmlspecialchars($h['created_at'])?>
                  </div>
                </div>
              </div>
            <?php endforeach; ?>
          </div>
        <?php else: ?>
          <div class="alert alert-secondary small mb-0">
            Chưa có lịch sử trạng thái chi tiết cho đơn hàng này.  
            Trạng thái hiện tại: <strong><?=htmlspecialchars($statusLabel)?></strong>.
          </div>
        <?php endif; ?>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline-secondary btn-sm" data-bs-dismiss="modal">Đóng</button>
      </div>
    </div>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
