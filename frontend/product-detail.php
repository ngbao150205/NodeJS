<?php
// product-detail.php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require __DIR__.'/lib/api.php';
$apiBase = 'http://localhost:8080/api';

// Lấy slug từ query
$slug = trim($_GET['slug'] ?? '');
if ($slug === '') {
  http_response_code(400);
  echo "Thiếu slug sản phẩm.";
  exit;
}

$msg = '';
$ok  = '';

// ========== KIỂM TRA ĐĂNG NHẬP ==========
$isAuth   = false;
$userName = '';

try {
  $t = get_token();
  if ($t) {
    [$cMe, $me] = api_call('GET', "$apiBase/auth/me", null, true);
    if ($cMe === 200 && !empty($me['user'])) {
      $isAuth   = true;
      $userName = $me['user']['full_name'] ?? ($me['user']['email'] ?? 'Tài khoản');
    } else {
      clear_token();
    }
  }
} catch (Exception $e) {
  clear_token();
}

// ========== LẤY THÔNG TIN SẢN PHẨM ==========
try {
  [$c1, $product] = api_call('GET', "$apiBase/product/".urlencode($slug), null, false);
  if ($c1 !== 200) {
    http_response_code($c1);
    $msg = $product['message'] ?? 'Không tìm thấy sản phẩm.';
    $product = null;
  }
} catch (Exception $e) {
  $msg = $e->getMessage();
  $product = null;
}

if (!$product) {
  ?>
  <!doctype html>
  <html lang="vi">
  <head><meta charset="utf-8"><title>Lỗi</title></head>
  <body>
    <p><?= htmlspecialchars($msg) ?></p>
    <p><a href="products.php">Quay lại danh sách sản phẩm</a></p>
  </body>
  </html>
  <?php
  exit;
}

// ========== MAP DỮ LIỆU SẢN PHẨM ==========
$productId   = $product['id'];
$name        = $product['name'] ?? '';
$brand       = $product['brand'] ?? '';
$shortDesc   = $product['short_description'] ?? ($product['description'] ?? '');
$desc        = $product['description'] ?? $shortDesc;
// mô tả chi tiết lấy từ cột descriptions (nếu có), fallback về $desc
$detailDesc  = $product['descriptions'] ?? '';
$variants    = $product['variants'] ?? [];
$avgRating   = (float)($product['avg_rating'] ?? 0);
$totalReview = (int)($product['total_reviews'] ?? 0);

// ========== XỬ LÝ FORM POST (comment / rating) ==========
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $action = $_POST['action'] ?? '';

  // --- Gửi bình luận (không cần đăng nhập) ---
  if ($action === 'add_comment') {
    $author  = trim($_POST['author_name'] ?? '');
    $content = trim($_POST['content'] ?? '');

    if ($content === '') {
      $msg = 'Vui lòng nhập nội dung bình luận.';
    } else {
      try {
        [$cc, $resC] = api_call(
          'POST',
          "$apiBase/products/$productId/comments",
          [
            'author_name' => $author !== '' ? $author : 'Khách',
            'content'     => $content,
          ],
          false
        );
        if ($cc === 200) {
          $ok = 'Đã gửi bình luận.';
        } else {
          $msg = $resC['message'] ?? 'Không gửi được bình luận.';
        }
      } catch (Exception $e) {
        $msg = $e->getMessage();
      }
    }
  }

  // --- Gửi đánh giá sao (cần đăng nhập) ---
  if ($action === 'add_rating') {
    $stars = (int)($_POST['stars'] ?? 0);
    if ($stars < 1 || $stars > 5) {
      $msg = 'Số sao không hợp lệ.';
    } else {
      try {
        [$cr, $resR] = api_call(
          'POST',
          "$apiBase/products/$productId/ratings",
          ['stars' => $stars],
          true
        );
        if ($cr === 200) {
          $ok          = 'Đã ghi nhận đánh giá.';
          $avgRating   = $resR['avg_rating']   ?? $avgRating;
          $totalReview = $resR['total_reviews'] ?? $totalReview;
        } else {
          $msg = $resR['message'] ?? 'Không gửi được đánh giá (có thể bạn chưa đăng nhập).';
        }
      } catch (Exception $e) {
        $msg = $e->getMessage();
      }
    }
  }

  // Sau khi POST xong, reload lại product để cập nhật rating mới
  try {
    [$c1b, $product2] = api_call('GET', "$apiBase/product/".urlencode($slug), null, false);
    if ($c1b === 200) {
        $product     = $product2;
        $variants    = $product['variants']    ?? $variants;
        $avgRating   = (float)($product['avg_rating']    ?? $avgRating);
        $totalReview = (int)($product['total_reviews']   ?? $totalReview);
        $shortDesc   = $product['short_description'] ?? ($product['description'] ?? $shortDesc);
        $desc        = $product['description'] ?? $shortDesc;
        $detailDesc  = $product['descriptions'] ?? $desc;
    }
  } catch (Exception $_) {
    // ignore
  }
}

// ========== LẤY DANH SÁCH COMMENT ==========
$comments = [];
try {
  [$cCom, $dataCom] = api_call('GET', "$apiBase/products/$productId/comments", null, false);
  if ($cCom === 200) {
    if (isset($dataCom['reviews']))      $comments = $dataCom['reviews'];
    elseif (isset($dataCom['comments'])) $comments = $dataCom['comments'];
  }
} catch (Exception $_) {
  // không làm crash trang nếu API comment chưa có
}

function format_price($n) {
  if ($n === null || $n === '' || (!is_numeric($n) && $n !== 0)) {
    return 'Liên hệ';
  }
  return number_format($n, 0, ',', '.') . 'đ';
}

// ========== XỬ LÝ ẢNH TĨNH THEO SLUG ==========
$displayImages = [];

if (!empty($slug)) {
  for ($i = 1; $i <= 3; $i++) {
    $candidate = "acess/product/{$slug}-{$i}.jpg";
    if (file_exists(__DIR__ . '/' . $candidate)) {
      $displayImages[] = $candidate;
    }
  }

  if (empty($displayImages)) {
    $candidate = "acess/product/{$slug}.jpg";
    if (file_exists(__DIR__ . '/' . $candidate)) {
      $displayImages[] = $candidate;
    }
  }
}

// fallback nếu không có ảnh nào
if (empty($displayImages)) {
  $displayImages[] = "acess/product/no-image.jpg";
}

// Ảnh chính là ảnh đầu tiên
$mainImg = $displayImages[0];

// đảm bảo luôn có 3 thumbnail cho đẹp UI
while (count($displayImages) < 3) {
  $displayImages[] = end($displayImages);
}
?>

<!doctype html>
<html lang="vi" data-bs-theme="light">
<head>
  <meta charset="utf-8">
  <title><?=$name?> | E-Store PC</title>
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
    .thumb{
      cursor:pointer;
      border:2px solid transparent;
      transition: border-color .15s ease, transform .15s ease;
    }
    .thumb:hover{
      transform: scale(1.02);
    }
    .thumb.active{
      border-color:var(--brand);
    }
    .badge-soft{
      background:#e6f4ff; color:#0369a1; border:1px solid #bae6fd;
      text-transform:uppercase; letter-spacing:.12em; font-size:.65rem
    }
    .modal-fullscreen-dark .modal-content{
      background: transparent;
      border: none;
    }
  </style>
</head>
<body>
  <!-- Navbar giống index -->
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
        </ul>
        <div class="d-flex gap-2">
          <?php if ($isAuth): ?>
            <div class="dropdown">
              <button class="btn btn-sm btn-outline-primary dropdown-toggle" data-bs-toggle="dropdown">
                👋 <?=htmlspecialchars($userName)?>
              </button>
              <ul class="dropdown-menu dropdown-menu-end">
                <li><a class="dropdown-item" href="profile.php">Hồ sơ</a></li>
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

  <main class="py-4">
    <div class="container">
      <?php if($msg): ?><div class="alert alert-danger"><?=$msg?></div><?php endif; ?>
      <?php if($ok):  ?><div class="alert alert-success"><?=$ok?></div><?php endif; ?>

      <div class="row g-4">
        <!-- ẢNH SẢN PHẨM -->
        <div class="col-lg-5">
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <div class="ratio ratio-4x3 mb-3">
                <!-- Ảnh chính: click để mở modal phóng to -->
                <img
                  id="mainImage"
                  src="<?=htmlspecialchars($mainImg)?>"
                  class="img-fluid rounded"
                  style="object-fit:contain; width:100%; height:100%; cursor:zoom-in;"
                  alt="<?=htmlspecialchars($name)?>"
                  data-bs-toggle="modal"
                  data-bs-target="#imageModal"
                  data-current-index="0"
                >
              </div>

              <div class="d-flex gap-2">
                <?php foreach($displayImages as $idx => $imgUrl): ?>
                  <div class="ratio ratio-4x3" style="width:90px;">
                    <img
                      src="<?=htmlspecialchars($imgUrl)?>"
                      class="img-fluid rounded thumb <?=$idx===0?'active':''?>"
                      data-img="<?=htmlspecialchars($imgUrl)?>"
                      data-index="<?=$idx?>"
                      style="object-fit:cover; width:100%; height:100%;">
                  </div>
                <?php endforeach; ?>
              </div>
            </div>
          </div>
        </div>

        <!-- THÔNG TIN + BIẾN THỂ -->
        <div class="col-lg-7">
          <div class="card border-0 shadow-sm mb-3">
            <div class="card-body">
              <span class="badge badge-soft mb-2">CHI TIẾT SẢN PHẨM</span>
              <h2 class="mb-1"><?=$name?></h2>
              <?php if($brand): ?>
                <div class="text-muted mb-2">Thương hiệu: <strong><?=htmlspecialchars($brand)?></strong></div>
              <?php endif; ?>

              <div class="d-flex align-items-center gap-2 mb-2">
                <div class="price fs-4">
                  <?php
                    // giá mặc định lấy từ biến thể rẻ nhất
                    $minPrice = null;
                    foreach($variants as $v){
                      if ($minPrice === null || $v['price'] < $minPrice) $minPrice = $v['price'];
                    }
                    echo format_price($minPrice);
                  ?>
                </div>
                <div class="small text-warning">
                  ★ <?=number_format($avgRating,1)?> 
                  <span class="text-muted">(<?=$totalReview?> đánh giá)</span>
                </div>
              </div>

              <p class="text-muted" style="white-space:pre-line;"><?=htmlspecialchars($shortDesc)?></p>

              <!-- Danh sách biến thể -->
              <h6 class="mt-3">Các biến thể</h6>
              <?php if(!$variants): ?>
                <div class="text-muted small">Hiện chưa cấu hình biến thể cho sản phẩm này.</div>
              <?php else: ?>
                <div class="table-responsive">
                  <table class="table align-middle">
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Thuộc tính</th>
                        <th>Giá</th>
                        <th>Tồn kho</th>
                        <th class="text-nowrap">Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                    <?php foreach($variants as $v): 
                      $attrsText = '';
                      if (!empty($v['attrs']) && is_array($v['attrs'])) {
                        $chunks = [];
                        foreach($v['attrs'] as $k=>$val){
                          $chunks[] = htmlspecialchars($k).': '.htmlspecialchars($val);
                        }
                        $attrsText = implode(', ', $chunks);
                      }
                    ?>
                      <tr>
                        <td><?=htmlspecialchars($v['sku'] ?? ('VAR-'.$v['id']))?></td>
                        <td><?=$attrsText ?: '<span class="text-muted small">Không có</span>'?></td>
                        <td><?=format_price($v['price'])?></td>
                        <td>
                          <?php if($v['stock'] > 0): ?>
                            <span class="text-success fw-semibold"><?=$v['stock']?></span>
                          <?php else: ?>
                            <span class="text-danger fw-semibold">Hết hàng</span>
                          <?php endif; ?>
                        </td>
                        <td class="text-nowrap">
                          <?php if($v['stock'] > 0): ?>
                            <!-- Nút Thêm vào giỏ: AJAX, KHÔNG rời trang -->
                            <button
                              type="button"
                              class="btn btn-sm btn-outline-primary me-1 btn-add-cart"
                              data-variant-id="<?=$v['id']?>"
                            >
                              Thêm vào giỏ
                            </button>

                            <!-- Nút Chọn mua: thêm vào giỏ & tích chọn trong giỏ (selected=1) -->
                            <a href="cart.php?action=add_variant&variant_id=<?=$v['id']?>&selected=1"
                               class="btn btn-sm btn-brand">
                              Chọn mua
                            </a>
                          <?php else: ?>
                            <button class="btn btn-sm btn-secondary" disabled>Hết hàng</button>
                          <?php endif; ?>
                        </td>
                      </tr>
                    <?php endforeach; ?>
                    </tbody>
                  </table>
                </div>
              <?php endif; ?>

            </div>
          </div>

          <!-- Mô tả chi tiết -->
          <div class="card border-0 shadow-sm">
            <div class="card-body">
                <h5>Mô tả chi tiết</h5>
                <div class="text-muted" style="white-space:pre-line;">
                <?=htmlspecialchars($detailDesc ?: $desc ?: $shortDesc)?>
                </div>
            </div>
          </div>

        </div>
      </div>

      <!-- BÌNH LUẬN & ĐÁNH GIÁ -->
      <div class="row mt-4 g-4">
        <!-- Đánh giá sao -->
        <div class="col-lg-4">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-body">
              <h5 class="mb-3">Đánh giá sản phẩm</h5>
              <div class="mb-2">
                <span class="display-6 text-warning">★ <?=number_format($avgRating,1)?></span>
                <div class="text-muted small"><?=$totalReview?> lượt đánh giá</div>
              </div>
              <?php if($isAuth): ?>
                <form method="post" class="mt-3">
                  <input type="hidden" name="action" value="add_rating">
                  <label class="form-label">Chọn số sao:</label>
                  <select name="stars" class="form-select mb-3" required>
                    <option value="5">5 sao - Tuyệt vời</option>
                    <option value="4">4 sao - Tốt</option>
                    <option value="3">3 sao - Bình thường</option>
                    <option value="2">2 sao - Chưa tốt</option>
                    <option value="1">1 sao - Tệ</option>
                  </select>
                  <button class="btn btn-brand w-100">Gửi đánh giá</button>
                </form>
              <?php else: ?>
                <div class="alert alert-info small">
                  Bạn cần <a href="login.php">đăng nhập</a> để chấm sao sản phẩm này.
                </div>
              <?php endif; ?>
            </div>
          </div>
        </div>

        <!-- Comment -->
        <div class="col-lg-8">
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <h5 class="mb-3">Nhận xét của khách hàng</h5>

              <!-- Form bình luận: không bắt buộc login -->
              <form method="post" class="row g-2 mb-3">
                <input type="hidden" name="action" value="add_comment">
                <div class="col-md-4">
                  <input name="author_name" class="form-control" placeholder="Tên bạn (tuỳ chọn)">
                </div>
                <div class="col-md-8">
                  <div class="input-group">
                    <input name="content" class="form-control" placeholder="Chia sẻ cảm nhận của bạn về sản phẩm..." required>
                    <button class="btn btn-brand" type="submit">Gửi</button>
                  </div>
                </div>
              </form>

              <?php if(!$comments): ?>
                <div class="text-muted small">Chưa có bình luận nào. Hãy là người đầu tiên!</div>
              <?php else: ?>
                <div class="list-group list-group-flush">
                  <?php foreach($comments as $c): ?>
                    <div class="list-group-item px-0">
                      <div class="d-flex justify-content-between">
                        <strong><?=htmlspecialchars($c['author_name'] ?? 'Khách')?></strong>
                        <span class="text-muted small">
                          <?=htmlspecialchars($c['created_at'] ?? '')?>
                        </span>
                      </div>
                      <div class="small mt-1"><?=nl2br(htmlspecialchars($c['content'] ?? ''))?></div>
                    </div>
                  <?php endforeach; ?>
                </div>
              <?php endif; ?>

            </div>
          </div>
        </div>
      </div>

    </div>
  </main>

  <!-- MODAL PHÓNG TO ẢNH -->
  <div class="modal fade modal-fullscreen-dark" id="imageModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-xl">
      <div class="modal-content">
        <div class="modal-body p-0 position-relative">
          <!-- nút đóng -->
          <button type="button" class="btn-close btn-close-white position-absolute top-0 end-0 m-3" data-bs-dismiss="modal" aria-label="Close"></button>

          <!-- Carousel để chuyển ảnh -->
          <div id="imageCarousel" class="carousel slide" data-bs-interval="false">
            <div class="carousel-inner">
              <?php foreach($displayImages as $idx => $imgUrl): ?>
                <div class="carousel-item <?=$idx===0?'active':''?>">
                  <div class="d-flex justify-content-center align-items-center" style="min-height:100vh; background:rgba(0,0,0,0.9);">
                    <img src="<?=htmlspecialchars($imgUrl)?>" class="img-fluid" style="max-height:90vh; object-fit:contain;">
                  </div>
                </div>
              <?php endforeach; ?>
            </div>
            <button class="carousel-control-prev" type="button" data-bs-target="#imageCarousel" data-bs-slide="prev">
              <span class="carousel-control-prev-icon" aria-hidden="true"></span>
              <span class="visually-hidden">Previous</span>
            </button>
            <button class="carousel-control-next" type="button" data-bs-target="#imageCarousel" data-bs-slide="next">
              <span class="carousel-control-next-icon" aria-hidden="true"></span>
              <span class="visually-hidden">Next</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  </div>

  <footer class="py-3 mt-4 bg-white border-top">
    <div class="container d-flex justify-content-between small text-muted">
      <span>E-Store.PC • Product Detail</span>
      <span>Hỗ trợ nhiều biến thể & tồn kho riêng</span>
    </div>
  </footer>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', function(){
      const mainImg   = document.getElementById('mainImage');
      const thumbs    = document.querySelectorAll('.thumb');
      const carouselEl = document.getElementById('imageCarousel');
      const modalEl    = document.getElementById('imageModal');

      let carousel = null;
      if (carouselEl) {
        carousel = new bootstrap.Carousel(carouselEl, {
          interval: false,
          ride: false,
          wrap: true
        });
      }

      // click thumbnail -> đổi ảnh chính + set currentIndex
      thumbs.forEach(function(el){
        el.addEventListener('click', function(){
          const imgUrl = this.dataset.img;
          const idx    = this.dataset.index || '0';

          if (mainImg) {
            mainImg.src = imgUrl;
            mainImg.dataset.currentIndex = idx;
          }

          thumbs.forEach(t => t.classList.remove('active'));
          this.classList.add('active');
        });
      });

      if (mainImg && !mainImg.dataset.currentIndex) {
        mainImg.dataset.currentIndex = '0';
      }

      if (modalEl && carousel) {
        // Khi mở modal -> nhảy carousel tới ảnh đang hiển thị ngoài
        modalEl.addEventListener('show.bs.modal', function(){
          const idx = parseInt(mainImg.dataset.currentIndex || '0', 10);
          carousel.to(idx);
        });

        // Khi trượt trong modal -> đồng bộ thumbnail + ảnh chính
        modalEl.addEventListener('slid.bs.carousel', function(ev){
          const newIndex = ev.to; // index slide mới
          const thumb = document.querySelector('.thumb[data-index="' + newIndex + '"]');
          if (thumb && mainImg) {
            const imgUrl = thumb.dataset.img;
            mainImg.src = imgUrl;
            mainImg.dataset.currentIndex = String(newIndex);

            thumbs.forEach(t => t.classList.remove('active'));
            thumb.classList.add('active');
          }
        });
      }

      // ====== NÚT "THÊM VÀO GIỎ" (AJAX, KHÔNG RỜI TRANG) ======
      const addButtons = document.querySelectorAll('.btn-add-cart');

      async function addVariantToCart(variantId, btn) {
        if (!variantId) return;
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Đang thêm...';

        try {
          const resp = await fetch('cart.php?action=add_variant&variant_id=' + encodeURIComponent(variantId), {
            method: 'GET',
            headers: {
              'X-Requested-With': 'XMLHttpRequest'
            }
          });
          if (!resp.ok) throw new Error('HTTP ' + resp.status);
          const data = await resp.json();

          if (data && data.ok) {
            alert('Đã thêm sản phẩm vào giỏ hàng!');
          } else {
            alert('Không thêm được sản phẩm vào giỏ. Vui lòng thử lại.');
          }
        } catch (e) {
          console.error(e);
          alert('Có lỗi xảy ra khi thêm vào giỏ hàng.');
        } finally {
          btn.disabled = false;
          btn.textContent = originalText;
        }
      }

      addButtons.forEach(function(btn){
        btn.addEventListener('click', function(){
          const vid = this.dataset.variantId;
          addVariantToCart(vid, this);
        });
      });

    });
  </script>
</body>
</html>
