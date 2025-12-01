<?php
require __DIR__.'/lib/api.php';

$api = 'http://localhost:8080/api/auth/reset-password';
$msg = '';
$ok  = '';

// Lấy token từ link email
$token = $_GET['token'] ?? '';

if ($token === '') {
  $msg = 'Link đặt lại mật khẩu không hợp lệ hoặc thiếu token.';
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  // Lấy token từ input hidden (đã mang từ GET sang)
  $token = $_POST['token'] ?? '';
  $newPassword = (string)($_POST['newPassword'] ?? '');
  $confirmPassword = (string)($_POST['confirmPassword'] ?? '');

  if ($token === '') {
    $msg = 'Thiếu token đặt lại mật khẩu.';
  } elseif ($newPassword === '' || $confirmPassword === '') {
    $msg = 'Vui lòng nhập đầy đủ mật khẩu mới và xác nhận.';
  } elseif ($newPassword !== $confirmPassword) {
    $msg = 'Mật khẩu nhập lại không khớp.';
  } elseif (strlen($newPassword) < 6) {
    $msg = 'Mật khẩu mới phải có ít nhất 6 ký tự.';
  } else {
    try {
      [$code, $data] = api_call('POST', $api, [
        'token'       => $token,
        'newPassword' => $newPassword
      ], false);

      if ($code === 200) {
        $ok  = $data['message'] ?? 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập lại.';
        $msg = '';
      } else {
        $msg = $data['message'] ?? 'Đặt lại mật khẩu thất bại. Link có thể đã hết hạn.';
      }
    } catch (Exception $e) {
      $msg = 'Lỗi gọi API đặt lại mật khẩu: ' . $e->getMessage();
    }
  }
}
?>
<!doctype html>
<html lang="vi" data-bs-theme="light">
<head>
  <meta charset="utf-8">
  <title>Thiết lập mật khẩu mới</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- Bootstrap -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    :root{ --brand:#0ea5e9; }
    body{
      min-height:100vh;
      background: radial-gradient(circle at 20% -10%, #eef7ff, transparent 40%),
                  radial-gradient(circle at 100% 0, #f8f5ff, transparent 35%),
                  #f7fafc;
      color:#1f2937;
    }
    .auth-card{
      width:100%;
      max-width:520px;
      border:1px solid #e5e7eb;
      box-shadow:0 12px 24px rgba(2,132,199,.08);
      background:#fff;
    }
    .btn-brand{ background:var(--brand); border-color:var(--brand); }
    .btn-brand:hover{ background:#0284c7; border-color:#0284c7; }
  </style>
</head>
<body>
  <div class="container d-flex align-items-center justify-content-center py-5" style="min-height:100vh;">
    <div class="card auth-card">
      <div class="card-body p-4">
        <h3 class="mb-3" style="color:var(--brand)">Thiết lập mật khẩu mới</h3>

        <?php if($msg): ?>
          <div class="alert alert-danger"><?=$msg?></div>
        <?php endif; ?>

        <?php if($ok): ?>
          <div class="alert alert-success">
            <?=$ok?><br>
            <a href="login.php" class="btn btn-sm btn-primary mt-2">Đến trang đăng nhập</a>
          </div>
        <?php endif; ?>

        <?php if(!$ok): // chỉ hiện form khi chưa success ?>
        <form method="post" class="row g-3">
          <!-- mang token sang POST -->
          <input type="hidden" name="token" value="<?=htmlspecialchars($token, ENT_QUOTES, 'UTF-8')?>">

          <div class="col-12">
            <label class="form-label">Mật khẩu mới</label>
            <input type="password" name="newPassword" class="form-control" required>
          </div>
          <div class="col-12">
            <label class="form-label">Nhập lại mật khẩu mới</label>
            <input type="password" name="confirmPassword" class="form-control" required>
          </div>
          <div class="col-12 d-grid">
            <button class="btn btn-brand">Xác nhận mật khẩu mới</button>
          </div>
        </form>
        <?php endif; ?>

        <div class="mt-3">
          <a href="index.php" class="btn btn-link">Quay lại trang chủ</a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
