// common.js
document.addEventListener("DOMContentLoaded", () => {
  initAuthUI();
});

async function initAuthUI() {
  const nav = document.getElementById("auth-nav");
  if (!nav) return; // nếu trang không có header này thì bỏ qua

  let user = null;

  try {
    const res = await fetch("/api/auth/me");
    if (!res.ok) throw new Error("fail");
    const data = await res.json();
    user = data.user || null;
  } catch (err) {
    console.error("Lỗi lấy thông tin user:", err);
    user = null;
  }

  renderAuthNav(user);
  updateAdminLink(user); // 🔥 show/hide nút Admin bên cạnh Giỏ hàng
}

function renderAuthNav(user) {
  const nav = document.getElementById("auth-nav");
  if (!nav) return;

  if (!user) {
    // Chưa đăng nhập
    nav.innerHTML = `
      <li class="nav-item">
        <a class="nav-link" href="/register.html">Đăng ký</a>
      </li>
      <li class="nav-item">
        <a class="nav-link" href="/login.html">Đăng nhập</a>
      </li>
    `;
  } else {
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
          <li><a class="dropdown-item" href="/profile.html">Hồ sơ của tôi</a></li>
          <li><a class="dropdown-item" href="/account-orders.html">Đơn hàng của tôi</a></li>
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

/**
 * Hiện / ẩn nút Admin ở navbar chính (li#nav-admin-li)
 * Chỉ hiện nếu user có quyền admin.
 */
function updateAdminLink(user) {
  const adminLi = document.getElementById("nav-admin-li");
  if (!adminLi) return; // trang hiện tại không có nút admin thì bỏ qua

  const isAdmin =
    user &&
    (
      user.role === "admin" ||
      user.role === "ADMIN" ||
      user.is_admin === 1 ||
      user.is_admin === true
    );

  if (isAdmin) {
    adminLi.classList.remove("d-none");
  } else {
    adminLi.classList.add("d-none");
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
    window.location.href = "/index.html";
  }
}

// Helper escape HTML để dùng chung
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
