<?php
// ==============================
// Config
// ==============================
if (!defined('API_BASE')) {
  // optional: bạn có thể require file config và define(API_BASE, 'http://localhost:8080/api');
  define('API_BASE', 'http://localhost:8080/api');
}

// ==============================
// Helpers: Cookie & Token
// Cập nhật tên cookie từ 'token' thành 'authToken' để nhất quán với JWT
// ==============================
function is_https() {
  if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') return true;
  if (!empty($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443) return true;
  if (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') return true;
  return false;
}

// Lấy token JWT từ cookie 'authToken'
function get_token() {
  return isset($_COOKIE['authToken']) ? (string)$_COOKIE['authToken'] : '';
}

// Lưu token JWT (HttpOnly, SameSite=Lax, tự bật Secure khi HTTPS)
// 🚨 Lưu ý: Hàm này đặt HttpOnly, nên JS không thể đọc được. Chỉ dùng cho PHP server-side.
function set_token($token) {
  $opts = [
    'expires'  => time() + 7 * 24 * 3600, // 7 ngày
    'path'     => '/',
    'secure'   => is_https(),
    'httponly' => true, 
    'samesite' => 'Lax',
  ];
  setcookie('authToken', (string)$token, $opts);
  // Cập nhật ngay trong request hiện tại
  $_COOKIE['authToken'] = (string)$token;
}

// Xoá token
function clear_token() {
  $opts = [
    'expires'  => time() - 3600,
    'path'     => '/',
    'secure'   => is_https(),
    'httponly' => true,
    'samesite' => 'Lax',
  ];
  setcookie('authToken', '', $opts);
  unset($_COOKIE['authToken']);
}

// ==============================
// HTTP client
// ==============================
// Trả về: [$code, $data]  (data là mảng JSON; nếu không parse được, trả ['message'=>rawBody])
function api_call($method, $url, $data = null, $withAuth = false) {
  $method = strtoupper($method);
  $headers = ['Content-Type: application/json', 'Accept: application/json'];

  if ($withAuth) {
    $t = get_token(); // 🚨 Lấy token từ Cookie
    if ($t) $headers[] = 'Authorization: Bearer ' . $t; // 🚨 Đính kèm token JWT
  }

  // ---------- cURL ----------
  if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
      CURLOPT_CUSTOMREQUEST   => $method,
      CURLOPT_RETURNTRANSFER  => true,
      CURLOPT_CONNECTTIMEOUT  => 5,
      CURLOPT_TIMEOUT         => 12,
      CURLOPT_FOLLOWLOCATION  => true,
      CURLOPT_HTTPHEADER      => $headers,
    ]);
    if ($data !== null) {
      $payload = json_encode($data, JSON_UNESCAPED_UNICODE);
      curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    }

    $res  = curl_exec($ch);
    $err  = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($res === false) {
      throw new Exception("HTTP error: $err");
    }
  } else {
    // ---------- Fallback: file_get_contents ----------
    $context = [
      'http' => [
        'method'  => $method,
        'header'  => implode("\r\n", $headers) . "\r\n",
        'timeout' => 12,
        'ignore_errors' => true, // để vẫn lấy được body khi HTTP code >= 400
      ]
    ];
    if ($data !== null) {
      $context['http']['content'] = json_encode($data, JSON_UNESCAPED_UNICODE);
    }
    $ctx = stream_context_create($context);
    $res = @file_get_contents($url, false, $ctx);
    // Lấy HTTP code từ $http_response_header
    $code = 0;
    if (isset($http_response_header) && is_array($http_response_header)) {
      foreach ($http_response_header as $line) {
        if (preg_match('#^HTTP/\d+\.\d+\s+(\d{3})#', $line, $m)) {
          $code = (int)$m[1];
          break;
        }
      }
    }
    if ($res === false) {
      throw new Exception("HTTP error: file_get_contents failed");
    }
  }

  // Parse JSON an toàn
  $decoded = json_decode($res, true);
  if (json_last_error() !== JSON_ERROR_NONE) {
    $decoded = ['message' => trim($res)];
  }

  return [$code, $decoded];
}