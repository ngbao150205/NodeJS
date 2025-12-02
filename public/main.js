// ================== KHỞI ĐỘNG TRANG CHỦ ==================
document.addEventListener("DOMContentLoaded", () => {
  initAuthUI();   // kiểm tra session, cập nhật header
  initAuthForms(); // gắn submit login / register
  initHomePage(); // load sản phẩm
});

// ================== AUTH UI & SESSION ==================

async function initAuthUI() {
  try {
    const res = await fetch("/api/auth/me");
    if (!res.ok) throw new Error("fail");
    const data = await res.json();
    renderAuthNav(data.user);
  } catch (err) {
    console.error("Lỗi lấy thông tin user:", err);
    renderAuthNav(null);
  }
}

function renderAuthNav(user) {
  const nav = document.getElementById("auth-nav");
  if (!nav) return;

  if (!user) {
    // Chưa đăng nhập
    nav.innerHTML = `
      <li class="nav-item">
        <a class="nav-link" href="#" data-bs-toggle="modal" data-bs-target="#registerModal">
          Đăng ký
        </a>
      </li>
      <li class="nav-item">
        <a class="nav-link" href="#" data-bs-toggle="modal" data-bs-target="#loginModal">
          Đăng nhập
        </a>
      </li>
    `;
  } else {
    // Đã đăng nhập
    const fullName = user.full_name || user.email;
    nav.innerHTML = `
      <li class="nav-item dropdown">
        <a
          class="nav-link dropdown-toggle"
          href="#"
          role="button"
          data-bs-toggle="dropdown"
          aria-expanded="false"
        >
          Xin chào, ${escapeHtml(fullName)}
        </a>
        <ul class="dropdown-menu dropdown-menu-end">
          <li><a class="dropdown-item" href="#">Hồ sơ của tôi (TODO)</a></li>
          <li><a class="dropdown-item" href="#">Đơn hàng của tôi (TODO)</a></li>
          <li><hr class="dropdown-divider" /></li>
          <li><a class="dropdown-item" href="#" id="btn-logout">Đăng xuất</a></li>
        </ul>
      </li>
    `;

    const logoutBtn = document.getElementById("btn-logout");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        await logout();
      });
    }
  }
}

async function logout() {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Lỗi logout:", err);
  } finally {
    // reload trang để UI reset
    window.location.reload();
  }
}

// ================== AUTH FORMS (LOGIN / REGISTER) ==================

function initAuthForms() {
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const btnLoginGoogle = document.getElementById("btn-login-google");

  if (loginForm) {
    loginForm.addEventListener("submit", onLoginSubmit);
  }
  if (registerForm) {
    registerForm.addEventListener("submit", onRegisterSubmit);
  }
  if (btnLoginGoogle) {
    btnLoginGoogle.addEventListener("click", () => {
      // Sau này bạn tạo route /auth/google bên backend rồi redirect ở đây
      // window.location.href = "/auth/google";
      alert("Google login: TODO – cần cấu hình OAuth & route backend.");
    });
  }
}

async function onLoginSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const errorEl = document.getElementById("login-error");
  errorEl.textContent = "";

  const formData = new FormData(form);
  const payload = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = data.message || "Đăng nhập thất bại.";
      return;
    }

    // Thành công: đóng modal, cập nhật nav
    const loginModalEl = document.getElementById("loginModal");
    const loginModal = bootstrap.Modal.getInstance(loginModalEl);
    loginModal && loginModal.hide();

    renderAuthNav(data.user);
  } catch (err) {
    console.error("Lỗi login:", err);
    errorEl.textContent = "Có lỗi xảy ra. Vui lòng thử lại.";
  }
}

async function onRegisterSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const errorEl = document.getElementById("register-error");
  errorEl.textContent = "";

  const formData = new FormData(form);
  const payload = {
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirm_password: formData.get("confirm_password"),
    phone: formData.get("phone"),
    details: formData.get("details"),
    district: formData.get("district"),
    city: formData.get("city"),
    postal_code: formData.get("postal_code"),
  };

  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = data.message || "Đăng ký thất bại.";
      return;
    }

    // Thành công: đóng modal, cập nhật nav
    const registerModalEl = document.getElementById("registerModal");
    const registerModal = bootstrap.Modal.getInstance(registerModalEl);
    registerModal && registerModal.hide();

    renderAuthNav(data.user);
    form.reset();
  } catch (err) {
    console.error("Lỗi register:", err);
    errorEl.textContent = "Có lỗi xảy ra. Vui lòng thử lại.";
  }
}

// ================== LOAD DỮ LIỆU TRANG CHỦ (SẢN PHẨM) ==================

async function initHomePage() {
  try {
    const res = await fetch("/api/home");
    if (!res.ok) {
      throw new Error("Không thể load dữ liệu trang chủ");
    }
    const data = await res.json();

    renderProductList("new-products", data.newProducts || []);
    renderProductList("best-products", data.bestSellers || []);
    renderCategoryBlocks(data.categories || [], data.productsByCategory || {});
  } catch (err) {
    console.error(err);
    showError("new-products", "Không thể tải sản phẩm mới. Vui lòng thử lại.");
    showError("best-products", "Không thể tải sản phẩm bán chạy. Vui lòng thử lại.");
  }
}

function showError(containerId, message) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `<div class="text-danger small py-2">${message}</div>`;
}

function formatPrice(price) {
  if (price == null) return "Liên hệ";
  const num = Number(price);
  if (Number.isNaN(num)) return "Liên hệ";
  return num.toLocaleString("vi-VN") + "₫";
}

function renderProductList(containerId, products) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!products || products.length === 0) {
    container.innerHTML = `<div class="text-muted small py-2">Chưa có sản phẩm phù hợp.</div>`;
    return;
  }

  const visible = products.slice(0, 5);
  container.innerHTML = "";

  visible.forEach((p) => {
    const card = document.createElement("div");
    card.className = "card product-card shadow-sm";

    const imgUrl =
      p.image || p.image_url || "https://via.placeholder.com/300x200?text=No+Image";

    card.innerHTML = `
      <div class="product-img-wrapper">
        <img src="${imgUrl}" alt="${escapeHtml(p.name || "")}">
      </div>
      <div class="card-body d-flex flex-column">
        <h5 class="product-title">${escapeHtml(p.name || "Sản phẩm")}</h5>
        ${
          p.brand
            ? `<div class="product-brand mb-1">Thương hiệu: ${escapeHtml(
                p.brand
              )}</div>`
            : ""
        }
        <div class="product-price">${formatPrice(p.price)}</div>
        <div class="d-flex justify-content-between align-items-center product-meta mt-1">
          <span>Đã bán: ${p.sold != null ? p.sold : 0}</span>
          <span>⭐ ${p.avg_rating != null ? Number(p.avg_rating).toFixed(1) : "0.0"}</span>
        </div>
        <button class="btn btn-sm btn-primary rounded-pill mt-2 btn-buy" data-id="${
          p.id
        }">
          Mua ngay
        </button>
      </div>
    `;

    container.appendChild(card);
  });

  container.querySelectorAll(".btn-buy").forEach((btn) => {
    btn.addEventListener("click", () => {
      const productId = btn.getAttribute("data-id");
      alert(
        "Mua sản phẩm ID: " +
          productId +
          "\n(Sau này nối vào chức năng thanh toán & tự tạo tài khoản nếu khách chưa đăng nhập)"
      );
    });
  });
}

function renderCategoryBlocks(categories, productsByCategory) {
  const container = document.getElementById("categories-container");
  if (!container) return;
  container.innerHTML = "";

  if (!categories || categories.length === 0) {
    container.innerHTML =
      '<div class="text-muted small py-2">Chưa có danh mục sản phẩm.</div>';
    return;
  }

  const order = ["laptop", "monitor", "hard-drive", "hdd", "ssd"];
  categories.sort((a, b) => {
    const ia = order.indexOf(a.key);
    const ib = order.indexOf(b.key);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  categories.forEach((cat) => {
    const block = document.createElement("div");
    block.className = "card border-0 shadow-sm";

    block.innerHTML = `
      <div class="card-body">
        <h3 class="h6 mb-2">${escapeHtml(cat.label || cat.name || "Danh mục")}</h3>
        <div class="product-row" id="cat-${cat.key}">
          <div class="text-muted small py-2">Đang tải sản phẩm...</div>
        </div>
      </div>
    `;

    container.appendChild(block);

    const list = productsByCategory[cat.key] || [];
    renderProductList(`cat-${cat.key}`, list);
  });
}

// Helper escape HTML
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
