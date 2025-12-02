// register.js
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("register-form");
  const errorEl = document.getElementById("register-error");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
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

      // Thành công: chuyển về trang chủ (đã được login luôn)
      window.location.href = "/index.html";
    } catch (err) {
      console.error("Lỗi register:", err);
      errorEl.textContent = "Có lỗi xảy ra. Vui lòng thử lại.";
    }
  });
});
