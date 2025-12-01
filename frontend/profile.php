<?php
require __DIR__.'/lib/api.php';
$apiBase='http://localhost:8080/api';
$msg=''; $ok='';

// Cập nhật tên hiển thị
if($_SERVER['REQUEST_METHOD']==='POST' && ($_POST['action']??'')==='update_profile'){
  try{
    [$code,$data]=api_call('PUT',"$apiBase/auth/profile",['fullName'=>$_POST['fullName']],true);
    $ok = ($code===200) ? 'Cập nhật thông tin thành công.' : ($data['message']??'Cập nhật thất bại');
  }catch(Exception $e){ $msg=$e->getMessage(); }
}

// Đổi mật khẩu
if($_SERVER['REQUEST_METHOD']==='POST' && ($_POST['action']??'')==='change_password'){
  try{
    [$code,$data]=api_call('POST',"$apiBase/auth/change-password",[
      'oldPassword'=>$_POST['oldPassword'],'newPassword'=>$_POST['newPassword']
    ],true);
    $ok = ($code===200) ? 'Đổi mật khẩu thành công.' : ($data['message']??'Đổi mật khẩu thất bại');
  }catch(Exception $e){ $msg=$e->getMessage(); }
}

// Thêm địa chỉ (CHỈ dùng details, district, city + receiver_name, phone, label, is_default)
if($_SERVER['REQUEST_METHOD']==='POST' && ($_POST['action']??'')==='add_address'){
  $payload = [
    'label'         => trim($_POST['label'] ?? 'Default'),
    'receiver_name' => trim($_POST['receiver_name'] ?? ''),
    'phone'         => trim($_POST['phone'] ?? ''),
    'details'       => trim($_POST['details'] ?? ''),   // địa chỉ cụ thể (bắt buộc)
    'district'      => trim($_POST['district'] ?? ''),  // quận/huyện (bắt buộc)
    'city'          => trim($_POST['city'] ?? ''),      // thành phố/tỉnh (bắt buộc)
    'is_default'    => isset($_POST['is_default']) ? 1 : 0
  ];
  try{
    // kiểm tra nhanh phía client
    if($payload['phone']==='' || $payload['details']==='' || $payload['district']==='' || $payload['city']===''){
      throw new Exception('Vui lòng nhập đầy đủ Địa chỉ, Quận/Huyện và Thành phố.');
    }
    api_call('POST',"$apiBase/addresses",$payload,true);
    $ok='Thêm địa chỉ thành công.';
  }catch(Exception $e){ $msg=$e->getMessage(); }
}

// Đặt mặc định
if(isset($_GET['set_default'])){
  try{ api_call('PUT',"$apiBase/addresses/".intval($_GET['set_default'])."/default",null,true); $ok='Đã đặt địa chỉ mặc định.'; }
  catch(Exception $e){ $msg=$e->getMessage(); }
}

// Xoá địa chỉ
if(isset($_GET['delete'])){
  try{ api_call('DELETE',"$apiBase/addresses/".intval($_GET['delete']),null,true); $ok='Đã xoá địa chỉ.'; }
  catch(Exception $e){ $msg=$e->getMessage(); }
}

// Tải thông tin người dùng + địa chỉ
[$c1,$me]  = api_call('GET',"$apiBase/auth/me",null,true);
[$c2,$addr]= api_call('GET',"$apiBase/addresses",null,true);
$user = $me['user'] ?? null;
$addresses = $addr['addresses'] ?? [];

if(!$user){ header('Location: login.php'); exit; }
?>
<!doctype html>
<html lang="vi" data-bs-theme="light">
<head>
  <meta charset="utf-8">
  <title>Hồ sơ cá nhân</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- Bootstrap -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    :root{ --brand:#0ea5e9; --brand-600:#0284c7; }
    body{
      background: radial-gradient(circle at 20% -10%, #eef7ff, transparent 40%),
                  radial-gradient(circle at 100% 0, #f8f5ff, transparent 35%),
                  #f7fafc;
      color:#1f2937;
    }
    .btn-brand{ background:var(--brand); border-color:var(--brand); }
    .btn-brand:hover{ background:var(--brand-600); border-color:var(--brand-600); }
    .card-lite{ border:0; box-shadow:0 10px 24px rgba(2,132,199,.08); }
    .navbar{ background:#fff; border-bottom:1px solid #e5e7eb; }
    .badge-soft{ background:#e6f4ff; color:#0369a1; border:1px solid #bae6fd; }
  </style>
</head>
<body>
  <!-- Navbar nhỏ gọn -->
  <nav class="navbar">
    <div class="container d-flex justify-content-between">
      <a class="navbar-brand fw-bold" style="color:var(--brand)" href="index.php">E-Store<span class="text-dark">.PC</span></a>
      <div class="d-flex gap-2">
        <a class="btn btn-outline-secondary" href="index.php">Trang Chủ</a>
      </div>
    </div>
  </nav>

  <div class="container py-4">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <div>
        <span class="badge badge-soft">TÀI KHOẢN</span>
        <h3 class="mt-2 mb-0">Hồ sơ cá nhân</h3>
        <div class="text-muted">Quản lý thông tin, mật khẩu & địa chỉ giao hàng</div>
        <?php if ($isAuth && ($authUser['role'] ?? '') === 'admin'): ?>
            <a href="admin-dashboard.php" class="btn btn-sm btn-warning">Admin</a>
        <?php endif; ?>
      </div>
      <div class="text-end">
        <div class="small text-muted mb-2">
          Đăng nhập: <strong><?=htmlspecialchars($user['email']??'')?></strong>
        </div>
        <!-- NÚT XEM LỊCH SỬ MUA HÀNG -->
        <a href="orders.php" class="btn btn-sm btn-outline-primary">
          Xem lịch sử mua hàng
        </a>
      </div>
    </div>

    <?php if($msg): ?><div class="alert alert-danger"><?=$msg?></div><?php endif; ?>
    <?php if($ok):  ?><div class="alert alert-success"><?=$ok?></div><?php endif; ?>

    <div class="row g-4">
      <!-- Thông tin cá nhân -->
      <div class="col-lg-6">
        <div class="card card-lite">
          <div class="card-body">
            <h5 class="mb-3">Thông tin cá nhân</h5>
            <form method="post" class="row g-3">
              <input type="hidden" name="action" value="update_profile">
              <div class="col-12">
                <label class="form-label">Email</label>
                <input class="form-control" value="<?=htmlspecialchars($user['email'])?>" disabled>
              </div>
              <div class="col-12">
                <label class="form-label">Họ tên</label>
                <input name="fullName" class="form-control" value="<?=htmlspecialchars($user['full_name'])?>">
              </div>
              <div class="col-12 d-grid d-md-block">
                <button class="btn btn-brand">Lưu thay đổi</button>
              </div>
            </form>
          </div>
        </div>

        <div class="card card-lite mt-3">
          <div class="card-body">
            <h5 class="mb-3">Đổi mật khẩu</h5>
            <form method="post" class="row g-3">
              <input type="hidden" name="action" value="change_password">
              <div class="col-12">
                <label class="form-label">Mật khẩu cũ</label>
                <input type="password" name="oldPassword" class="form-control" placeholder="Nhập mật khẩu hiện tại">
              </div>
              <div class="col-12">
                <label class="form-label">Mật khẩu mới</label>
                <input type="password" name="newPassword" class="form-control" placeholder="Mật khẩu mới">
              </div>
              <div class="col-12 d-grid d-md-block">
                <button class="btn btn-warning">Đổi mật khẩu</button>
                <a class="btn btn-link" href="forgot-password.php?email=<?=urlencode($user['email'] ?? '')?>">
                  Khôi phục mật khẩu?
                </a>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Địa chỉ giao hàng -->
      <div class="col-lg-6">
        <div class="card card-lite">
          <div class="card-body">
            <h5 class="mb-3">Địa chỉ giao hàng</h5>

            <?php if(!$addresses): ?>
              <div class="alert alert-info">Chưa có địa chỉ. Thêm địa chỉ mới bên dưới.</div>
            <?php endif; ?>

            <?php foreach($addresses as $a): ?>
              <div class="border rounded p-3 mb-2 bg-white">
                <div class="d-flex justify-content-between align-items-start">
                  <div class="pe-2">
                    <div class="d-flex align-items-center gap-2">
                      <strong><?=htmlspecialchars($a['label'])?></strong>
                      <?php if(!empty($a['is_default'])): ?>
                        <span class="badge text-bg-primary">Mặc định</span>
                      <?php endif; ?>
                    </div>
                    <div class="text-muted small mt-1">
                      <?=htmlspecialchars($a['receiver_name'])?><?= $a['phone'] ? ' • '.htmlspecialchars($a['phone']) : '' ?><br>
                      <?=htmlspecialchars($a['details'])?>,
                      <?=htmlspecialchars($a['district'])?>,
                      <?=htmlspecialchars($a['city'])?>
                    </div>
                  </div>
                  <div class="text-end">
                    <?php if(empty($a['is_default'])): ?>
                      <a class="btn btn-sm btn-outline-primary" href="?set_default=<?=$a['id']?>">Đặt mặc định</a>
                    <?php endif; ?>
                    <a class="btn btn-sm btn-outline-danger"
                       href="?delete=<?=$a['id']?>"
                       onclick="return confirm('Xác nhận xoá địa chỉ này?');">Xoá</a>
                  </div>
                </div>
              </div>
            <?php endforeach; ?>

            <hr class="my-4">
            <h6 class="mb-3">Thêm địa chỉ mới</h6>
            <form method="post" class="row g-3">
              <input type="hidden" name="action" value="add_address">
              <div class="col-sm-6">
                <label class="form-label">Nhãn</label>
                <input name="label" class="form-control" placeholder="Nhà / Công ty" value="Default">
              </div>
              <div class="col-sm-6">
                <label class="form-label">Người nhận</label>
                <input name="receiver_name" class="form-control" placeholder="Nguyễn Văn A">
              </div>
              <div class="col-sm-6">
                <label class="form-label">Điện thoại</label>
                <input name="phone" class="form-control" placeholder="09xx xxx xxx" required>
              </div>

              <div class="col-12">
                <label class="form-label">Địa chỉ cụ thể *</label>
                <input name="details" class="form-control" placeholder="Số nhà, đường..." required>
              </div>
              <div class="col-sm-6">
                <label class="form-label">Quận/Huyện *</label>
                <input name="district" class="form-control" placeholder="VD: Quận 5 / Huyện Nhà Bè" required>
              </div>
              <div class="col-sm-6">
                <label class="form-label">Thành phố/Tỉnh *</label>
                <input name="city" class="form-control" placeholder="VD: TP.HCM / Hà Nội / Đà Nẵng" required>
              </div>

              <div class="col-sm-6 d-flex align-items-end">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" name="is_default" id="isDefault">
                  <label for="isDefault" class="form-check-label">Đặt làm mặc định</label>
                </div>
              </div>

              <div class="col-12 d-grid d-md-block">
                <button class="btn btn-success">Thêm địa chỉ</button>
              </div>
            </form>

          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Optional: JS -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
