<?php
// orders.php - Lịch sử mua hàng
ini_set('display_errors',1);
ini_set('display_startup_errors',1);
error_reporting(E_ALL);

session_start();
require __DIR__.'/lib/api.php';

$apiBase = 'http://localhost:8080/api';

// ====== KẾT NỐI DB LOCAL ======
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

function format_vnd($n) {
    return number_format((int)$n, 0, ',', '.').'đ';
}

// ====== KIỂM TRA ĐĂNG NHẬP (TOKEN + /auth/me) ======
$isAuth     = false;
$authUser   = null;
$authUserId = null;
$authName   = '';
$authEmail  = '';

try {
    $t = get_token();
    if ($t) {
        [$cMe, $me] = api_call('GET', "$apiBase/auth/me", null, true);
        if ($cMe === 200 && !empty($me['user'])) {
            $isAuth     = true;
            $authUser   = $me['user'];
            $authUserId = $authUser['id'] ?? null;
            $authName   = $authUser['full_name'] ?? '';
            $authEmail  = $authUser['email']     ?? '';
        } else {
            clear_token();
        }
    }
} catch (Exception $e) {
    clear_token();
}

if (!$isAuth || !$authUserId) {
    // Bắt buộc đăng nhập để xem lịch sử
    header('Location: login.php?redirect=orders.php');
    exit;
}

// ====== PHÂN TRANG ĐƠN HÀNG ======
$page  = max(1, (int)($_GET['page'] ?? 1));
$limit = 10;
$offset= ($page - 1) * $limit;

$conn = db();

// Đếm tổng số đơn của user
$stmt = $conn->prepare("SELECT COUNT(*) AS cnt FROM orders WHERE user_id = ?");
$stmt->bind_param('i', $authUserId);
$stmt->execute();
$res = $stmt->get_result();
$row = $res->fetch_assoc();
$totalOrders = (int)($row['cnt'] ?? 0);
$stmt->close();

$totalPages = max(1, (int)ceil($totalOrders / $limit));

// Lấy danh sách đơn theo trang
$stmt = $conn->prepare("
    SELECT 
        id, created_at, status, 
        subtotal, tax, shipping_fee, discount_amount, total_amount, coupon_code
    FROM orders
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
");
$stmt->bind_param('iii', $authUserId, $limit, $offset);
$stmt->execute();
$res = $stmt->get_result();

$orders = [];
while ($r = $res->fetch_assoc()) {
    $orders[] = $r;
}
$stmt->close();

// Helper hiển thị trạng thái
function render_status_badge($status) {
    $status = strtolower((string)$status);
    switch ($status) {
        case 'paid':
        case 'completed':
            return '<span class="badge bg-success">Hoàn tất</span>';
        case 'cancelled':
        case 'canceled':
            return '<span class="badge bg-danger">Đã hủy</span>';
        case 'processing':
            return '<span class="badge bg-info text-dark">Đang xử lý</span>';
        default:
            return '<span class="badge bg-warning text-dark">Chờ xử lý</span>';
    }
}
?>
<!doctype html>
<html lang="vi" data-bs-theme="light">
<head>
  <meta charset="utf-8">
  <title>Lịch sử mua hàng | E-Store.PC</title>
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
        <li class="nav-item"><a class="nav-link" href="cart.php">Giỏ hàng</a></li>
        <li class="nav-item"><a class="nav-link active" href="orders.php">Đơn mua</a></li>
      </ul>
      <div class="d-flex gap-2">
        <span class="small text-muted me-2">👋 <?=htmlspecialchars($authName ?: $authEmail)?></span>
        <a href="logout.php" class="btn btn-sm btn-outline-danger">Đăng xuất</a>
      </div>
    </div>
  </div>
</nav>

<main class="py-4">
  <div class="container">

    <!-- TIÊU ĐỀ + NÚT QUAY LẠI HỒ SƠ -->
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h3 class="mb-0">Lịch sử mua hàng</h3>
      <a href="profile.php" class="btn btn-outline-secondary btn-sm">
        ← Quay lại hồ sơ
      </a>
    </div>

    <?php if ($totalOrders === 0): ?>
      <div class="alert alert-info">
        Bạn chưa có đơn hàng nào. <a href="products.php">Tiếp tục mua sắm</a>.
      </div>
    <?php else: ?>

      <div class="card border-0 shadow-sm">
        <div class="card-body">
          <div class="table-responsive">
            <table class="table align-middle">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Ngày đặt</th>
                  <th>Trạng thái</th>
                  <th class="text-end">Tổng thanh toán</th>
                  <th class="text-center">Mã giảm giá</th>
                  <th class="text-end"></th>
                </tr>
              </thead>
              <tbody>
              <?php foreach ($orders as $o): ?>
                <tr>
                  <td>#<?= (int)$o['id'] ?></td>
                  <td><?= htmlspecialchars($o['created_at'] ?? '') ?></td>
                  <td><?= render_status_badge($o['status'] ?? '') ?></td>
                  <td class="text-end"><?= format_vnd($o['total_amount'] ?? 0) ?></td>
                  <td class="text-center">
                    <?php if (!empty($o['coupon_code'])): ?>
                      <span class="badge bg-light text-dark">
                        <?= htmlspecialchars($o['coupon_code']) ?>
                      </span>
                    <?php else: ?>
                      <span class="text-muted small">Không dùng</span>
                    <?php endif; ?>
                  </td>
                  <td class="text-end">
                    <a href="order-detail.php?id=<?= (int)$o['id'] ?>" class="btn btn-sm btn-outline-primary">
                      Xem chi tiết
                    </a>
                  </td>
                </tr>
              <?php endforeach; ?>
              </tbody>
            </table>
          </div>

          <!-- PHÂN TRANG -->
          <nav aria-label="Page navigation">
            <ul class="pagination justify-content-center mb-0">
              <li class="page-item <?= $page <= 1 ? 'disabled' : '' ?>">
                <a class="page-link" href="orders.php?page=<?= max(1, $page-1) ?>">&laquo;</a>
              </li>

              <?php for ($i = 1; $i <= $totalPages; $i++): ?>
                <li class="page-item <?= $i == $page ? 'active' : '' ?>">
                  <a class="page-link" href="orders.php?page=<?= $i ?>"><?= $i ?></a>
                </li>
              <?php endfor; ?>

              <li class="page-item <?= $page >= $totalPages ? 'disabled' : '' ?>">
                <a class="page-link" href="orders.php?page=<?= min($totalPages, $page+1) ?>">&raquo;</a>
              </li>
            </ul>
          </nav>
        </div>
      </div>

    <?php endif; ?>
  </div>
</main>

<footer class="py-3 mt-4 bg-white border-top">
  <div class="container d-flex justify-content-between small text-muted">
    <span>E-Store.PC • Orders</span>
    <span>Xem lịch sử mua hàng</span>
  </div>
</footer>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
