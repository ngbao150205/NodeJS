// forgot-password.js
let emailForReset = null;

document.addEventListener("DOMContentLoaded", () => {
  const formRequest = document.getElementById("form-request-otp");
  const formReset = document.getElementById("form-reset-password");

  if (formRequest) {
    formRequest.addEventListener("submit", onRequestOtp);
  }
  if (formReset) {
    formReset.addEventListener("submit", onResetPassword);
  }
});

async function onRequestOtp(e) {
  e.preventDefault();
  const form = e.target;
  const email = form.email.value.trim();
  const err = document.getElementById("forgot-error");
  const ok = document.getElementById("forgot-success");
  err.textContent = "";
  ok.textContent = "";

  if (!email) {
    err.textContent = "Vui lòng nhập email.";
    return;
  }

  try {
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();

    if (!res.ok) {
      err.textContent = data.message || "Không thể gửi OTP. Vui lòng thử lại.";
      return;
    }

    ok.textContent = data.message || "Đã gửi OTP đến email của bạn.";

    emailForReset = email;
    showResetStep(email);
  } catch (error) {
    console.error("Lỗi gửi OTP:", error);
    err.textContent = "Có lỗi xảy ra. Vui lòng thử lại.";
  }
}

function showResetStep(email) {
  const formRequest = document.getElementById("form-request-otp");
  const formReset = document.getElementById("form-reset-password");
  const emailInfo = document.getElementById("reset-email-info");
  const emailInput = document.getElementById("reset-email");

  if (formReset) formReset.classList.remove("d-none");
  if (emailInfo)
    emailInfo.textContent =
      "Mã OTP đã được gửi tới email: " + email + ". Vui lòng kiểm tra hộp thư (hoặc Spam).";
  if (emailInput) emailInput.value = email;
}

async function onResetPassword(e) {
  e.preventDefault();
  const form = e.target;
  const otp = form.otp.value.trim();
  const newPassword = form.new_password.value;
  const confirmPassword = form.confirm_password.value;
  const err = document.getElementById("reset-error");
  const ok = document.getElementById("reset-success");
  err.textContent = "";
  ok.textContent = "";

  if (!emailForReset) {
    err.textContent = "Vui lòng nhập email và yêu cầu gửi OTP trước.";
    return;
  }

  if (!otp || !newPassword || !confirmPassword) {
    err.textContent = "Vui lòng nhập đầy đủ OTP và mật khẩu mới.";
    return;
  }

  try {
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: emailForReset,
        otp,
        new_password: newPassword,
        confirm_password: confirmPassword,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      err.textContent = data.message || "Đặt lại mật khẩu thất bại.";
      return;
    }

    ok.textContent = data.message || "Đặt lại mật khẩu thành công.";
    // Sau vài giây chuyển sang trang đăng nhập
    setTimeout(() => {
      window.location.href = "/login.html";
    }, 1500);
  } catch (error) {
    console.error("Lỗi reset password:", error);
    err.textContent = "Có lỗi xảy ra. Vui lòng thử lại.";
  }
}
