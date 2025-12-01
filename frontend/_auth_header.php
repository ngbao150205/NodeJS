<?php
// _auth_header.php
// Dùng chung cho mọi trang để biết user đã đăng nhập chưa

// Yêu cầu: trước khi require file này, bạn đã có $apiBase và require lib/api.php

if (!isset($isAuth))   $isAuth   = false;
if (!isset($userName)) $userName = '';

try {
    $t = get_token();
    if ($t) {
        [$cMe, $me] = api_call('GET', "$apiBase/auth/me", null, true);
        if ($cMe === 200 && !empty($me['user'])) {
            $isAuth   = true;
            $userRaw  = $me['user'];
            $userName = $userRaw['full_name'] ?? ($userRaw['email'] ?? 'Tài khoản');
        } else {
            clear_token();
        }
    }
} catch (Exception $e) {
    clear_token();
}
