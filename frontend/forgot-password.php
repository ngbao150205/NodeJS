<?php
require __DIR__.'/lib/api.php';
$api='http://localhost:8080/api/auth/forgot-password';
$msg=''; $ok='';

// Lấy email để auto-fill (ưu tiên: ?email=..., sau đó nếu POST lỗi thì giữ lại)
$prefillEmail = $_GET['email'] ?? '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $prefillEmail = $_POST['email'] ?? $prefillEmail;
  try{
    [$code,$data]=api_call('POST',$api,['email'=>$_POST['email']],false);
    $ok=$data['message']??'Nếu email tồn tại, link đặt lại đã được gửi';
  }catch(Exception $e){ $msg=$e->getMessage(); }
}
?>
<!doctype html>
<html lang="vi" data-bs-theme="light">
<head>
  <meta charset="utf-8">
  <title>Quên mật khẩu</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- Bootstrap -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <style> ... giữ nguyên ... </style>
</head>
<body>
  <div class="container d-flex align-items-center justify-content-center py-5" style="min-height:100vh;">
    <div class="card auth-card">
      <div class="card-body p-4">
        <h3 class="mb-3" style="color:var(--brand)">Quên mật khẩu</h3>

        <?php if($msg): ?><div class="alert alert-danger"><?=$msg?></div><?php endif; ?>
        <?php if($ok):  ?><div class="alert alert-success"><?=$ok?></div><?php endif; ?>

        <form method="post" class="row g-3">
          <div class="col-12">
            <label class="form-label">Email</label>
            <input
              name="email"
              class="form-control"
              placeholder="Email"
              required
              value="<?=htmlspecialchars($prefillEmail)?>">
          </div>
          <div class="col-12 d-grid">
            <button class="btn btn-brand">Gửi link đặt lại</button>
          </div>
        </form>

        <div class="mt-3">
          <a href="index.php" class="btn btn-link">Quay lại trang chủ</a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
