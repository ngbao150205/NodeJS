<?php
// Bật lỗi (dev, sau này deploy có thể tắt)
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require __DIR__ . '/lib/api.php';

$apiBase = 'http://localhost:8080/api';

// ================== LẤY QUERY STRING ==================
$page  = max(1, (int)($_GET['page'] ?? 1));
$limit = 12; // tối đa 12 sản phẩm / trang

$category = $_GET['category'] ?? '';       // laptop / monitor / hard-drive / ''
$sort     = $_GET['sort']     ?? '';       // newest, best, name-asc, ...
$search   = trim($_GET['q']   ?? '');      // từ khoá tìm kiếm

// Filter bổ sung
$brand      = $_GET['brand']      ?? '';   // thương hiệu
$priceRange = $_GET['priceRange'] ?? '';   // khoảng giá (vd: 0-5000000)
$minPrice   = $_GET['minPrice']   ?? '';   // sẽ được override từ priceRange
$maxPrice   = $_GET['maxPrice']   ?? '';
$rating     = $_GET['rating']     ?? '';   // xếp hạng tối thiểu (3,4,5)

// Chế độ xem: grid (mặc định) hoặc list
$view = $_GET['view'] ?? 'grid';
if (!in_array($view, ['grid', 'list'], true)) {
    $view = 'grid';
}

// Map priceRange -> minPrice / maxPrice
if ($priceRange !== '') {
    $parts    = explode('-', $priceRange);
    $minPrice = $parts[0] ?? '';
    $maxPrice = $parts[1] ?? '';
}

// build param cho API /api/products
$params = [
    'page'  => $page,
    'limit' => $limit,
];

if ($category !== '') $params['category'] = $category;
if ($sort     !== '') $params['sort']     = $sort;
if ($search   !== '') $params['q']        = $search;
if ($brand    !== '') $params['brand']    = $brand;
if ($minPrice !== '') $params['minPrice'] = (int)$minPrice;
if ($maxPrice !== '') $params['maxPrice'] = (int)$maxPrice;
if ($rating   !== '') $params['rating']   = (int)$rating;

$queryString = http_build_query($params);

// ================== GỌI API /api/products ==================
$error      = '';
$items      = [];
$pagination = [
    'page'       => $page,
    'totalPages' => 1,
    'totalItems' => 0,
];

try {
    [$code, $data] = api_call('GET', "$apiBase/products?$queryString", null, false);

    if ($code === 200) {
        $items = $data['items'] ?? [];

        // Nếu API trả về cấu trúc pagination chuẩn
        if (isset($data['pagination']) && is_array($data['pagination'])) {
            $pagination = array_merge($pagination, $data['pagination']);
        } else {
            // fallback nếu chỉ có totalItems
            if (isset($data['totalItems'])) {
                $pagination['totalItems'] = (int)$data['totalItems'];
                $pagination['totalPages'] = max(1, (int)ceil($data['totalItems'] / $limit));
            }
        }
    } else {
        $error = $data['message'] ?? 'Không lấy được danh sách sản phẩm.';
    }
} catch (Exception $e) {
    $error = $e->getMessage();
}

// alias cho dễ đọc phía dưới
$products   = $items;
$totalItems = (int)($pagination['totalItems'] ?? 0);
$totalPages = (int)($pagination['totalPages'] ?? 1);
if ($totalPages < 1) $totalPages = 1;
$current    = (int)($pagination['page'] ?? $page);

// ================== HELPERS ==================
function format_price($n)
{
    if ($n === null || $n === '' || (!is_numeric($n) && $n == 0)) {
        return 'Liên hệ';
    }
    return number_format((float)$n, 0, ',', '.') . 'đ';
}

// giữ lại filter khi chuyển trang
$baseQuery = $_GET;
unset($baseQuery['page'], $baseQuery['minPrice'], $baseQuery['maxPrice']);

// đảm bảo view hợp lệ luôn tồn tại trong query
if (!isset($baseQuery['view']) || !in_array($baseQuery['view'], ['grid', 'list'], true)) {
    $baseQuery['view'] = $view;
}

$baseQs = http_build_query($baseQuery);

function page_link($page, $baseQs)
{
    $qs = $baseQs ? $baseQs . '&page=' . $page : 'page=' . $page;
    return 'products.php?' . $qs;
}
?>
<!doctype html>
<html lang="vi" data-bs-theme="light">
<head>
    <meta charset="utf-8">
    <title>Danh mục sản phẩm | E-Store PC</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <!-- Bootstrap -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        :root {
            --brand: #0ea5e9;
            --brand-600: #0284c7;
        }
        body {
            background: radial-gradient(circle at 20% -10%, #eef7ff, transparent 40%),
                        radial-gradient(circle at 100% 0, #f8f5ff, transparent 35%),
                        #f7fafc;
            color: #1f2937;
        }
        .navbar {
            background: #ffffff !important;
            border-bottom: 1px solid #e5e7eb;
        }
        .product-card {
            transition: .18s ease;
            box-shadow: 0 6px 14px rgba(0, 0, 0, .04);
            border: 0;
        }
        .product-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 16px 32px rgba(2, 132, 199, .15);
        }
        .price {
            color: var(--brand);
            font-weight: 700;
        }
        .btn-brand {
            background: var(--brand);
            border-color: var(--brand);
        }
        .btn-brand:hover {
            background: var(--brand-600);
            border-color: var(--brand-600);
        }
        .badge-soft {
            background: #e6f4ff;
            color: #0369a1;
            border: 1px solid #bae6fd;
            text-transform: uppercase;
            letter-spacing: .12em;
            font-size: .65rem
        }
    </style>
</head>
<body>
<!-- Navbar đơn giản -->
<nav class="navbar navbar-expand-lg sticky-top">
    <div class="container">
        <a class="navbar-brand fw-bold" style="color:var(--brand)" href="index.php">E-Store<span class="text-dark">.PC</span></a>
        <button class="navbar-toggler border-0" data-bs-toggle="collapse" data-bs-target="#nav">
            <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="nav">
            <ul class="navbar-nav me-auto">
                <li class="nav-item"><a class="nav-link" href="index.php">Trang chủ</a></li>
                <li class="nav-item"><a class="nav-link active" href="products.php">Sản phẩm</a></li>
                <li class="nav-item"><a class="nav-link" href="cart.php">Giỏ hàng</a></li>
            </ul>
        </div>
    </div>
</nav>

<main class="py-4">
    <div class="container">
        <!-- Tiêu đề + tổng số + view toggle -->
        <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-3">
            <div class="mb-2 mb-md-0">
                <span class="badge badge-soft mb-1">DANH MỤC SẢN PHẨM</span>
                <h3 class="mb-0">Tất cả sản phẩm</h3>
                <div class="text-muted small">
                    Có <span id="totalItemsText"><?= (int)$totalItems ?></span> sản phẩm được tìm thấy.
                </div>
            </div>

            <div class="d-flex flex-column flex-md-row align-items-md-center gap-2">
                <!-- Form filter/search -->
                <form class="row gy-2 gx-2" method="get" action="products.php">
                    <!-- Tìm kiếm theo tên -->
                    <div class="col-12 col-md-auto">
                        <input name="q"
                               id="searchInput"
                               autocomplete="off"
                               class="form-control"
                               placeholder="Tìm theo tên..."
                               value="<?= htmlspecialchars($search) ?>">
                    </div>

                    <!-- DANH MỤC -->
                    <div class="col-6 col-md-auto">
                        <select name="category" class="form-select" id="categorySelect">
                            <option value="">Tất cả danh mục</option>
                            <option value="laptop"     <?= $category === 'laptop' ? 'selected' : '' ?>>Laptops</option>
                            <option value="monitor"    <?= $category === 'monitor' ? 'selected' : '' ?>>Monitors</option>
                            <option value="hard-drive" <?= $category === 'hard-drive' ? 'selected' : '' ?>>Ổ cứng / SSD</option>
                        </select>
                    </div>

                    <!-- THƯƠNG HIỆU -->
                    <div class="col-6 col-md-auto">
                        <select name="brand" class="form-select" id="brandSelect">
                            <option value="">Tất cả thương hiệu</option>
                            <option value="Dell"  <?= $brand === 'Dell' ? 'selected' : '' ?>>Dell</option>
                            <option value="HP"    <?= $brand === 'HP' ? 'selected' : '' ?>>HP</option>
                            <option value="Asus"  <?= $brand === 'Asus' ? 'selected' : '' ?>>Asus</option>
                            <option value="Acer"  <?= $brand === 'Acer' ? 'selected' : '' ?>>Acer</option>
                            <option value="Adata" <?= $brand === 'Adata' ? 'selected' : '' ?>>Adata</option>
                            <option value="WD"    <?= $brand === 'WD' ? 'selected' : '' ?>>WD</option>
                            <!-- có thể bổ sung thêm theo DB thực tế -->
                        </select>
                    </div>

                    <!-- KHOẢNG GIÁ: 1 select quản lý min/max -->
                    <div class="col-6 col-md-auto">
                        <select name="priceRange" class="form-select" id="priceRangeSelect">
                            <option value="">Mọi mức giá</option>
                            <option value="0-5000000"          <?= $priceRange === '0-5000000' ? 'selected' : '' ?>>Dưới 5.000.000đ</option>
                            <option value="5000000-10000000"   <?= $priceRange === '5000000-10000000' ? 'selected' : '' ?>>5.000.000 - 10.000.000đ</option>
                            <option value="10000000-20000000"  <?= $priceRange === '10000000-20000000' ? 'selected' : '' ?>>10.000.000 - 20.000.000đ</option>
                            <option value="20000000-999999999" <?= $priceRange === '20000000-999999999' ? 'selected' : '' ?>>Trên 20.000.000đ</option>
                        </select>
                    </div>

                    <!-- XẾP HẠNG -->
                    <div class="col-6 col-md-auto">
                        <select name="rating" class="form-select" id="ratingSelect">
                            <option value="">Mọi đánh giá</option>
                            <option value="3" <?= $rating === '3' ? 'selected' : '' ?>>Từ 3★ trở lên</option>
                            <option value="4" <?= $rating === '4' ? 'selected' : '' ?>>Từ 4★ trở lên</option>
                            <option value="5" <?= $rating === '5' ? 'selected' : '' ?>>Chỉ 5★</option>
                        </select>
                    </div>

                    <!-- SẮP XẾP -->
                    <div class="col-6 col-md-auto">
                        <select name="sort" class="form-select" id="sortSelect">
                            <option value="">Mặc định</option>
                            <option value="newest"     <?= $sort === 'newest' ? 'selected' : '' ?>>Sản phẩm mới</option>
                            <option value="best"       <?= $sort === 'best' ? 'selected' : '' ?>>Sản phẩm bán chạy</option>
                            <option value="name-asc"   <?= $sort === 'name-asc' ? 'selected' : '' ?>>Tên A → Z</option>
                            <option value="name-desc"  <?= $sort === 'name-desc' ? 'selected' : '' ?>>Tên Z → A</option>
                            <option value="price-asc"  <?= $sort === 'price-asc' ? 'selected' : '' ?>>Giá tăng dần</option>
                            <option value="price-desc" <?= $sort === 'price-desc' ? 'selected' : '' ?>>Giá giảm dần</option>
                        </select>
                    </div>

                    <!-- giữ chế độ view hiện tại khi filter -->
                    <input type="hidden" name="view" value="<?= htmlspecialchars($view) ?>">

                    <div class="col-12 col-md-auto">
                        <button class="btn btn-brand w-100">Lọc</button>
                    </div>
                </form>

                <!-- Nút chuyển chế độ xem -->
                <?php
                $qsGrid = http_build_query(array_merge($baseQuery, ['view' => 'grid']));
                $qsList = http_build_query(array_merge($baseQuery, ['view' => 'list']));
                ?>
                <div class="btn-group ms-md-2" role="group" aria-label="Chế độ xem">
                    <a href="products.php?<?= $qsGrid ?>"
                       class="btn btn-outline-secondary btn-sm <?= $view === 'grid' ? 'active' : '' ?>">
                        Lưới
                    </a>
                    <a href="products.php?<?= $qsList ?>"
                       class="btn btn-outline-secondary btn-sm <?= $view === 'list' ? 'active' : '' ?>">
                        Danh sách
                    </a>
                </div>
            </div>
        </div>

        <?php if ($error): ?>
            <div class="alert alert-danger"><?= htmlspecialchars($error) ?></div>
        <?php endif; ?>

        <!-- Danh sách sản phẩm -->
        <div class="row" id="productGrid" data-view="<?= htmlspecialchars($view) ?>">
            <?php if (!$products): ?>
                <div class="col-12">
                    <div class="alert alert-info">Không tìm thấy sản phẩm nào phù hợp.</div>
                </div>
            <?php else: ?>
                <?php foreach ($products as $p):
                    $name   = $p['name'] ?? 'No name';
                    $brandP = $p['brand'] ?? '';
                    $slug   = $p['slug'] ?? '';

                    // 1) Ưu tiên ảnh tĩnh theo slug trong acess/product
                    $img = null;
                    if ($slug !== '') {
                        $candidate1   = "acess/product/{$slug}-1.jpg";
                        $candidateOne = "acess/product/{$slug}.jpg";

                        if (file_exists(__DIR__ . '/' . $candidate1)) {
                            $img = $candidate1;
                        } elseif (file_exists(__DIR__ . '/' . $candidateOne)) {
                            $img = $candidateOne;
                        }
                    }

                    // 2) Fallback nếu không có file tĩnh
                    if ($img === null) {
                        // có thể dùng thêm cover_image / images[] nếu API trả về
                        // $img = $p['cover_image'] ?? ($p['images'][0] ?? 'acess/product/no-image.jpg');
                        $img = 'acess/product/no-image.jpg';
                    }

                    $price       = $p['min_price'] ?? ($p['variants'][0]['price'] ?? null);
                    $short       = $p['short_description'] ?? ($p['description'] ?? '');
                    $ratingP     = isset($p['avg_rating']) ? (float)$p['avg_rating'] : 0;
                    $ratingCount = (int)($p['total_reviews'] ?? 0);
                ?>

                    <?php if ($view === 'list'): ?>
                        <!-- DẠNG DANH SÁCH -->
                        <div class="col-12 mb-3">
                            <div class="card product-card h-100">
                                <div class="row g-0">
                                    <div class="col-4 col-md-3">
                                        <a href="product-detail.php?slug=<?= htmlspecialchars($slug) ?>"
                                           class="text-decoration-none text-reset">
                                            <div class="ratio ratio-4x3">
                                                <img src="<?= htmlspecialchars($img) ?>"
                                                     class="img-fluid rounded-start"
                                                     style="object-fit:cover; width:100%; height:100%;"
                                                     alt="<?= htmlspecialchars($name) ?>">
                                            </div>
                                        </a>
                                    </div>
                                    <div class="col-8 col-md-9">
                                        <div class="card-body d-flex flex-column h-100">
                                            <div class="small text-muted mb-1"><?= htmlspecialchars($brandP) ?></div>
                                            <h5 class="fw-semibold mb-1" title="<?= htmlspecialchars($name) ?>">
                                                <?= htmlspecialchars($name) ?>
                                            </h5>
                                            <div class="small text-muted mb-2" style="max-height:4.5rem; overflow:hidden;">
                                                <?php
                                                if (function_exists('mb_strimwidth')) {
                                                    echo htmlspecialchars(mb_strimwidth($short, 0, 160, '...', 'UTF-8'));
                                                } else {
                                                    echo htmlspecialchars(substr($short, 0, 160) . (strlen($short) > 160 ? '...' : ''));
                                                }
                                                ?>
                                            </div>
                                            <div class="d-flex justify-content-between align-items-center mt-auto">
                                                <div>
                                                    <div class="price mb-1"><?= format_price($price) ?></div>
                                                    <small class="text-warning">
                                                        ★ <?= number_format($ratingP, 1) ?>
                                                        <span class="text-muted">(<?= $ratingCount ?>)</span>
                                                    </small>
                                                </div>
                                                
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    <?php else: ?>
                        <!-- DẠNG LƯỚI -->
                        <div class="col-6 col-md-4 col-lg-3 mb-4">
                            <div class="card product-card h-100">
                                <a href="product-detail.php?slug=<?= htmlspecialchars($slug) ?>"
                                   class="text-decoration-none text-reset">
                                    <div class="ratio ratio-4x3">
                                        <img src="<?= htmlspecialchars($img) ?>"
                                             class="card-img-top"
                                             style="object-fit:cover"
                                             alt="<?= htmlspecialchars($name) ?>">
                                    </div>
                                </a>
                                <div class="card-body d-flex flex-column">
                                    <div class="small text-muted mb-1"><?= htmlspecialchars($brandP) ?></div>
                                    <h6 class="fw-semibold text-truncate mb-1" title="<?= htmlspecialchars($name) ?>">
                                        <?= htmlspecialchars($name) ?>
                                    </h6>
                                    <div class="small text-muted" style="min-height:3rem; overflow:hidden;">
                                        <?php
                                        if (function_exists('mb_strimwidth')) {
                                            echo htmlspecialchars(mb_strimwidth($short, 0, 80, '...', 'UTF-8'));
                                        } else {
                                            echo htmlspecialchars(substr($short, 0, 80) . (strlen($short) > 80 ? '...' : ''));
                                        }
                                        ?>
                                    </div>
                                    <div class="d-flex justify-content-between align-items-center mt-2">
                                        <span class="price"><?= format_price($price) ?></span>
                                        <small class="text-warning">
                                            ★ <?= number_format($ratingP, 1) ?>
                                            <span class="text-muted">(<?= $ratingCount ?>)</span>
                                        </small>
                                    </div>
                                    
                                </div>
                            </div>
                        </div>
                    <?php endif; ?>

                <?php endforeach; ?>
            <?php endif; ?>
        </div>

        <!-- Phân trang: luôn hiển thị số trang, kể cả khi chỉ có 1 -->
        <nav aria-label="Page navigation" id="pagination">
            <ul class="pagination justify-content-center mt-3">
                <li class="page-item <?= $current <= 1 ? 'disabled' : '' ?>">
                    <a class="page-link"
                       href="<?= $current > 1 ? page_link($current - 1, $baseQs) : '#' ?>">&laquo;</a>
                </li>

                <?php for ($i = 1; $i <= $totalPages; $i++): ?>
                    <li class="page-item <?= $i == $current ? 'active' : '' ?>">
                        <a class="page-link" href="<?= page_link($i, $baseQs) ?>"><?= $i ?></a>
                    </li>
                <?php endfor; ?>

                <li class="page-item <?= $current >= $totalPages ? 'disabled' : '' ?>">
                    <a class="page-link"
                       href="<?= $current < $totalPages ? page_link($current + 1, $baseQs) : '#' ?>">&raquo;</a>
                </li>
            </ul>
        </nav>

    </div>
</main>

<footer class="py-3 mt-4 bg-white border-top">
    <div class="container d-flex justify-content-between small text-muted">
        <span>E-Store.PC • Product Listing</span>
        <span>Phân trang luôn hiển thị số trang</span>
    </div>
</footer>

<!-- JS -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<script>
    (function () {
        const API_BASE        = <?= json_encode($apiBase) ?>;
        const searchInput     = document.getElementById('searchInput');
        const categorySelect  = document.getElementById('categorySelect');
        const brandSelect     = document.getElementById('brandSelect');
        const priceRangeSelect= document.getElementById('priceRangeSelect');
        const ratingSelect    = document.getElementById('ratingSelect');
        const sortSelect      = document.getElementById('sortSelect');
        const grid            = document.getElementById('productGrid');
        const pagination      = document.getElementById('pagination');
        const totalItemsSpan  = document.getElementById('totalItemsText');
        const viewMode        = grid ? (grid.dataset.view || 'grid') : 'grid';

        if (!searchInput || !grid) return;

        let typingTimer = null;
        const TYPING_DELAY = 300; // ms

        function formatPrice(n) {
            if (n === null || n === undefined || n === '') return 'Liên hệ';
            try {
                return new Intl.NumberFormat('vi-VN').format(Number(n)) + 'đ';
            } catch (e) {
                return n + 'đ';
            }
        }

        function escapeHtml(str) {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        function renderProducts(items) {
            grid.innerHTML = '';

            if (!items || !items.length) {
                grid.innerHTML = `
                    <div class="col-12">
                      <div class="alert alert-info">Không tìm thấy sản phẩm nào phù hợp.</div>
                    </div>
                `;
                return;
            }

            items.forEach(function (p) {
                const name   = p.name  || 'No name';
                const brand  = p.brand || '';
                const img    = p.cover_image || (p.images && p.images[0]) || 'https://via.placeholder.com/400x300?text=Computer';
                const slug   = p.slug  || '';
                const price  = (p.min_price !== undefined && p.min_price !== null)
                    ? p.min_price
                    : (p.variants && p.variants[0] ? p.variants[0].price : null);
                const short  = p.short_description || p.description || '';
                const rating = p.avg_rating || 0;
                const ratingCount = p.total_reviews || 0;

                const wrapper = document.createElement('div');

                if (viewMode === 'list') {
                    wrapper.className = 'col-12 mb-3';
                    wrapper.innerHTML = `
                        <div class="card product-card h-100">
                          <div class="row g-0">
                            <div class="col-4 col-md-3">
                              <a href="product-detail.php?slug=${encodeURIComponent(slug)}"
                                 class="text-decoration-none text-reset">
                                <div class="ratio ratio-4x3">
                                  <img src="${escapeHtml(img)}"
                                       class="img-fluid rounded-start"
                                       style="object-fit:cover; width:100%; height:100%;"
                                       alt="${escapeHtml(name)}">
                                </div>
                              </a>
                            </div>
                            <div class="col-8 col-md-9">
                              <div class="card-body d-flex flex-column h-100">
                                <div class="small text-muted mb-1">${escapeHtml(brand)}</div>
                                <h5 class="fw-semibold mb-1" title="${escapeHtml(name)}">
                                  ${escapeHtml(name)}
                                </h5>
                                <div class="small text-muted mb-2" style="max-height:4.5rem; overflow:hidden;">
                                  ${escapeHtml(short.length > 160 ? short.substring(0, 160) + '...' : short)}
                                </div>
                                <div class="d-flex justify-content-between align-items-center mt-auto">
                                  <div>
                                    <div class="price mb-1">${formatPrice(price)}</div>
                                    <small class="text-warning">
                                      ★ ${Number(rating).toFixed(1)}
                                      <span class="text-muted">(${ratingCount})</span>
                                    </small>
                                  </div>
                                  
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                    `;
                } else {
                    wrapper.className = 'col-6 col-md-4 col-lg-3 mb-4';
                    wrapper.innerHTML = `
                        <div class="card product-card h-100">
                          <a href="product-detail.php?slug=${encodeURIComponent(slug)}"
                             class="text-decoration-none text-reset">
                            <div class="ratio ratio-4x3">
                              <img src="${escapeHtml(img)}"
                                   class="card-img-top"
                                   style="object-fit:cover"
                                   alt="${escapeHtml(name)}">
                            </div>
                          </a>
                          <div class="card-body d-flex flex-column">
                            <div class="small text-muted mb-1">${escapeHtml(brand)}</div>
                            <h6 class="fw-semibold text-truncate mb-1" title="${escapeHtml(name)}">
                              ${escapeHtml(name)}
                            </h6>
                            <div class="small text-muted" style="min-height:3rem; overflow:hidden;">
                              ${escapeHtml(short.length > 80 ? short.substring(0, 80) + '...' : short)}
                            </div>
                            <div class="d-flex justify-content-between align-items-center mt-2">
                              <span class="price">${formatPrice(price)}</span>
                              <small class="text-warning">
                                ★ ${Number(rating).toFixed(1)}
                                <span class="text-muted">(${ratingCount})</span>
                              </small>
                            </div>
                            
                          </div>
                        </div>
                    `;
                }

                grid.appendChild(wrapper);
            });
        }

        async function doLiveSearch(term) {
            const trimmed = term.trim();

            // Nếu user xoá trắng ô tìm kiếm → reload lại trang (về phân trang bình thường)
            if (trimmed === '') {
                window.location.href = 'products.php';
                return;
            }

            try {
                const params = new URLSearchParams();
                params.set('page', 1);
                params.set('limit', 12);
                params.set('q', trimmed);

                const cat = categorySelect   ? categorySelect.value   : '';
                const br  = brandSelect      ? brandSelect.value      : '';
                const pr  = priceRangeSelect ? priceRangeSelect.value : '';
                const rat = ratingSelect     ? ratingSelect.value     : '';
                const srt = sortSelect       ? sortSelect.value       : '';

                if (cat) params.set('category', cat);
                if (br)  params.set('brand', br);

                // Parse priceRange -> minPrice / maxPrice
                if (pr) {
                    const parts = pr.split('-');
                    if (parts[0]) params.set('minPrice', parts[0]);
                    if (parts[1]) params.set('maxPrice', parts[1]);
                }

                if (rat) params.set('rating', rat);
                if (srt) params.set('sort', srt);

                // view chỉ ảnh hưởng hiển thị, không cần gửi lên API, nhưng gửi cũng không sao
                params.set('view', viewMode);

                const resp = await fetch(API_BASE + '/products?' + params.toString());
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                const data = await resp.json();

                renderProducts(data.items || []);

                if (totalItemsSpan) {
                    const total = (data.totalItems !== undefined)
                        ? data.totalItems
                        : (data.pagination ? data.pagination.totalItems : 0);
                    totalItemsSpan.textContent = total;
                }

                // Khi đang live search, ẩn phân trang
                if (pagination) pagination.style.display = 'none';
            } catch (err) {
                console.error('Live search error:', err);
            }
        }

        // Gõ tên sản phẩm -> live search
        searchInput.addEventListener('input', function () {
            clearTimeout(typingTimer);
            typingTimer = setTimeout(function () {
                doLiveSearch(searchInput.value);
            }, TYPING_DELAY);
        });
    })();
</script>
</body>
</html>
