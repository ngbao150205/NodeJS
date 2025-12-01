<?php
// admin-dashboard.php
ini_set('display_errors',1);
ini_set('display_startup_errors',1);
error_reporting(E_ALL);

session_start();
require __DIR__.'/lib/api.php';

$apiBase = 'http://localhost:8080/api';

// ====== KIỂM TRA ĐĂNG NHẬP & ROLE ADMIN ======
$isAuth    = false;
$authUser  = null;
$authName  = '';
$authEmail = '';
$authRole  = '';
$token     = get_token();

try {
    if ($token) {
        [$code, $me] = api_call('GET', "$apiBase/auth/me", null, true);
        if ($code === 200 && !empty($me['user'])) {
            $isAuth    = true;
            $authUser  = $me['user'];
            $authName  = $authUser['full_name'] ?? '';
            $authEmail = $authUser['email']     ?? '';
            $authRole  = $authUser['role']      ?? '';
        } else {
            clear_token();
        }
    }
} catch (Exception $e) {
    clear_token();
}

if (!$isAuth || $authRole !== 'admin') {
    // Không phải admin thì đá ra trang login
    header('Location: login.php');
    exit;
}

?>
<!doctype html>
<html lang="vi" data-bs-theme="light">
<head>
  <meta charset="utf-8">
  <title>Admin Dashboard | E-Store.PC</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- Bootstrap -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <!-- Chart.js -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    :root{
      --brand:#0ea5e9;
      --brand-600:#0284c7;
    }

    body{
      background: radial-gradient(circle at 20% -10%, #eef7ff, transparent 40%),
                  radial-gradient(circle at 100% 0, #f8f5ff, transparent 35%),
                  #f7fafc;
      color:#1f2937;
    }

    .navbar{
      background:#ffffff !important;
      border-bottom:1px solid #e5e7eb;
    }

    .nav-link{
      color:#000000 !important;
      font-weight:500;
    }
    .nav-link.active{
      font-weight:700;
      text-decoration:underline;
      text-decoration-thickness:2px;
      text-underline-offset:4px;
    }

    .btn-brand{
      background:var(--brand);
      border-color:var(--brand);
      color:#ffffff;
      font-weight:600;
    }
    .btn-brand:hover{
      background:var(--brand-600);
      border-color:var(--brand-600);
      color:#ffffff;
    }

    /* Card style hài hoà với index.php */
    .card-dark{
      background:#ffffff;
      border:1px solid #e5e7eb;
      box-shadow:0 6px 14px rgba(0,0,0,.04);
      border-radius:.75rem;
    }

    .metric-label{
      font-size:.85rem;
      text-transform:uppercase;
      letter-spacing:.12em;
      color:#6b7280;
    }
    .metric-value{
      font-size:1.6rem;
      font-weight:700;
      color:#111827;
    }
    .metric-sub{
      font-size:.8rem;
      color:#9ca3af;
    }

    .badge-soft{
      background:#e6f4ff;
      color:#0369a1;
      border:1px solid #bae6fd;
      text-transform:uppercase;
      letter-spacing:.16em;
      font-size:.7rem;
    }

    .form-control,
    .form-select{
      background:#ffffff;
      border-color:#e5e7eb;
      color:#111827;
    }
    .form-control:focus,
    .form-select:focus{
      background:#ffffff;
      border-color:var(--brand);
      color:#111827;
      box-shadow:0 0 0 .25rem rgba(14,165,233,.25);
    }
    .form-control::placeholder{
      color:#9ca3af;
    }

    .text-brand{
      color:var(--brand);
    }
  </style>
</head>
<body>
<nav class="navbar navbar-expand-lg sticky-top navbar-light">
  <div class="container">
    <a class="navbar-brand fw-bold" style="color:var(--brand)" href="index.php">
      E-Store<span class="text-dark">.PC</span>
    </a>
    <button class="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#nav">
      <span class="navbar-toggler-icon"></span>
    </button>
    <div class="collapse navbar-collapse" id="nav">
      <ul class="navbar-nav me-auto">
        <li class="nav-item">
          <a class="nav-link" href="index.php">Trang khách</a>
        </li>
        <li class="nav-item">
          <a class="nav-link active" href="admin-dashboard.php">Admin Dashboard</a>
        </li>
        <li class="nav-item">
            <a class="nav-link" href="admin-products.php">Quản Lý Sản phẩm</a>
        </li>

        <li class="nav-item">
            <a class="nav-link" href="admin-users.php">Quản Lý Người dùng</a>
        </li>

        <li class="nav-item">
            <a class="nav-link" href="admin-orders.php">Đơn hàng</a>
        </li>

        <li class="nav-item">
            <a class="nav-link" href="admin-discounts.php">Giảm giá</a>
        </li>
      </ul>
      <div class="d-flex align-items-center gap-3">
        <span class="fw-semibold text-dark" style="font-size:.95rem;">
          Admin: <?= htmlspecialchars($authName ?: $authEmail) ?>
        </span>
        <a href="logout.php" class="btn btn-sm btn-outline-dark">Đăng xuất</a>
      </div>
    </div>
  </div>
</nav>

<main class="py-4">
  <div class="container">

    <!-- TIÊU ĐỀ -->
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <span class="badge badge-soft mb-2">Admin</span>
        <h2 class="mb-0">Bảng điều khiển</h2>
        <div class="text-secondary small">
          Tổng quan hiệu suất cửa hàng & thống kê nâng cao.
        </div>
      </div>
    </div>

    <!-- ========== SIMPLE DASHBOARD ========== -->
    <div class="mb-4">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <h5 class="mb-0">Bảng điều khiển đơn giản</h5>
        <span class="text-secondary small">
          Tổng quan nhanh về người dùng, đơn hàng, doanh thu và sản phẩm bán chạy.
        </span>
      </div>

      <!-- Metrics -->
      <div class="row g-3 mb-3">
        <div class="col-md-3">
          <div class="card card-dark h-100">
            <div class="card-body">
              <div class="metric-label">Tổng người dùng</div>
              <div id="metricTotalUsers" class="metric-value">...</div>
              <div class="metric-sub">Số tài khoản đã đăng ký trên hệ thống.</div>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card card-dark h-100">
            <div class="card-body">
              <div class="metric-label">Người dùng mới (7 ngày)</div>
              <div id="metricNewUsers" class="metric-value">...</div>
              <div class="metric-sub">Số user đăng ký mới trong 7 ngày gần đây.</div>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card card-dark h-100">
            <div class="card-body">
              <div class="metric-label">Tổng đơn hàng</div>
              <div id="metricTotalOrders" class="metric-value">...</div>
              <div class="metric-sub">Tổng số đơn hàng đã tạo.</div>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card card-dark h-100">
            <div class="card-body">
              <div class="metric-label">Tổng doanh thu</div>
              <div id="metricTotalRevenue" class="metric-value text-brand">...</div>
              <div class="metric-sub">Tổng tiền thu về từ các đơn hàng.</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Best-selling products chart -->
      <div class="card card-dark mb-4">
        <div class="card-body">
          <div class="d-flex justify-content-between mb-2">
            <div>
              <h6 class="mb-0">Sản phẩm bán chạy nhất</h6>
              <small class="text-secondary">Top 5 sản phẩm theo số lượng đã bán.</small>
            </div>
          </div>
          <canvas id="topProductsChart" height="120"></canvas>
        </div>
      </div>
    </div>

    <!-- ========== ADVANCED DASHBOARD ========== -->
    <div class="mb-4">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <div>
          <h5 class="mb-0">Bảng điều khiển nâng cao</h5>
          <small class="text-secondary">
            Xem thống kê theo năm / quý / tháng / tuần hoặc khoảng ngày tùy chọn.
          </small>
        </div>
      </div>

      <!-- Bộ lọc thời gian -->
      <div class="card card-dark mb-3">
        <div class="card-body">
          <div class="row g-3 align-items-end">
            <div class="col-md-3">
              <label class="form-label small">Kiểu thời gian</label>
              <select id="statsType" class="form-select">
                <option value="year">Hàng năm</option>
                <option value="quarter">Theo quý</option>
                <option value="month">Theo tháng</option>
                <option value="week">Theo tuần</option>
              </select>
            </div>
            <div class="col-md-3">
              <label class="form-label small">Từ ngày (tuỳ chọn)</label>
              <input type="date" id="fromDate" class="form-control">
            </div>
            <div class="col-md-3">
              <label class="form-label small">Đến ngày (tuỳ chọn)</label>
              <input type="date" id="toDate" class="form-control">
            </div>
            <div class="col-md-3">
              <button class="btn btn-brand w-100" id="btnReloadStats">
                Áp dụng bộ lọc
              </button>
            </div>
          </div>
          <div class="small text-secondary mt-2">
            - Nếu không chọn ngày bắt đầu/kết thúc, hệ thống sẽ thống kê toàn bộ dữ liệu.<br>
            - Các chỉ số: số đơn hàng, doanh thu, lợi nhuận, số sản phẩm bán & loại sản phẩm được tổng hợp theo khung thời gian đã chọn.
          </div>
        </div>
      </div>

      <!-- Chart thống kê -->
      <div class="card card-dark">
        <div class="card-body">
          <div class="d-flex justify-content-between mb-2">
            <div>
              <h6 class="mb-0">Thống kê doanh thu, lợi nhuận, đơn hàng & sản phẩm</h6>
              <small class="text-secondary" id="statsSubtitle">
                Mặc định hiển thị theo năm.
              </small>
            </div>
          </div>
          <canvas id="statsChart" height="140"></canvas>
        </div>
      </div>
    </div>

  </div>
</main>

<footer class="py-3 mt-4" style="background:#ffffff;border-top:1px solid #e5e7eb;">
  <div class="container d-flex justify-content-between small text-secondary">
    <span>E-Store.PC • Admin</span>
    <span>Dashboard đơn giản & nâng cao</span>
  </div>
</footer>

<script>
  // ====== CẤU HÌNH JS TỪ PHP ======
  const API_BASE  = <?= json_encode($apiBase) ?>;
  const AUTH_TOKEN = <?= json_encode($token ?: '') ?>;

  function formatVND(n) {
    const num = Number(n) || 0;
    return new Intl.NumberFormat('vi-VN').format(num) + 'đ';
  }

  function formatShortNumber(n) {
    n = Number(n) || 0;
    if (n >= 1_000_000_000) return (n/1_000_000_000).toFixed(1) + 'B';
    if (n >= 1_000_000)     return (n/1_000_000).toFixed(1)     + 'M';
    if (n >= 1_000)         return (n/1_000).toFixed(0)         + 'k';
    return n;
  }

  async function apiGet(path) {
    const res = await fetch(API_BASE + path, {
      headers: {
        'Authorization': AUTH_TOKEN ? ('Bearer ' + AUTH_TOKEN) : ''
      }
    });
    if (!res.ok) {
      throw new Error('HTTP ' + res.status);
    }
    return res.json();
  }

  let topProductsChart = null;
  let statsChart       = null;

  function renderTopProductsChart(items) {
    const ctx = document.getElementById('topProductsChart');
    if (!ctx) return;
    if (topProductsChart) topProductsChart.destroy();

    const labels = items.map(p => p.name);
    const data   = items.map(p => Number(p.sold) || 0);

    topProductsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Số lượng bán',
          data,
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.parsed.y} sản phẩm`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => formatShortNumber(value)
            }
          }
        }
      }
    });
  }

  // ======= BIỂU ĐỒ NÂNG CAO: doanh thu, lợi nhuận, số đơn, số sp, loại sp =======
  function renderStatsChart(rows, typeLabel) {
    const ctx = document.getElementById('statsChart');
    if (!ctx) return;
    if (statsChart) statsChart.destroy();

    const labels   = rows.map(r => r.label);
    const revenue  = rows.map(r => Number(r.revenue)        || 0);
    const profit   = rows.map(r => Number(r.profit)         || 0);
    const orders   = rows.map(r => Number(r.total_orders)   || 0);
    const products = rows.map(r => Number(r.total_products) || 0);
    const types    = rows.map(r => Number(r.product_types)  || 0);

    statsChart = new Chart(ctx, {
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Doanh thu',
            data: revenue,
            yAxisID: 'y',
          },
          {
            type: 'bar',
            label: 'Lợi nhuận',
            data: profit,
            yAxisID: 'y',
          },
          {
            type: 'line',
            label: 'Số đơn hàng',
            data: orders,
            yAxisID: 'y1',
          },
          {
            type: 'line',
            label: 'Số sản phẩm bán',
            data: products,
            yAxisID: 'y1',
          },
          {
            type: 'line',
            label: 'Số loại sản phẩm',
            data: types,
            yAxisID: 'y1',
          }
        ]
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: {
            position: 'left',
            beginAtZero: true,
            ticks: {
              callback: (v) => formatShortNumber(v)
            }
          },
          y1: {
            position: 'right',
            beginAtZero: true,
            grid: { drawOnChartArea: false },
            ticks: {
              callback: (v) => formatShortNumber(v)
            }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const label = ctx.dataset.label || '';
                const value = ctx.parsed.y;

                if (label === 'Doanh thu' || label === 'Lợi nhuận') {
                  return ` ${label}: ${formatVND(value)}`;
                }
                if (label === 'Số đơn hàng') {
                  return ` ${label}: ${value} đơn`;
                }
                if (label === 'Số sản phẩm bán') {
                  return ` ${label}: ${value} sản phẩm`;
                }
                if (label === 'Số loại sản phẩm') {
                  return ` ${label}: ${value} loại`;
                }
                return ` ${label}: ${value}`;
              }
            }
          }
        }
      }
    });

    const sub = document.getElementById('statsSubtitle');
    if (sub) {
      sub.textContent =
        `Đang hiển thị theo: ${typeLabel}. Bao gồm doanh thu, lợi nhuận, số đơn hàng, số sản phẩm & loại sản phẩm.`;
    }
  }

  async function loadOverview() {
    try {
      const data = await apiGet('/admin/dashboard/overview');

      const users  = data.users  || {};
      const orders = data.orders || {};
      const top    = data.topProducts || [];

      document.getElementById('metricTotalUsers').textContent   = users.total_users || 0;
      document.getElementById('metricNewUsers').textContent     = users.new_users   || 0;
      document.getElementById('metricTotalOrders').textContent  = orders.total_orders || 0;
      document.getElementById('metricTotalRevenue').textContent = formatVND(orders.total_revenue || 0);

      renderTopProductsChart(top);
    } catch (e) {
      console.error(e);
      alert('Không tải được dữ liệu tổng quan (overview). Kiểm tra console hoặc backend.');
    }
  }

  async function loadStats() {
    const typeSel = document.getElementById('statsType');
    const from    = document.getElementById('fromDate').value;
    const to      = document.getElementById('toDate').value;
    const type    = typeSel.value;

    const params = new URLSearchParams({ type });
    if (from && to) {
      params.append('from', from);
      params.append('to', to);
    }

    const typeLabelMap = {
      year: 'năm',
      quarter: 'quý',
      month: 'tháng',
      week: 'tuần'
    };
    const typeLabel = typeLabelMap[type] || type;

    try {
      const data = await apiGet('/admin/dashboard/stats?' + params.toString());
      renderStatsChart(data.data || [], typeLabel);
    } catch (e) {
      console.error(e);
      alert('Không tải được dữ liệu thống kê nâng cao (stats).');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!AUTH_TOKEN) {
      alert('Thiếu token đăng nhập admin. Vui lòng đăng nhập lại.');
      return;
    }

    loadOverview();
    loadStats();

    document.getElementById('btnReloadStats').addEventListener('click', (e) => {
      e.preventDefault();
      loadStats();
    });

    document.getElementById('statsType').addEventListener('change', () => {
      loadStats();
    });
  });
</script>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
