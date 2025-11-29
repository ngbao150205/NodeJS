<?php
// --- DEBUG BẬT LỖI PHP (xong thì có thể tắt) ---
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Dùng tiện các hàm token + api_call
require __DIR__ . '/lib/api.php';

//
// 👉 NHẬN TOKEN TỪ GOOGLE REDIRECT
//    /index.php?token=JWT...
//
if (!empty($_GET['token'])) {
    // Lưu JWT vào cookie/session giống như login thường
    set_token($_GET['token']);

    // Redirect lại index.php để xoá token khỏi URL
    header('Location: index.php');
    exit;
}

// --- GỌI API BẰNG cURL (CHO /api/home) ---
$apiUrl = "http://localhost:8080/api/home";

function fetch_json($url) {
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 10,
        ]);
        $res  = curl_exec($ch);
        $err  = curl_error($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($res === false || $code >= 400) {
            throw new Exception("cURL error: $err (HTTP $code)");
        }

        return json_decode($res, true);
    } else {
        $res = @file_get_contents($url);
        if ($res === false) {
            throw new Exception("file_get_contents failed");
        }
        return json_decode($res, true);
    }
}

function format_price($n) {
    if (!$n && $n !== 0) return "Liên hệ";
    return number_format($n, 0, ',', '.') . "đ";
}

// --- KIỂM TRA TRẠNG THÁI ĐĂNG NHẬP ---
$isAuth   = false;
$userName = '';
$user     = null;   // 👈 thêm biến user
$err      = null;

try {
    $t = get_token(); // lấy token đã lưu (nếu có)

    if ($t) {
        // Gọi API /auth/me để lấy thông tin người dùng hiện tại
        [$code, $me] = api_call('GET', 'http://localhost:8080/api/auth/me', null, true);

        if ($code === 200 && !empty($me['user'])) {
            $isAuth   = true;
            $user     = $me['user']; // 👈 lưu lại toàn bộ user
            $userName = $user['full_name'] ?? ($user['email'] ?? 'Tài khoản');
        } else {
            // Token không hợp lệ -> xoá
            clear_token();
        }
    }
} catch (Exception $e) {
    // Có lỗi gì thì cũng coi như chưa đăng nhập
    clear_token();
}

// --- LẤY DỮ LIỆU HOME (NEW, BEST, CATEGORIES) ---
$home = [
    "newProducts" => [],
    "bestSellers" => [],
    "categories"  => [
        "laptops"    => [],
        "monitors"   => [],
        "hardDrives" => []
    ]
];

try {
    $home = fetch_json($apiUrl);
} catch (Exception $e) {
    $err = $e->getMessage();
}

// --- COMPONENT CARD (dùng chung cho các list) ---
function product_card($p) {
    $name  = $p['name'] ?? 'No name';
    $brand = $p['brand'] ?? '';
    $slug  = $p['slug'] ?? '';

    // 1) Ưu tiên ảnh tĩnh theo slug trong thư mục acess/product
    //    dạng: acess/product/<slug>-1.jpg
    $img = null;

    if ($slug !== '') {
        // Ảnh đầu tiên: slug-1.jpg
        $candidate1   = "acess/product/{$slug}-1.jpg";
        // Ảnh fallback: slug.jpg
        $candidateOne = "acess/product/{$slug}.jpg";

        if (file_exists(__DIR__ . '/' . $candidate1)) {
            $img = $candidate1;
        } elseif (file_exists(__DIR__ . '/' . $candidateOne)) {
            $img = $candidateOne;
        }
    }

    // 2) Nếu chưa tìm được ảnh tĩnh → fallback
    if ($img === null) {
        $img = 'acess/product/no-image.jpg';
    }

    // Trong /api/home backend đã map sẵn variants & giá
    $price       = $p['variants'][0]['price'] ?? ($p['price_min'] ?? null);
    $rating      = isset($p['avg_rating']) ? (float)$p['avg_rating'] : 0;
    $ratingCount = $p['total_reviews'] ?? 0;

    echo '
  <div class="col-6 col-md-4 col-lg-3 mb-4">
    <a href="product-detail.php?slug=' . htmlspecialchars($slug) . '" class="text-decoration-none text-reset">
      <div class="card h-100 border-0 product-card">
        <div class="ratio ratio-4x3">
          <img src="' . htmlspecialchars($img) . '" class="card-img-top" style="object-fit:cover" alt="' . htmlspecialchars($name) . '">
        </div>
        <div class="card-body d-flex flex-column">
          <div class="small text-muted">' . htmlspecialchars($brand) . '</div>
          <div class="fw-semibold text-truncate" title="' . htmlspecialchars($name) . '">' . htmlspecialchars($name) . '</div>
          <div class="d-flex justify-content-between align-items-center mt-1">
            <span class="price">' . format_price($price) . '</span>
            <small class="text-warning">★ ' . number_format($rating, 1) . ' <span class="text-muted">(' . (int)$ratingCount . ')</span></small>
          </div>
          <a href="cart.php?action=add&slug=' . htmlspecialchars($slug) . '" class="btn btn-sm btn-brand mt-3 w-100">Thêm vào giỏ</a>
        </div>
      </div>
    </a>
  </div>';
}
?>

<!doctype html>
<html lang="vi" data-bs-theme="light">
<head>
  <meta charset="utf-8">
  <title>E-Store PC | Trang chủ</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- Bootstrap -->
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
    .product-card{ transition:.18s ease; box-shadow:0 6px 14px rgba(0,0,0,.04);}
    .product-card:hover{
      transform:translateY(-4px);
      box-shadow:0 16px 32px rgba(2,132,199,.15);
    }
    .section-title{font-size:1.35rem; font-weight:700}
    .badge-soft{
      background:#e6f4ff; color:#0369a1; border:1px solid #bae6fd;
      text-transform:uppercase; letter-spacing:.12em; font-size:.65rem
    }
    .price{ color:var(--brand); font-weight:700 }
    .btn-brand{ background:var(--brand); border-color:var(--brand); }
    .btn-brand:hover{ background:var(--brand-600); border-color:var(--brand-600); }
    footer{ background:#ffffff; border-top:1px solid #e5e7eb; }
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
          <li class="nav-item"><a class="nav-link active" href="index.php">Trang chủ</a></li>
          <li class="nav-item"><a class="nav-link" href="products.php">Sản phẩm</a></li>
          <li class="nav-item"><a class="nav-link" href="cart.php">Giỏ hàng</a></li>

          <!-- 🔐 NÚT ADMIN: chỉ hiện khi đã đăng nhập & role = admin -->
          <?php if ($isAuth && ($user['role'] ?? '') === 'admin'): ?>
            <li class="nav-item ms-2">
              <a href="admin-dashboard.php" class="btn btn-sm btn-warning">Admin</a>
            </li>
          <?php endif; ?>
        </ul>

        <!-- ✅ Nút tài khoản: Ẩn/hiện theo trạng thái đăng nhập -->
        <div class="d-flex align-items-center gap-2">
          <?php if ($isAuth): ?>
            <div class="dropdown">
              <button class="btn btn-sm btn-outline-primary dropdown-toggle" data-bs-toggle="dropdown">
                👋 <?= htmlspecialchars($userName) ?>
              </button>
              <ul class="dropdown-menu dropdown-menu-end">
                <li><a class="dropdown-item" href="profile.php">Hồ sơ cá nhân</a></li>
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

  <section class="py-5">
    <div class="container">
      <!-- HERO -->
      <div class="row align-items-center g-4">
        <div class="col-lg-6">
          <span class="badge badge-soft mb-3">FINAL PROJECT • NODE.JS • E-COMMERCE</span>
          <h1 class="display-6 fw-bold mb-3">Website bán <span style="color:var(--brand)">máy tính & linh kiện PC</span></h1>
          <p class="lead text-muted">
            Chỉ bán PC & linh kiện (không bán điện thoại). 
            Xem & mua không cần đăng nhập, tài khoản sẽ tự tạo ở bước thanh toán.
          </p>
          <div class="d-flex gap-3">
            <a href="products.php" class="btn btn-brand btn-lg px-4">Mua ngay</a>
            <a href="#best-sellers" class="btn btn-outline-secondary btn-lg px-4">Xem Best Sellers</a>
          </div>
        </div>
        <div class="col-lg-6">
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <div class="ratio ratio-16x9 rounded" style="background:
                radial-gradient(circle at top, rgba(14,165,233,.20), transparent),
                radial-gradient(circle at bottom, rgba(99,102,241,.18), transparent);">
                <div class="h-100 d-flex flex-column justify-content-center align-items-center text-center">
                  <div class="small text-muted text-uppercase">Custom Gaming Rig</div>
                  <div class="h5">RTX • Ryzen • 32GB • 1TB NVMe</div>
                  <div class="small text-muted">Tối ưu cho coder & gamer</div>
                </div>
              </div>
              <div class="row g-2 small text-muted mt-3">
                <div class="col-4">
                  <div class="border rounded p-2 h-100 bg-light">
                    <div class="fw-semibold text-dark">Laptops</div><div>Học tập, lập trình</div>
                  </div>
                </div>
                <div class="col-4">
                  <div class="border rounded p-2 h-100 bg-light">
                    <div class="fw-semibold text-dark">Monitors</div><div>2K, 4K, 144Hz</div>
                  </div>
                </div>
                <div class="col-4">
                  <div class="border rounded p-2 h-100 bg-light">
                    <div class="fw-semibold text-dark">SSD / HDD</div><div>Nhanh & bền</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <?php if (!empty($err)): ?>
        <div class="alert alert-danger mt-4">Không gọi được API: <?=htmlspecialchars($err)?></div>
      <?php endif; ?>

      <!-- ================= SẢN PHẨM MỚi ================= -->
      <?php if (!empty($home['newProducts'])): ?>
      <section class="mt-5" id="new-products">
        <div class="d-flex justify-content-between align-items-end mb-3">
          <div>
            <h2 class="section-title">🔥 Sản phẩm mới</h2>
            <p class="text-muted mb-0">Những mẫu mới nhất cho học tập & gaming.</p>
          </div>
          <a href="products.php?sort=newest" class="link-primary small">Xem tất cả →</a>
        </div>
        <div class="row">
          <?php foreach (array_slice($home['newProducts'], 0, 4) as $p) product_card($p); ?>
        </div>
      </section>
      <?php endif; ?>

      <!-- ================= BEST SELLERS ================= -->
      <?php if (!empty($home['bestSellers'])): ?>
      <section class="mt-4" id="best-sellers">
        <div class="d-flex justify-content-between align-items-end mb-3">
          <div>
            <h2 class="section-title">🏆 Sản phẩm bán chạy</h2>
            <p class="text-muted mb-0">Top sản phẩm được mua nhiều nhất.</p>
          </div>
          <a href="products.php?sort=best" class="link-primary small">Xem tất cả →</a>
        </div>
        <div class="row">
          <?php foreach (array_slice($home['bestSellers'], 0, 4) as $p) product_card($p); ?>
        </div>
      </section>
      <?php endif; ?>

      <!-- ================= Laptops ================= -->
      <?php if (!empty($home['categories']['laptops'])): ?>
      <section class="mt-4" id="laptops">
        <div class="d-flex justify-content-between align-items-end mb-3">
          <div>
            <h2 class="section-title">💻 Laptops</h2>
            <p class="text-muted mb-0">Sinh viên, dev, designer, gamer…</p>
          </div>
          <a href="products.php?category=laptop" class="link-primary small">Xem tất cả →</a>
        </div>
        <div class="row">
          <?php foreach (array_slice($home['categories']['laptops'], 0, 4) as $p) product_card($p); ?>
        </div>
      </section>
      <?php endif; ?>

      <!-- ================= Monitors ================= -->
     <?php if (!empty($home['categories']['monitors'])): ?>
      <section class="mt-4" id="monitors">
        <div class="d-flex justify-content-between align-items-end mb-3">
          <div>
            <h2 class="section-title">🖥 Monitors</h2>
            <p class="text-muted mb-0">Độ phân giải cao, tần số quét mượt.</p>
          </div>
          <a href="products.php?category=monitor" class="link-primary small">Xem tất cả →</a>
        </div>
        <div class="row">
          <?php foreach (array_slice($home['categories']['monitors'], 0, 4) as $p) product_card($p); ?>
        </div>
      </section>
      <?php endif; ?>

      <!-- ================= Hard Drives & SSD ================= -->
      <?php if (!empty($home['categories']['hardDrives'])): ?>
      <section class="mt-4" id="hard-drives">
        <div class="d-flex justify-content-between align-items-end mb-3">
          <div>
            <h2 class="section-title">💾 SSD & Ổ cứng</h2>
            <p class="text-muted mb-0">Lưu trữ tốc độ cao & bền bỉ.</p>
          </div>
          <a href="products.php?category=hard-drive" class="link-primary small">Xem tất cả →</a>
        </div>
        <div class="row">
          <?php foreach (array_slice($home['categories']['hardDrives'], 0, 4) as $p) product_card($p); ?>
        </div>
      </section>
      <?php endif; ?>

    </div>
  </section>

  <footer class="py-3">
    <div class="container d-flex justify-content-between small text-muted">
      <span>E-Store.PC • Final Project</span>
      <span>Chỉ bán PC & linh kiện • No phones 🚫📱</span>
    </div>
  </footer>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
