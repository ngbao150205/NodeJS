// profile.js
let currentProfile = null;

document.addEventListener("DOMContentLoaded", () => {
  loadProfile();

  const profileForm = document.getElementById("profile-form");
  const passwordForm = document.getElementById("password-form");
  const addressForm = document.getElementById("address-form");
  const addressCancelBtn = document.getElementById("address-cancel-btn");

  if (profileForm) profileForm.addEventListener("submit", onProfileSubmit);
  if (passwordForm) passwordForm.addEventListener("submit", onPasswordSubmit);
  if (addressForm) addressForm.addEventListener("submit", onAddressSubmit);
  if (addressCancelBtn) addressCancelBtn.addEventListener("click", resetAddressForm);
});

async function loadProfile() {
  try {
    const res = await fetch("/api/profile");
    if (res.status === 401) {
      // chưa đăng nhập -> về login
      window.location.href = "/login.html";
      return;
    }
    if (!res.ok) throw new Error("fail");
    const data = await res.json();
    currentProfile = data;
    renderProfile(data);
    renderAddresses(data.addresses || []);
  } catch (err) {
    console.error("Lỗi load profile:", err);
    alert("Không thể tải hồ sơ. Vui lòng thử lại.");
  }
}

function renderProfile(data) {
  const u = data.user;
  if (!u) return;

  const emailEl = document.getElementById("profile-email");
  const fullEl = document.getElementById("profile-fullname");
  const providerEl = document.getElementById("profile-provider");
  const pointsEl = document.getElementById("profile-points");

  if (emailEl) emailEl.value = u.email || "";
  if (fullEl) fullEl.value = u.full_name || "";
  if (providerEl)
    providerEl.value =
      u.provider === "google"
        ? "Google (đăng nhập bằng Google)"
        : "Local (đăng nhập bằng email/mật khẩu)";
  if (pointsEl) pointsEl.value = u.loyalty_points ?? 0;
}

async function onProfileSubmit(e) {
  e.preventDefault();
  const fullInput = document.getElementById("profile-fullname");
  const errorEl = document.getElementById("profile-error");
  const successEl = document.getElementById("profile-success");
  errorEl.textContent = "";
  successEl.textContent = "";

  try {
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: fullInput.value }),
    });
    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = data.message || "Cập nhật hồ sơ thất bại.";
      return;
    }
    successEl.textContent = "Cập nhật hồ sơ thành công.";
    currentProfile = data;
  } catch (err) {
    console.error("Lỗi cập nhật profile:", err);
    errorEl.textContent = "Có lỗi xảy ra, vui lòng thử lại.";
  }
}

async function onPasswordSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const errorEl = document.getElementById("password-error");
  const successEl = document.getElementById("password-success");
  errorEl.textContent = "";
  successEl.textContent = "";

  const formData = new FormData(form);
  const payload = {
    current_password: formData.get("current_password"),
    new_password: formData.get("new_password"),
    confirm_password: formData.get("confirm_password"),
  };

  try {
    const res = await fetch("/api/profile/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = data.message || "Đổi mật khẩu thất bại.";
      return;
    }
    successEl.textContent = data.message || "Đổi mật khẩu thành công.";
    form.reset();
  } catch (err) {
    console.error("Lỗi đổi mật khẩu:", err);
    errorEl.textContent = "Có lỗi xảy ra. Vui lòng thử lại.";
  }
}

// ===== ĐỊA CHỈ =====

function renderAddresses(addresses) {
  const container = document.getElementById("addresses-list");
  if (!container) return;

  if (!addresses || addresses.length === 0) {
    container.innerHTML =
      '<div class="text-muted small">Chưa có địa chỉ giao hàng nào. Hãy thêm địa chỉ mới phía dưới.</div>';
    return;
  }

  container.innerHTML = "";

  addresses.forEach((a) => {
    const div = document.createElement("div");
    div.className = "border rounded p-2 mb-2 bg-white";

    div.innerHTML = `
      <div class="d-flex justify-content-between align-items-start">
        <div>
          <div class="fw-semibold">
            ${escapeHtml(a.label || "Địa chỉ")}
            ${
              a.is_default
                ? '<span class="badge bg-success ms-1">Mặc định</span>'
                : ""
            }
          </div>
          <div class="small text-muted">
            Người nhận: ${escapeHtml(a.receiver_name || "")} ${
      a.phone ? " - " + escapeHtml(a.phone) : ""
    }
          </div>
          <div class="small">
  ${escapeHtml(a.details)}, ${escapeHtml(a.district)}, ${escapeHtml(a.city)}
</div>
        </div>
        <div class="ms-2 d-flex flex-column gap-1">
          <button class="btn btn-sm btn-outline-primary btn-edit-address" data-id="${
            a.id
          }">Sửa</button>
          <button class="btn btn-sm btn-outline-danger btn-delete-address" data-id="${
            a.id
          }">Xoá</button>
          ${
            !a.is_default
              ? `<button class="btn btn-sm btn-outline-success btn-set-default" data-id="${a.id}">Đặt mặc định</button>`
              : ""
          }
        </div>
      </div>
    `;

    container.appendChild(div);
  });

  container.querySelectorAll(".btn-edit-address").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const addr = (currentProfile?.addresses || []).find(
        (a) => String(a.id) === String(id)
      );
      if (addr) fillAddressForm(addr);
    });
  });

  container.querySelectorAll(".btn-delete-address").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      if (confirm("Bạn có chắc muốn xoá địa chỉ này?")) {
        deleteAddress(id);
      }
    });
  });

  container.querySelectorAll(".btn-set-default").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      setDefaultAddress(id);
    });
  });

  // Lưu addresses vào currentProfile để dùng lại
  if (!currentProfile) currentProfile = {};
  currentProfile.addresses = addresses;
}

function fillAddressForm(addr) {
  document.getElementById("address-id").value = addr.id;
  document.getElementById("address-label").value = addr.label || "";
  document.getElementById("address-receiver").value = addr.receiver_name || "";
  document.getElementById("address-phone").value = addr.phone || "";
  document.getElementById("address-details").value = addr.details || "";
  document.getElementById("address-district").value = addr.district || "";
  document.getElementById("address-city").value = addr.city || "";
  //document.getElementById("address-postal").value = addr.postal_code || "";
  document.getElementById("address-is-default").checked = !!addr.is_default;

  const title = document.getElementById("address-form-title");
  if (title) title.textContent = "Sửa địa chỉ";
}

function resetAddressForm() {
  document.getElementById("address-id").value = "";
  document.getElementById("address-label").value = "";
  document.getElementById("address-receiver").value = "";
  document.getElementById("address-phone").value = "";
  document.getElementById("address-details").value = "";
  document.getElementById("address-district").value = "";
  document.getElementById("address-city").value = "";
  //document.getElementById("address-postal").value = "";
  document.getElementById("address-is-default").checked = false;

  const err = document.getElementById("address-error");
  const ok = document.getElementById("address-success");
  if (err) err.textContent = "";
  if (ok) ok.textContent = "";

  const title = document.getElementById("address-form-title");
  if (title) title.textContent = "Thêm địa chỉ mới";
}

async function onAddressSubmit(e) {
  e.preventDefault();
  const id = document.getElementById("address-id").value;
  const label = document.getElementById("address-label").value;
  const receiver_name = document.getElementById("address-receiver").value;
  const phone = document.getElementById("address-phone").value;
  const details = document.getElementById("address-details").value;
  const district = document.getElementById("address-district").value;
  const city = document.getElementById("address-city").value;
  //const postal_code = document.getElementById("address-postal").value;
  const is_default = document.getElementById("address-is-default").checked;

  const err = document.getElementById("address-error");
  const ok = document.getElementById("address-success");
  err.textContent = "";
  ok.textContent = "";

  const payload = {
    label,
    receiver_name,
    phone,
    details,
    district,
    city,
    //postal_code,
    is_default,
  };

  try {
    const url = id
      ? `/api/profile/addresses/${id}`
      : "/api/profile/addresses";
    const method = id ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      err.textContent = data.message || "Lưu địa chỉ thất bại.";
      return;
    }

    ok.textContent = data.message || "Lưu địa chỉ thành công.";

    const addresses = data.addresses;
    renderAddresses(addresses);
    resetAddressForm();
  } catch (error) {
    console.error("Lỗi lưu địa chỉ:", error);
    err.textContent = "Có lỗi xảy ra. Vui lòng thử lại.";
  }
}

async function deleteAddress(id) {
  const err = document.getElementById("address-error");
  const ok = document.getElementById("address-success");
  err.textContent = "";
  ok.textContent = "";

  try {
    const res = await fetch(`/api/profile/addresses/${id}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) {
      err.textContent = data.message || "Xoá địa chỉ thất bại.";
      return;
    }
    ok.textContent = data.message || "Xoá địa chỉ thành công.";
    renderAddresses(data.addresses || []);
  } catch (error) {
    console.error("Lỗi xoá địa chỉ:", error);
    err.textContent = "Có lỗi xảy ra. Vui lòng thử lại.";
  }
}

async function setDefaultAddress(id) {
  const err = document.getElementById("address-error");
  const ok = document.getElementById("address-success");
  err.textContent = "";
  ok.textContent = "";

  try {
    const res = await fetch(`/api/profile/addresses/${id}/default`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      err.textContent = data.message || "Đặt mặc định thất bại.";
      return;
    }
    ok.textContent = data.message || "Đặt địa chỉ mặc định thành công.";
    renderAddresses(data.addresses || []);
  } catch (error) {
    console.error("Lỗi đặt mặc định:", error);
    err.textContent = "Có lỗi xảy ra. Vui lòng thử lại.";
  }
}
