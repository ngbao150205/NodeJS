<?php
require __DIR__.'/lib/api.php';
$apiBase='http://localhost:8080/api';
$msg='';
if($_SERVER['REQUEST_METHOD']==='POST'){
  $payload=['email'=>$_POST['email']??'','password'=>$_POST['password']??''];
  try{
    [$code,$data]=api_call('POST',"$apiBase/auth/login",$payload,false);
    if($code===200 && !empty($data['token'])){ set_token($data['token']); header('Location: index.php'); exit; }
    else $msg=$data['message']??'Đăng nhập thất bại';
  }catch(Exception $e){ $msg=$e->getMessage(); }
}
?>
<!doctype html>
<html lang="vi" data-bs-theme="light">
<head>
  <meta charset="utf-8">
  <title>Đăng nhập</title>
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
    }
    .btn-brand{ background:var(--brand); border-color:var(--brand); }
    .btn-brand:hover{ background:#0284c7; border-color:#0284c7; }
  </style>
</head>
<body>
  <div class="container d-flex align-items-center justify-content-center py-5" style="min-height:100vh;">
    <div class="card auth-card">
      <div class="card-body p-4">
        <h3 class="mb-3" style="color:var(--brand)">Đăng nhập</h3>

        <?php if($msg): ?>
          <div class="alert alert-danger"><?=$msg?></div>
        <?php endif; ?>

        <form method="post" class="row g-3">
          <div class="col-12">
            <label class="form-label">Email</label>
            <input name="email" class="form-control" required>
          </div>
          <div class="col-12">
            <label class="form-label">Mật khẩu</label>
            <input type="password" name="password" class="form-control" required>
          </div>
          <div class="col-12 d-grid">
            <button class="btn btn-brand">Đăng nhập</button>
          </div>
          <div class="col-12 d-flex gap-2">
            <a href="register.php" class="btn btn-outline-primary flex-fill">Đăng ký</a>
            <a href="forgot-password.php" class="btn btn-link">Quên mật khẩu?</a>
          </div>
        </form>

        <hr class="my-4">

        <div class="d-flex flex-column gap-2">
          <a class="btn btn-danger" href="http://localhost:8080/api/auth/google">Đăng nhập Google</a>
          <a class="btn btn-primary" href="http://localhost:8080/api/auth/facebook">Đăng nhập Facebook</a>
        </div>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
