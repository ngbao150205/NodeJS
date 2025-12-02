// public/admin/admin-common.js

document.addEventListener("DOMContentLoaded", () => {
  ensureAdminOnly();
});

async function ensureAdminOnly() {
  try {
    const res = await fetch("/api/auth/me");
    if (!res.ok) throw new Error("fail");

    const data = await res.json();
    const user = data.user;

    // Không đăng nhập hoặc không phải admin -> đá về trang khách
    if (!user || user.role !== "admin") {
      window.location.href = "/index.html";
      return;
    }

    // Nếu muốn, bạn có thể log ra để debug:
    console.log("Admin logged in:", user.email || user.full_name);
  } catch (err) {
    console.error("Lỗi kiểm tra quyền admin:", err);
    window.location.href = "/index.html";
  }
}
