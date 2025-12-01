<?php
require __DIR__.'/lib/api.php';
$apiBase = 'http://localhost:8080/api';

$msg = '';
if ($_SERVER['REQUEST_METHOD']==='POST') {
  $payload = [
    'email'    => trim($_POST['email'] ?? ''),
    'fullName' => trim($_POST['fullName'] ?? ''),
    'password' => (string)($_POST['password'] ?? ''),
    'address'  => [
      'label'   => 'Default',
      'details' => trim($_POST['details'] ?? ''),   // ✅ trùng cột addresses.details
      'district'=> trim($_POST['district'] ?? ''),  // ✅ trùng cột addresses.district
      'city'    => trim($_POST['city'] ?? ''),      // ✅ trùng cột addresses.city (tỉnh/thành)
    ]
  ];

  if ($payload['email']==='' || $payload['fullName']==='' || $payload['password']===''
      || $payload['address']['details']==='' || $payload['address']['district']==='' || $payload['address']['city']==='') {
    $msg = 'Vui lòng điền đầy đủ Email, Họ tên, Mật khẩu và 3 ô địa chỉ.';
  } else {
    try {
      [$code,$data] = api_call('POST', "$apiBase/auth/register", $payload, false);
      if ($code===200 && !empty($data['token'])) {
        set_token($data['token']);
        header('Location: index.php'); // hoặc profile.php
        exit;
      } else {
        $msg = $data['message'] ?? 'Đăng ký thất bại. Vui lòng kiểm tra thông tin.';
      }
    } catch(Exception $e){ $msg = $e->getMessage(); }
  }
}
?>
<!doctype html>
<html lang="vi" data-bs-theme="light">
<head>
  <meta charset="utf-8">
  <title>Đăng ký tài khoản</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- Bootstrap -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    :root{ --brand:#0ea5e9; --brand-600:#0284c7; }
    body{
      min-height:100vh;
      background: radial-gradient(circle at 20% -10%, #eef7ff, transparent 40%),
                  radial-gradient(circle at 100% 0, #f8f5ff, transparent 35%),
                  #f7fafc;
      color:#1f2937;
    }
    .auth-card{
      width:100%;
      max-width:720px;
      border:1px solid #e5e7eb;
      box-shadow:0 12px 24px rgba(2,132,199,.08);
      background:#fff;
    }
    .btn-brand{ background:var(--brand); border-color:var(--brand); }
    .btn-brand:hover{ background:var(--brand-600); border-color:var(--brand-600); }
    .text-muted-small{ font-size:.9rem; color:#6b7280; }
  </style>
</head>
<body>
  <div class="container d-flex align-items-center justify-content-center py-5" style="min-height:100vh;">
    <div class="card auth-card">
      <div class="card-body p-4 p-lg-5">
        <div class="d-flex justify-content-between align-items-start mb-3">
          <div>
            <h3 class="mb-1" style="color:var(--brand)">Tạo tài khoản</h3>
            <div class="text-muted">Chỉ bán PC & linh kiện • Mua không cần đăng nhập</div>
          </div>
          <a class="btn btn-outline-secondary" href="login.php">Đã có tài khoản?</a>
        </div>

        <?php if($msg): ?><div class="alert alert-danger"><?=$msg?></div><?php endif; ?>

        <!-- Form đăng ký -->
        <form method="post" class="row g-3">
          <div class="col-md-6">
            <label class="form-label">Email *</label>
            <input name="email" type="email" class="form-control" required>
          </div>
          <div class="col-md-6">
            <label class="form-label">Họ tên đầy đủ *</label>
            <input name="fullName" class="form-control" required>
          </div>
          <div class="col-md-6">
            <label class="form-label">Mật khẩu *</label>
            <input name="password" type="password" class="form-control" required>
            <div class="form-text">Tối thiểu 6 ký tự, nên gồm chữ & số.</div>
          </div>

          <div class="col-12"><hr class="my-2"></div>
          <div class="col-12">
            <h6 class="mb-0">Địa chỉ giao hàng mặc định</h6>
            <div class="text-muted-small">Bạn có thể thêm/sửa nhiều địa chỉ khác trong trang Hồ sơ.</div>
          </div>

          <div class="col-12">
            <label class="form-label">Địa chỉ cụ thể (Số nhà, đường) *</label>
            <input name="details" class="form-control" placeholder="Ví dụ: 123 Nguyễn Văn Cừ" required>
          </div>
          <div class="col-md-6">
            <label class="form-label">Quận/Huyện *</label>
            <input name="district" class="form-control" placeholder="Ví dụ: Quận 5" required>
          </div>
          <div class="col-md-6">
            <label class="form-label">Thành phố *</label>
            <input name="city" class="form-control" placeholder="Ví dụ: TP.HCM" required>
          </div>

          <div class="col-12 d-grid">
            <button class="btn btn-brand btn-lg">Đăng ký</button>
          </div>
        </form>

        <hr class="my-4">

        <!-- Đăng nhập MXH -->
        <div>
          <div class="text-muted mb-2">Hoặc đăng nhập nhanh bằng mạng xã hội</div>
          <div class="d-flex flex-column flex-sm-row gap-2">
            <a class="btn btn-danger flex-fill"  href="<?=$apiBase?>/auth/google">Google</a>
            <a class="btn btn-primary flex-fill" href="<?=$apiBase?>/auth/facebook">Facebook</a>
          </div>
        </div>

        <div class="text-muted-small mt-3">
          Bằng việc tiếp tục, bạn đồng ý với <a href="#" class="link-primary">Điều khoản</a> & <a href="#" class="link-primary">Chính sách bảo mật</a> của cửa hàng.
        </div>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
