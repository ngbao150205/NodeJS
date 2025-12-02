// login.js
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login-form");
  const errorEl = document.getElementById("login-error");
  const btnLoginGoogle = document.getElementById("btn-login-google");

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
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

        // Nếu login fail (sai pass, sai email, bị cấm mà backend đã trả lỗi sẵn, ...)
        if (!res.ok) {
          errorEl.textContent = data.message || "Đăng nhập thất bại.";
          return;
        }

        // ✅ CHECK TÀI KHOẢN BỊ CẤM
        const user = data.user || {};
        const banned =
          user.is_banned === 1 ||
          user.is_banned === true ||
          user.is_banned === "1";

        if (banned) {
          errorEl.textContent =
            "Tài khoản này đã bị cấm. Vui lòng liên hệ quản trị.";
          
          // Nếu backend vẫn lỡ tạo session, có thể logout luôn (không bắt buộc)
          try {
            await fetch("/api/auth/logout", { method: "POST" });
          } catch (e) {
            console.warn("Logout khi bị cấm lỗi (có thể bỏ qua):", e);
          }

          return;
        }

        // Thành công -> về trang chủ
        window.location.href = "/index.html";
      } catch (err) {
        console.error("Lỗi login:", err);
        errorEl.textContent = "Có lỗi xảy ra. Vui lòng thử lại.";
      }
    });
  }

  if (btnLoginGoogle) {
    btnLoginGoogle.addEventListener("click", () => {
      window.location.href = "/api/auth/google";
    });
  }
});

