<?php
// checkout.php
ini_set('display_errors',1);
ini_set('display_startup_errors',1);
error_reporting(E_ALL);

session_start();
require __DIR__.'/lib/api.php';

$apiBase = 'http://localhost:8080/api';

// ====== LẤY GIỎ HÀNG & CHỈ LẤY SẢN PHẨM ĐƯỢC CHỌN ======
$cartRaw = $_SESSION['cart']['items'] ?? [];
$cartItems = [];
foreach ($cartRaw as $key => $it) {
    if (!empty($it['selected'])) {
        $cartItems[$key] = $it;
    }
}

// Không có sản phẩm được chọn → quay lại giỏ
if (!$cartItems) {
    header('Location: cart.php?need_select=1');
    exit;
}

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

// ====== HÀM TÍNH TỔNG GIỎ (dùng mảng item truyền vào) ======
function cart_base_totals(array $items): array {
    $subtotal = 0;
    foreach ($items as $it) {
        $subtotal += (int)$it['price'] * (int)$it['qty'];
    }
    $tax = (int) round($subtotal * 0.10);
    $shipping = ($subtotal > 0 && $subtotal < 2000000) ? 30000 : 0;
    $total = $subtotal + $tax + $shipping;
    return compact('subtotal','tax','shipping','total');
}

/**
 * Tính tổng có áp dụng giảm giá % (percentOff).
 * percentOff: ví dụ 10 -> giảm 10% trên total.
 */
function cart_totals_with_percent(array $items, int $percentOff): array {
    $base = cart_base_totals($items);
    $discount = 0;
    if ($percentOff > 0) {
        $discount = (int) round($base['total'] * $percentOff / 100);
    }
    $final = max(0, $base['total'] - $discount);
    $base['discount'] = $discount;
    $base['final']    = $final;
    $base['percent']  = $percentOff;
    return $base;
}

function format_vnd($n) {
    return number_format((int)$n, 0, ',', '.').'đ';
}

// ====== KIỂM TRA ĐĂNG NHẬP (TOKEN + /auth/me) ======
$isAuth    = false;
$authUser  = null;
$authName  = '';
$authEmail = '';
$authUserId = null;

try {
    $t = get_token();
    if ($t) {
        [$cMe, $me] = api_call('GET', "$apiBase/auth/me", null, true);
        if ($cMe === 200 && !empty($me['user'])) {
            $isAuth    = true;
            $authUser  = $me['user'];
            $authUserId= $authUser['id'] ?? null;
            $authName  = $authUser['full_name'] ?? '';
            $authEmail = $authUser['email']     ?? '';
        } else {
            clear_token();
        }
    }
} catch (Exception $e) {
    clear_token();
}

// ====== LẤY ĐỊA CHỈ ĐÃ LƯU (NẾU ĐĂNG NHẬP) ======
$userAddresses  = [];
$defaultAddress = null;

if ($isAuth && $authUserId) {
    $conn = db();
    $stmt = $conn->prepare("
        SELECT * FROM addresses
        WHERE user_id = ?
        ORDER BY is_default DESC, created_at DESC
    ");
    $stmt->bind_param('i', $authUserId);
    $stmt->execute();
    $res = $stmt->get_result();
    while ($row = $res->fetch_assoc()) {
        $userAddresses[] = $row;
    }
    $stmt->close();

    if ($userAddresses) {
        foreach ($userAddresses as $row) {
            if ((int)$row['is_default'] === 1) {
                $defaultAddress = $row;
                break;
            }
        }
        if ($defaultAddress === null) {
            $defaultAddress = $userAddresses[0];
        }
    }
}

// ====== GIÁ TRỊ MẶC ĐỊNH CHO FORM ======
$billing_name   = $authName;
$billing_email  = $authEmail;

$receiver_name  = $defaultAddress['receiver_name'] ?? $authName;
$phone          = $defaultAddress['phone']         ?? '';
$details        = $defaultAddress['details']       ?? '';
$district       = $defaultAddress['district']      ?? '';
$city           = $defaultAddress['city']          ?? '';
$postal_code    = $defaultAddress['postal_code']   ?? '';
$address_label  = $defaultAddress['label']         ?? 'Default';

$chosenAddressId = $defaultAddress['id'] ?? '';

$errors = [];
$orderPlaced = false;
$orderId     = null;
$newAccountPassword = null;

// ====== QUẢN LÝ COUPON TRONG SESSION ======
if (!isset($_SESSION['coupon'])) {
    $_SESSION['coupon'] = null;
}
$couponSession = $_SESSION['coupon']; // ['code','percent_off']

// ====== XỬ LÝ AJAX: CHECK / REMOVE COUPON ======
$isAjax = isset($_SERVER['HTTP_X_REQUESTED_WITH']) &&
          strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest';

if ($isAjax && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';

    if ($action === 'check_coupon') {
        $code = strtoupper(trim($_POST['coupon_code'] ?? ''));
        $resp = ['ok' => false, 'message' => '', 'totals' => null];

        if ($code === '') {
            $resp['message'] = 'Vui lòng nhập mã giảm giá.';
        } elseif (!preg_match('/^[A-Z0-9]{5}$/', $code)) {
            $resp['message'] = 'Mã phải gồm 5 ký tự chữ hoặc số.';
        } else {
            $conn = db();
            $stmt = $conn->prepare("
                SELECT id, code, percent_off, max_uses, used_count
                FROM discount_codes
                WHERE code = ?
                LIMIT 1
            ");
            $stmt->bind_param('s', $code);
            $stmt->execute();
            $res = $stmt->get_result();
            $row = $res->fetch_assoc();
            $stmt->close();

            if (!$row) {
                $resp['message'] = 'Mã giảm giá không tồn tại.';
            } elseif ((int)$row['max_uses'] > 10) {
                $resp['message'] = 'Mã giảm giá không hợp lệ (max_uses > 10).';
            } elseif ((int)$row['used_count'] >= (int)$row['max_uses']) {
                $resp['message'] = 'Mã giảm giá đã hết lượt sử dụng.';
            } else {
                // OK -> lưu vào session
                $_SESSION['coupon'] = [
                    'code'        => $row['code'],
                    'percent_off' => (int)$row['percent_off'],
                ];
                $couponSession = $_SESSION['coupon'];

                $totals = cart_totals_with_percent($cartItems, $couponSession['percent_off']);
                $resp['ok']      = true;
                $resp['message'] = 'Áp dụng mã thành công. Giảm '.$couponSession['percent_off'].'%.';
                $resp['totals']  = $totals;
            }
        }

        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($resp);
        exit;
    }

    if ($action === 'remove_coupon') {
        $_SESSION['coupon'] = null;
        $couponSession = null;
        $totals = cart_totals_with_percent($cartItems, 0);

        $resp = [
            'ok'      => true,
            'message' => 'Đã huỷ mã giảm giá.',
            'totals'  => $totals,
        ];
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($resp);
        exit;
    }
}

// ====== XỬ LÝ SUBMIT ĐẶT HÀNG (KHÔNG AJAX) ======
if ($_SERVER['REQUEST_METHOD'] === 'POST' && !$isAjax) {
    $action = $_POST['action'] ?? '';

    if ($action === 'place_order') {
        // Lấy dữ liệu form
        $billing_name   = trim($_POST['billing_name']   ?? $billing_name);
        $billing_email  = trim($_POST['billing_email']  ?? $billing_email);
        $receiver_name  = trim($_POST['receiver_name']  ?? $receiver_name);
        $phone          = trim($_POST['phone']          ?? $phone);
        $details        = trim($_POST['details']        ?? $details);
        $district       = trim($_POST['district']       ?? $district);
        $city           = trim($_POST['city']           ?? $city);
        $postal_code    = trim($_POST['postal_code']    ?? $postal_code);
        $address_label  = trim($_POST['address_label']  ?? $address_label);
        $chosenAddressId= (int)($_POST['address_id']    ?? 0);

        // VALIDATE
        if ($billing_name === '') {
            $errors[] = 'Vui lòng nhập họ tên người mua.';
        }
        if (!filter_var($billing_email, FILTER_VALIDATE_EMAIL)) {
            $errors[] = 'Email không hợp lệ.';
        }
        if ($receiver_name === '') {
            $errors[] = 'Vui lòng nhập tên người nhận.';
        }
        if ($phone === '') {
            $errors[] = 'Vui lòng nhập số điện thoại.';
        }
        if ($details === '' || $district === '' || $city === '') {
            $errors[] = 'Vui lòng nhập đầy đủ địa chỉ (địa chỉ, quận/huyện, tỉnh/thành phố).';
        }

        // Nếu có lỗi -> không tạo đơn
        if (!$errors) {
            $conn = db();
            $conn->begin_transaction();

            try {
                // 1) Xác định / tạo user
                if ($isAuth && $authUserId) {
                    $finalUserId = (int)$authUserId;
                } else {
                    // Khách -> check email
                    $stmt = $conn->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
                    $stmt->bind_param('s', $billing_email);
                    $stmt->execute();
                    $res = $stmt->get_result();
                    $row = $res->fetch_assoc();
                    $stmt->close();

                    if ($row) {
                        $finalUserId = (int)$row['id'];
                    } else {
                        // Tạo tài khoản mới tự động
                        $plainPassword = bin2hex(random_bytes(4)); // 8 ký tự
                        $passwordHash  = password_hash($plainPassword, PASSWORD_BCRYPT);
                        $provider      = 'local';
                        $role          = 'customer';

                        $stmt = $conn->prepare("
                            INSERT INTO users (email, full_name, password_hash, provider, role, created_at, updated_at)
                            VALUES (?, ?, ?, ?, ?, NOW(), NOW())
                        ");
                        $stmt->bind_param('sssss', $billing_email, $billing_name, $passwordHash, $provider, $role);
                        $stmt->execute();
                        $finalUserId = (int)$conn->insert_id;
                        $stmt->close();

                        $newAccountPassword = $plainPassword;
                    }
                }

                // 2) Địa chỉ: lưu/ cập nhật
                $addressIdToUse = null;
                if (!empty($finalUserId)) {
                    if ($chosenAddressId > 0) {
                        // update địa chỉ đã chọn
                        $stmt = $conn->prepare("
                            UPDATE addresses
                            SET label = ?, receiver_name = ?, phone = ?, details = ?, district = ?, city = ?, postal_code = ?
                            WHERE id = ? AND user_id = ?
                        ");
                        $stmt->bind_param(
                            'sssssssii',
                            $address_label,
                            $receiver_name,
                            $phone,
                            $details,
                            $district,
                            $city,
                            $postal_code,
                            $chosenAddressId,
                            $finalUserId
                        );
                        $stmt->execute();
                        $stmt->close();
                        $addressIdToUse = $chosenAddressId;
                    } else {
                        // tạo địa chỉ mới
                        $isDefault = 0;
                        $stmt = $conn->prepare("SELECT COUNT(*) AS cnt FROM addresses WHERE user_id = ?");
                        $stmt->bind_param('i', $finalUserId);
                        $stmt->execute();
                        $res = $stmt->get_result();
                        $row = $res->fetch_assoc();
                        $stmt->close();
                        if ((int)$row['cnt'] === 0) {
                            $isDefault = 1;
                        }
                        if (!empty($_POST['set_default'])) {
                            $isDefault = 1;
                        }
                        if ($isDefault) {
                            $stmt = $conn->prepare("UPDATE addresses SET is_default = 0 WHERE user_id = ?");
                            $stmt->bind_param('i', $finalUserId);
                            $stmt->execute();
                            $stmt->close();
                        }
                        $stmt = $conn->prepare("
                            INSERT INTO addresses (
                                user_id, label, receiver_name, phone, details, district, city, postal_code, is_default, created_at, updated_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                        ");
                        $stmt->bind_param(
                            'isssssssi',
                            $finalUserId,
                            $address_label,
                            $receiver_name,
                            $phone,
                            $details,
                            $district,
                            $city,
                            $postal_code,
                            $isDefault
                        );
                        $stmt->execute();
                        $addressIdToUse = (int)$conn->insert_id;
                        $stmt->close();
                    }
                }

                // 3) Xử lý coupon (nếu có trong session)
                $couponRow       = null;
                $appliedCode     = null;
                $appliedPercent  = 0;
                $discountAmount  = 0;

                if (!empty($_SESSION['coupon'])) {
                    $couponSession = $_SESSION['coupon'];
                    $appliedCode   = $couponSession['code'];
                    $stmt = $conn->prepare("
                        SELECT id, code, percent_off, max_uses, used_count
                        FROM discount_codes
                        WHERE code = ?
                        LIMIT 1
                    ");
                    $stmt->bind_param('s', $appliedCode);
                    $stmt->execute();
                    $res = $stmt->get_result();
                    $couponRow = $res->fetch_assoc();
                    $stmt->close();

                    if (!$couponRow) {
                        throw new Exception('Mã giảm giá không còn tồn tại. Vui lòng kiểm tra lại.');
                    } elseif ((int)$couponRow['used_count'] >= (int)$couponRow['max_uses']) {
                        throw new Exception('Mã giảm giá đã hết lượt sử dụng. Vui lòng kiểm tra lại.');
                    } else {
                        $appliedPercent = (int)$couponRow['percent_off'];
                    }
                }

                // 4) Tính tổng cuối cùng với coupon (nếu có)
                $totals = cart_totals_with_percent($cartItems, $appliedPercent);
                $discountAmount = $totals['discount'];
                $finalAmount    = $totals['final'];

                // 5) Tạo đơn hàng
                $status = 'pending';
                $stmt = $conn->prepare("
                    INSERT INTO orders (
                        user_id, email, full_name,
                        receiver_name, phone,
                        address_details, district, city, postal_code,
                        subtotal, tax, shipping_fee, discount_amount, total_amount,
                        coupon_code, status, created_at
                    ) VALUES (
                        ?, ?, ?,
                        ?, ?,
                        ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?, NOW()
                    )
                ");
                $subtotal      = $totals['subtotal'];
                $tax           = $totals['tax'];
                $shipping_fee  = $totals['shipping'];
                $couponCodeDb  = $appliedCode;

                $stmt->bind_param(
                    'isssssssssiiiiss',
                    $finalUserId,
                    $billing_email,
                    $billing_name,
                    $receiver_name,
                    $phone,
                    $details,
                    $district,
                    $city,
                    $postal_code,
                    $subtotal,
                    $tax,
                    $shipping_fee,
                    $discountAmount,
                    $finalAmount,
                    $couponCodeDb,
                    $status
                );
                $stmt->execute();
                $orderId = (int)$conn->insert_id;
                $stmt->close();

                // 6) Lưu order_items & trừ tồn kho
                $stmtItem = $conn->prepare("
                    INSERT INTO order_items (
                        order_id, product_id, variant_id, name, attrs, unit_price, qty, line_total
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ");
                foreach ($cartItems as $it) {
                    $productId = (int)$it['product_id'];
                    $variantId = ($it['type'] === 'variant') ? (int)$it['id'] : 0;
                    $name      = $it['name'];
                    $attrsJson = !empty($it['attrs']) ? json_encode($it['attrs'], JSON_UNESCAPED_UNICODE) : null;
                    $unitPrice = (int)$it['price'];
                    $qty       = (int)$it['qty'];
                    $lineTotal = $unitPrice * $qty;

                    $stmtItem->bind_param(
                        'iiissiii',
                        $orderId,
                        $productId,
                        $variantId,
                        $name,
                        $attrsJson,
                        $unitPrice,
                        $qty,
                        $lineTotal
                    );
                    $stmtItem->execute();

                    if ($variantId > 0) {
                        $stmtStock = $conn->prepare("
                            UPDATE product_variants
                            SET stock = GREATEST(stock - ?, 0)
                            WHERE id = ?
                        ");
                        $stmtStock->bind_param('ii', $qty, $variantId);
                        $stmtStock->execute();
                        $stmtStock->close();
                    }
                }
                $stmtItem->close();

                // 7) Cập nhật used_count của coupon (nếu dùng)
                if ($couponRow) {
                    $stmt = $conn->prepare("
                        UPDATE discount_codes
                        SET used_count = used_count + 1
                        WHERE id = ?
                    ");
                    $cid = (int)$couponRow['id'];
                    $stmt->bind_param('i', $cid);
                    $stmt->execute();
                    $stmt->close();
                }

                $conn->commit();

                // Xoá giỏ, xoá coupon
                $_SESSION['cart']['items'] = [];
                $_SESSION['coupon'] = null;
                $cartItems = [];
                $couponSession = null;

                $orderPlaced = true;

            } catch (Exception $e) {
                $conn->rollback();
                $errors[] = $e->getMessage();
            }
        }
    }
}

// TÍNH TỔNG ĐỂ HIỂN THỊ
$percentOff = !empty($couponSession['percent_off']) ? (int)$couponSession['percent_off'] : 0;
$totalsShow = cart_totals_with_percent($cartItems, $percentOff);

?>
<!doctype html>
<html lang="vi" data-bs-theme="light">
<head>
  <meta charset="utf-8">
  <title>Thanh toán | E-Store.PC</title>
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
        <li class="nav-item"><a class="nav-link" href="cart.php">Giỏ hàng</a></li>
        <li class="nav-item"><a class="nav-link active" href="checkout.php">Thanh toán</a></li>
      </ul>
      <div class="d-flex gap-2">
        <?php if ($isAuth): ?>
          <span class="small text-muted me-2">👋 <?=htmlspecialchars($authName ?: $authEmail)?></span>
          <a href="logout.php" class="btn btn-sm btn-outline-danger">Đăng xuất</a>
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

    <?php if ($errors): ?>
      <div class="alert alert-danger">
        <ul class="mb-0">
          <?php foreach ($errors as $e): ?>
            <li><?=htmlspecialchars($e)?></li>
          <?php endforeach; ?>
        </ul>
      </div>
    <?php endif; ?>

    <?php if ($orderPlaced && $orderId): ?>
      <!-- TRANG CẢM ƠN -->
      <div class="card border-0 shadow-sm">
        <div class="card-body">
          <h3 class="mb-3 text-success">✅ Đặt hàng thành công!</h3>
          <p>Cảm ơn bạn đã mua hàng tại <strong>E-Store.PC</strong>.</p>
          <p>Mã đơn hàng của bạn là: <strong>#<?=$orderId?></strong></p>

          <?php if (!$isAuth && $newAccountPassword): ?>
            <div class="alert alert-info mt-3">
              <strong>Tài khoản đã được tạo tự động!</strong><br>
              Email đăng nhập: <code><?=htmlspecialchars($billing_email)?></code><br>
              Mật khẩu tạm thời: <code><?=htmlspecialchars($newAccountPassword)?></code><br>
              Vui lòng đăng nhập và đổi mật khẩu để xem lại các đơn hàng sau này.
            </div>
          <?php endif; ?>

          <a href="products.php" class="btn btn-brand mt-3">Tiếp tục mua sắm</a>
        </div>
      </div>
    <?php else: ?>

      <form method="post" id="checkoutForm">
        <input type="hidden" name="action" value="place_order">
        <input type="hidden" name="address_id" id="address_id" value="<?=htmlspecialchars($chosenAddressId)?>">

        <div class="row g-4">
          <!-- THÔNG TIN & ĐỊA CHỈ -->
          <div class="col-lg-7">
            <div class="card border-0 shadow-sm mb-3">
              <div class="card-body">
                <h5 class="mb-3">Thông tin khách hàng</h5>
                <div class="row g-3">
                  <div class="col-md-6">
                    <label class="form-label">Họ tên người mua</label>
                    <input name="billing_name" class="form-control"
                           value="<?=htmlspecialchars($billing_name)?>" required>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Email</label>
                    <input name="billing_email" type="email" class="form-control"
                           value="<?=htmlspecialchars($billing_email)?>" required>
                  </div>
                </div>
              </div>
            </div>

            <div class="card border-0 shadow-sm">
              <div class="card-body">
                <h5 class="mb-3">Địa chỉ giao hàng</h5>

                <?php if ($isAuth && $userAddresses): ?>
                  <div class="mb-3">
                    <label class="form-label">Chọn địa chỉ đã lưu</label>
                    <select class="form-select" id="savedAddressSelect">
                      <option value="">-- Chọn địa chỉ --</option>
                      <?php foreach ($userAddresses as $addr): ?>
                        <option
                          value="<?=$addr['id']?>"
                          data-receiver="<?=htmlspecialchars($addr['receiver_name'] ?? '', ENT_QUOTES)?>"
                          data-phone="<?=htmlspecialchars($addr['phone'] ?? '', ENT_QUOTES)?>"
                          data-details="<?=htmlspecialchars($addr['details'] ?? '', ENT_QUOTES)?>"
                          data-district="<?=htmlspecialchars($addr['district'] ?? '', ENT_QUOTES)?>"
                          data-city="<?=htmlspecialchars($addr['city'] ?? '', ENT_QUOTES)?>"
                          data-postal="<?=htmlspecialchars($addr['postal_code'] ?? '', ENT_QUOTES)?>"
                          <?=$addr['id'] == $chosenAddressId ? 'selected' : ''?>
                        >
                          <?=htmlspecialchars($addr['label'] ?: 'Địa chỉ '.$addr['id'])?> -
                          <?=htmlspecialchars($addr['details'])?>,
                          <?=htmlspecialchars($addr['district'])?>,
                          <?=htmlspecialchars($addr['city'])?>
                          <?php if ($addr['is_default']): ?> (Mặc định)<?php endif; ?>
                        </option>
                      <?php endforeach; ?>
                    </select>
                    <div class="form-text">
                      Chọn một địa chỉ để tự động điền các trường bên dưới. Bạn vẫn có thể chỉnh sửa sau khi chọn.
                    </div>
                  </div>
                <?php endif; ?>

                <div class="row g-3">
                  <div class="col-md-6">
                    <label class="form-label">Tên người nhận</label>
                    <input name="receiver_name" id="receiver_name" class="form-control"
                           value="<?=htmlspecialchars($receiver_name)?>" required>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Số điện thoại</label>
                    <input name="phone" id="phone" class="form-control"
                           value="<?=htmlspecialchars($phone)?>" required>
                  </div>
                  <div class="col-12">
                    <label class="form-label">Địa chỉ (số nhà, đường...)</label>
                    <input name="details" id="details" class="form-control"
                           value="<?=htmlspecialchars($details)?>" required>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Quận / Huyện</label>
                    <input name="district" id="district" class="form-control"
                           value="<?=htmlspecialchars($district)?>" required>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label">Tỉnh / Thành phố</label>
                    <input name="city" id="city" class="form-control"
                           value="<?=htmlspecialchars($city)?>" required>
                  </div>
                  <div class="col-md-2">
                    <label class="form-label">Mã bưu chính</label>
                    <input name="postal_code" id="postal_code" class="form-control"
                           value="<?=htmlspecialchars($postal_code)?>">
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Tên gợi nhớ (nhà, công ty,...)</label>
                    <input name="address_label" id="address_label" class="form-control"
                           value="<?=htmlspecialchars($address_label)?>">
                  </div>
                  <div class="col-md-6 d-flex align-items-end">
                    <div class="form-check">
                      <input class="form-check-input" type="checkbox" name="set_default" id="set_default">
                      <label class="form-check-label" for="set_default">
                        Đặt làm địa chỉ mặc định
                      </label>
                    </div>
                  </div>
                </div>

                <div class="alert alert-info mt-3 small mb-0">
                  Bạn <strong>không bắt buộc phải đăng nhập</strong> để mua hàng.
                  Nếu mua bằng email mới, hệ thống sẽ tự tạo tài khoản để bạn xem lại đơn trong tương lai.
                </div>
              </div>
            </div>
          </div>

          <!-- TÓM TẮT + MÃ GIẢM GIÁ -->
          <div class="col-lg-5">
            <div class="card border-0 shadow-sm mb-3">
              <div class="card-body">
                <h5 class="mb-3">Tóm tắt đơn hàng</h5>

                <div class="table-responsive">
                  <table class="table table-sm align-middle mb-3">
                    <tbody>
                    <?php foreach ($cartItems as $it): ?>
                      <tr>
                        <td style="width:60px;">
                          <img src="<?=htmlspecialchars($it['image'])?>" width="50" class="rounded">
                        </td>
                        <td>
                          <div class="fw-semibold"><?=htmlspecialchars($it['name'])?></div>
                          <?php if (!empty($it['attrs'])): ?>
                            <div class="small text-muted">
                              <?php foreach ($it['attrs'] as $k=>$v): ?>
                                <?=htmlspecialchars($k)?>: <?=htmlspecialchars($v)?>&nbsp;
                              <?php endforeach; ?>
                            </div>
                          <?php endif; ?>
                          <div class="small text-muted">x <?=$it['qty']?></div>
                        </td>
                        <td class="text-end fw-semibold">
                          <?=format_vnd($it['price'] * $it['qty'])?>
                        </td>
                      </tr>
                    <?php endforeach; ?>
                    </tbody>
                  </table>
                </div>

                <div class="d-flex justify-content-between">
                  <span>Tạm tính</span>
                  <span id="sumSubtotal"><?=format_vnd($totalsShow['subtotal'])?></span>
                </div>
                <div class="d-flex justify-content-between">
                  <span>Thuế (10%)</span>
                  <span id="sumTax"><?=format_vnd($totalsShow['tax'])?></span>
                </div>
                <div class="d-flex justify-content-between">
                  <span>Phí vận chuyển</span>
                  <span id="sumShipping"><?=format_vnd($totalsShow['shipping'])?></span>
                </div>

                <div class="d-flex justify-content-between text-success" id="discountRow" style="<?=$totalsShow['discount']>0?'':'display:none;'?>">
                  <span>Giảm giá (<span id="discountPercent"><?=$percentOff?></span>%)</span>
                  <span>-<span id="discountAmount"><?=format_vnd($totalsShow['discount'])?></span></span>
                </div>

                <hr>
                <div class="d-flex justify-content-between fw-bold">
                  <span>Tổng cộng</span>
                  <span id="sumFinal"><?=format_vnd($totalsShow['final'])?></span>
                </div>
              </div>
            </div>

            <div class="card border-0 shadow-sm">
              <div class="card-body">
                <h6>Mã giảm giá</h6>
                <div class="input-group mb-2">
                  <input name="coupon_code" id="coupon_code" class="form-control"
                         placeholder="Nhập mã (5 ký tự chữ + số)..."
                         value="<?=htmlspecialchars($couponSession['code'] ?? '')?>">
                  <button type="button" class="btn btn-outline-secondary" id="btnCheckCoupon">
                    Kiểm tra
                  </button>
                  <button type="button" class="btn btn-outline-danger" id="btnRemoveCoupon">
                    Hủy
                  </button>
                </div>
                <div class="small" id="couponMessage">
                  <?php if ($couponSession): ?>
                    <span class="text-success">
                      Đang áp dụng mã <?=htmlspecialchars($couponSession['code'])?>
                      (giảm <?=$percentOff?>%)
                    </span>
                  <?php else: ?>
                    Nhập mã giảm giá (do quản trị viên cung cấp) và bấm <strong>Kiểm tra</strong>.
                  <?php endif; ?>
                </div>

                <button class="btn btn-brand w-100 mt-3">
                  Xác nhận đặt hàng
                </button>
              </div>
            </div>

          </div>
        </div>
      </form>

    <?php endif; ?>
  </div>
</main>

<footer class="py-3 mt-4 bg-white border-top">
  <div class="container d-flex justify-content-between small text-muted">
    <span>E-Store.PC • Checkout</span>
    <span>Mã giảm giá có nút kiểm tra & hủy</span>
  </div>
</footer>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<script>
document.addEventListener('DOMContentLoaded', function () {
  const sel        = document.getElementById('savedAddressSelect');
  const addressId  = document.getElementById('address_id');
  const receiverEl = document.getElementById('receiver_name');
  const phoneEl    = document.getElementById('phone');
  const detailsEl  = document.getElementById('details');
  const districtEl = document.getElementById('district');
  const cityEl     = document.getElementById('city');
  const postalEl   = document.getElementById('postal_code');

  if (sel) {
    sel.addEventListener('change', function(){
      const opt = sel.options[sel.selectedIndex];
      if (!opt || !opt.value) {
        if (addressId) addressId.value = '';
        return;
      }
      if (addressId) addressId.value = opt.value;

      receiverEl.value = opt.dataset.receiver || '';
      phoneEl.value    = opt.dataset.phone    || '';
      detailsEl.value  = opt.dataset.details  || '';
      districtEl.value = opt.dataset.district || '';
      cityEl.value     = opt.dataset.city     || '';
      postalEl.value   = opt.dataset.postal   || '';
    });
  }

  // ====== MÃ GIẢM GIÁ (AJAX) ======
  const btnCheck   = document.getElementById('btnCheckCoupon');
  const btnRemove  = document.getElementById('btnRemoveCoupon');
  const inputCode  = document.getElementById('coupon_code');
  const msgEl      = document.getElementById('couponMessage');

  const sumSubtotalEl = document.getElementById('sumSubtotal');
  const sumTaxEl      = document.getElementById('sumTax');
  const sumShippingEl = document.getElementById('sumShipping');
  const sumFinalEl    = document.getElementById('sumFinal');
  const discountRow   = document.getElementById('discountRow');
  const discountAmountEl = document.getElementById('discountAmount');
  const discountPercentEl= document.getElementById('discountPercent');

  function formatVND(n) {
    return new Intl.NumberFormat('vi-VN').format(n) + 'đ';
  }

  async function postAjax(action, extra = {}) {
    const formData = new FormData();
    formData.append('action', action);
    for (const [k,v] of Object.entries(extra)) {
      formData.append(k, v);
    }
    const resp = await fetch('checkout.php', {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      body: formData
    });
    return await resp.json();
  }

  if (btnCheck) {
    btnCheck.addEventListener('click', async function () {
      const code = (inputCode.value || '').trim();
      if (!code) {
        msgEl.innerHTML = '<span class="text-danger">Vui lòng nhập mã giảm giá.</span>';
        return;
      }
      btnCheck.disabled = true;
      btnCheck.textContent = 'Đang kiểm tra...';
      try {
        const data = await postAjax('check_coupon', { coupon_code: code });
        if (data.ok) {
          msgEl.innerHTML = '<span class="text-success">'+ data.message +'</span>';
          if (data.totals) {
            sumSubtotalEl.textContent = formatVND(data.totals.subtotal);
            sumTaxEl.textContent      = formatVND(data.totals.tax);
            sumShippingEl.textContent = formatVND(data.totals.shipping);
            sumFinalEl.textContent    = formatVND(data.totals.final);

            if (data.totals.discount > 0) {
              discountRow.style.display = '';
              discountAmountEl.textContent = formatVND(data.totals.discount);
              discountPercentEl.textContent= data.totals.percent ?? '';
            } else {
              discountRow.style.display = 'none';
            }
          }
        } else {
          msgEl.innerHTML = '<span class="text-danger">'+ data.message +'</span>';
        }
      } catch (e) {
        console.error(e);
        msgEl.innerHTML = '<span class="text-danger">Có lỗi khi kiểm tra mã.</span>';
      } finally {
        btnCheck.disabled = false;
        btnCheck.textContent = 'Kiểm tra';
      }
    });
  }

  if (btnRemove) {
    btnRemove.addEventListener('click', async function () {
        btnRemove.disabled = true;
        try {
        const data = await postAjax('remove_coupon');
        if (data.ok && data.totals) {
            msgEl.innerHTML = '<span class="text-muted">Đã huỷ mã giảm giá.</span>';

            // Cập nhật lại các tổng
            sumSubtotalEl.textContent = formatVND(data.totals.subtotal);
            sumTaxEl.textContent      = formatVND(data.totals.tax);
            sumShippingEl.textContent = formatVND(data.totals.shipping);
            sumFinalEl.textContent    = formatVND(data.totals.final);

            // Hiện dòng giảm giá với 0% và 0đ
            const percent  = (typeof data.totals.percent !== 'undefined') ? data.totals.percent : 0;
            const discount = (typeof data.totals.discount !== 'undefined') ? data.totals.discount : 0;

            discountRow.style.display   = '';              // luôn hiển thị
            discountPercentEl.textContent = percent;       // 0
            discountAmountEl.textContent  = formatVND(discount); // 0đ
        }
        } catch (e) {
        console.error(e);
        msgEl.innerHTML = '<span class="text-danger">Không thể huỷ mã giảm giá.</span>';
        } finally {
        btnRemove.disabled = false;
        }
    });
    }   
});
</script>
</body>
</html>
