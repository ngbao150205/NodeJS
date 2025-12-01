<?php
require __DIR__.'/lib/api.php';

$apiBase = 'http://localhost:8080/api';

/**
 * 1) Thử thông báo server để huỷ token (nếu backend có endpoint /auth/logout)
 *    Bỏ qua lỗi nếu server chưa hỗ trợ.
 */
try {
  // api_call(method, url, payload, withAuth)
  api_call('POST', "$apiBase/auth/logout", null, true);
} catch (\Throwable $e) {
  // im lặng, vì mục tiêu chính là xoá token phía client
}

/**
 * 2) Xoá token phía client
 *    - Nếu lib/api.php đã có clear_token() thì dùng
 *    - Nếu chưa, fallback xoá cookie 'token'
 */
if (function_exists('clear_token')) {
  clear_token();
} else {
  if (session_status() === PHP_SESSION_NONE) { @session_start(); }
  // Xoá cookie token (tuỳ bạn set như thế nào trong set_token)
  setcookie('token', '', time() - 3600, '/');
  unset($_COOKIE['token']);
  // Nếu lưu token trong session
  unset($_SESSION['token']);
  @session_write_close();
}

/**
 * 3) Chuyển hướng về trang đăng nhập (hoặc index tuỳ bạn muốn)
 */
header('Location: index.php');
exit;
