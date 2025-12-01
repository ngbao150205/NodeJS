// public/checkout.js

let checkoutState = {
  items: [],
  summary: null,
  user: null,
  addresses: [],
  defaultAddress: null,
  shipping: null,
  paymentMethod: "cod",
  coupon: null, // { code, percent_off }

  // Loyalty
  loyaltyPoints: 0,        // điểm hiện có của user
  useLoyaltyPoints: false, // có tick dùng điểm không
};

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.Cart) {
    alert("Giỏ hàng chưa sẵn sàng.");
    return;
  }

  // CHỈ lấy những item đã được tick trong giỏ hàng
  const selected = Cart.getSelectedItems
    ? Cart.getSelectedItems()
    : (Cart.getItems() || []).filter((it) => !!it.selected);

  if (!selected.length) {
    alert(
      "Không có sản phẩm nào được chọn để thanh toán. Vui lòng quay lại giỏ hàng và tick chọn sản phẩm."
    );
    window.location.href = "/cart.html";
    return;
  }

  checkoutState.items = selected;
  checkoutState.summary = calcSummary(selected, checkoutState.coupon);

  // Lấy user + địa chỉ + điểm thưởng
  await initUserAndDefaultAddress();
  initLoyaltySection(); // <- KHỞI TẠO UI điểm thưởng

  renderStep1Items();
  renderSummaryBox();
  initStepNavigation();
  initPaymentSection();
  initCouponUI();
});

/* ========= Helpers ========= */

function formatPrice(price) {
  if (price == null) return "Liên hệ";
  const num = Number(price);
  if (Number.isNaN(num)) return "Liên hệ";
  return num.toLocaleString("vi-VN") + "₫";
}

function calcSummary(items, coupon) {
  let totalQty = 0;
  let subtotal = 0;

  items.forEach((it) => {
    const qty = Number(it.qty) || 0;
    const price = Number(it.price) || 0;
    totalQty += qty;
    subtotal += qty * price;
  });

  const tax = Math.round(subtotal * 0.1);
  const shipping = subtotal > 0 ? 30000 : 0;

  let discount = 0;
  if (coupon && coupon.percent_off) {
    discount = Math.round(subtotal * (Number(coupon.percent_off) / 100));
    if (discount < 0) discount = 0;
    if (discount > subtotal) discount = subtotal;
  }

  // total này CHỈ là: tạm tính + thuế + ship – giảm giá (mã),
  // CHƯA trừ điểm thưởng
  let total = subtotal + tax + shipping - discount;
  if (total < 0) total = 0;

  return {
    totalQty,
    subtotal,
    tax,
    shipping,
    discount,
    total,
  };
}

// Base total = subtotal + tax + shipping - discount (chưa trừ điểm)
function calcBaseTotal() {
  const s = checkoutState.summary;
  if (!s) return 0;
  const subtotal = Number(s.subtotal) || 0;
  const tax = Number(s.tax) || 0;
  const shipping = Number(s.shipping) || 0;
  const discount = Number(s.discount) || 0;
  return subtotal + tax + shipping - discount;
}

// Tính số tiền sẽ được trừ khi dùng điểm thưởng (preview)
function getLoyaltyDiscountPreview() {
  if (!checkoutState.useLoyaltyPoints) return 0;
  const points = Number(checkoutState.loyaltyPoints || 0);
  if (!points) return 0;

  const baseTotal = calcBaseTotal();
  if (baseTotal <= 0) return 0;

  const POINT_VALUE = 1000; // 1 điểm = 1.000đ
  const maxDiscount = points * POINT_VALUE;
  return Math.min(maxDiscount, baseTotal);
}

/* ========= Lấy user + danh sách địa chỉ từ server ========= */

async function initUserAndDefaultAddress() {
  try {
    const res = await fetch("/api/checkout/init");
    if (!res.ok) return;
    const data = await res.json();

    checkoutState.user = data.user || null;
    checkoutState.addresses = data.addresses || [];
    checkoutState.defaultAddress = data.defaultAddress || null;

    // Lưu điểm thưởng (nếu backend trả về user.loyalty_points)
    if (checkoutState.user && typeof checkoutState.user.loyalty_points === "number") {
      checkoutState.loyaltyPoints = checkoutState.user.loyalty_points;
    } else {
      checkoutState.loyaltyPoints = 0;
    }

    // nếu server không set defaultAddress mà vẫn có addresses
    if (!checkoutState.defaultAddress && checkoutState.addresses.length > 0) {
      checkoutState.defaultAddress =
        checkoutState.addresses.find((a) => a.is_default) ||
        checkoutState.addresses[0];
    }

    renderSavedAddressesSelect();
    fillShippingForm();
  } catch (err) {
    console.error("Lỗi init checkout:", err);
  }
}

/* ========= Loyalty UI ========= */

function initLoyaltySection() {
  const wrapper = document.getElementById("loyalty-wrapper");
  const checkbox = document.getElementById("use-loyalty-points");
  const infoEl = document.getElementById("loyalty-info");

  if (!wrapper || !checkbox || !infoEl) return;

  const user = checkoutState.user;
  const points = Number(checkoutState.loyaltyPoints || 0);

  // Logic hiển thị / ẩn checkbox
  if (user && points > 0) {
    wrapper.style.display = "block";
  } else {
    wrapper.style.display = "none";
  }

  checkbox.checked = false;
  checkoutState.useLoyaltyPoints = false;
  updateLoyaltyInfoText();

  if (!checkbox.dataset.bound) {
    checkbox.addEventListener("change", () => {
      checkoutState.useLoyaltyPoints = checkbox.checked;
      renderSummaryBox();        // cập nhật tổng tiền bên phải
      renderConfirmItemsSummary(); // cập nhật bước 3
      updateLoyaltyInfoText();
    });
    checkbox.dataset.bound = "1";
  }
}

function updateLoyaltyInfoText() {
  const infoEl = document.getElementById("loyalty-info");
  if (!infoEl) return;

  const user = checkoutState.user;
  const points = Number(checkoutState.loyaltyPoints || 0);

  if (!user) {
    infoEl.textContent =
      "Đăng nhập để tích lũy và sử dụng điểm thưởng (10% giá trị đơn hàng).";
    return;
  }

  if (!points) {
    infoEl.textContent =
      "Bạn chưa có điểm thưởng. Hãy mua hàng để tích điểm (10% giá trị đơn hàng).";
    return;
  }

  const baseText = `Bạn có ${points} điểm (tương đương ${formatPrice(
    points * 1000
  )}).`;

  if (!checkoutState.useLoyaltyPoints) {
    infoEl.textContent = baseText + " Tick vào để sử dụng toàn bộ điểm cho đơn này.";
    return;
  }

  const discount = getLoyaltyDiscountPreview();
  if (discount <= 0) {
    infoEl.textContent =
      baseText +
      " Tổng tiền hiện tại quá thấp nên điểm thưởng chưa được áp dụng.";
    return;
  }

  const baseTotal = calcBaseTotal();
  const finalTotal = baseTotal - discount;

  infoEl.textContent =
    baseText +
    ` Bạn đang sử dụng toàn bộ điểm: giảm ${formatPrice(
      discount
    )}, số tiền phải thanh toán còn ${formatPrice(finalTotal)}.`;
}

/* ========= Render dropdown chọn địa chỉ đã lưu ========= */

function renderSavedAddressesSelect() {
  const container = document.getElementById("saved-address-container");
  const selectEl = document.getElementById("checkout-address-select");
  if (!container || !selectEl) return;

  const user = checkoutState.user;
  const addresses = checkoutState.addresses || [];

  if (!user || !addresses.length) {
    container.style.display = "none";
    return;
  }

  container.style.display = "block";

  // Dọn options
  selectEl.innerHTML = "";

  const optEmpty = document.createElement("option");
  optEmpty.value = "";
  optEmpty.textContent = "-- Chọn địa chỉ --";
  selectEl.appendChild(optEmpty);

  addresses.forEach((addr) => {
    const opt = document.createElement("option");
    opt.value = String(addr.id);
    const label = addr.label || "Địa chỉ";
    const tail = [addr.details, addr.district, addr.city]
      .filter(Boolean)
      .join(", ");
    opt.textContent =
      (addr.is_default ? "[Mặc định] " : "") +
      label +
      (tail ? " - " + tail : "");
    selectEl.appendChild(opt);
  });

  // Nếu có defaultAddress -> chọn sẵn trong select
  if (checkoutState.defaultAddress) {
    selectEl.value = String(checkoutState.defaultAddress.id);
  }

  // Chỉ bind event một lần
  if (!selectEl.dataset.bound) {
    selectEl.addEventListener("change", () => {
      const id = selectEl.value;
      if (!id) return;
      const addr = addresses.find((a) => String(a.id) === String(id));
      if (addr) {
        applyAddressToForm(addr);
      }
    });
    selectEl.dataset.bound = "1";
  }
}

/* ========= Fill form shipping ========= */

function fillShippingForm() {
  const emailInput = document.getElementById("checkout-email");
  const fullNameInput = document.getElementById("checkout-full-name");
  const receiverInput = document.getElementById("checkout-receiver-name");

  if (!emailInput || !fullNameInput) return;

  // Nếu đã đăng nhập -> email & full name từ tài khoản
  if (checkoutState.user) {
    emailInput.value = checkoutState.user.email || "";
    emailInput.readOnly = true;
    fullNameInput.value = checkoutState.user.full_name || "";
  }

  const defaultAddr = checkoutState.defaultAddress;
  if (defaultAddr) {
    applyAddressToForm(defaultAddr);
  } else {
    // Không có địa chỉ mặc định: set người nhận = full name nếu có
    if (!receiverInput.value && fullNameInput.value) {
      receiverInput.value = fullNameInput.value;
    }
  }
}

/**
 * Gán thông tin một address vào các input shipping
 */
function applyAddressToForm(addr) {
  if (!addr) return;

  const receiverInput = document.getElementById("checkout-receiver-name");
  const phoneInput = document.getElementById("checkout-phone");
  const addrInput = document.getElementById("checkout-address-details");
  const districtInput = document.getElementById("checkout-district");
  const cityInput = document.getElementById("checkout-city");
  //const postalInput = document.getElementById("checkout-postal-code");

  if (receiverInput) receiverInput.value = addr.receiver_name || "";
  if (phoneInput) phoneInput.value = addr.phone || "";
  if (addrInput) addrInput.value = addr.details || "";
  if (districtInput) districtInput.value = addr.district || "";
  if (cityInput) cityInput.value = addr.city || "";
  //if (postalInput) postalInput.value = addr.postal_code || "";
}

/* ========= Render bước 1: sản phẩm ========= */

function renderStep1Items() {
  const tbody = document.getElementById("checkout-items-body");
  if (!tbody) return;

  if (!checkoutState.items.length) {
    tbody.innerHTML =
      '<tr><td colspan="4" class="text-center text-muted">Không có sản phẩm nào để thanh toán.</td></tr>';
    return;
  }

  tbody.innerHTML = "";
  checkoutState.items.forEach((it) => {
    const qty = Number(it.qty) || 0;
    const price = Number(it.price) || 0;
    const lineTotal = qty * price;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div class="fw-semibold">${escapeHtml(it.name || "Sản phẩm")}</div>
        <div class="text-muted small">ID: ${it.productId}</div>
      </td>
      <td class="text-center">${qty}</td>
      <td class="text-end">${formatPrice(price)}</td>
      <td class="text-end">${formatPrice(lineTotal)}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* ========= Render tóm tắt bên phải ========= */

function renderSummaryBox() {
  const listEl = document.getElementById("summary-items-list");
  const totalQtyEl = document.getElementById("summary-total-qty");
  const subtotalEl = document.getElementById("summary-subtotal");
  const taxEl = document.getElementById("summary-tax");
  const shippingEl = document.getElementById("summary-shipping");
  const discountEl = document.getElementById("summary-discount");
  const totalEl = document.getElementById("summary-total-amount");

  const s = checkoutState.summary;
  if (!s) return;

  if (listEl) {
    listEl.innerHTML = "";
    checkoutState.items.forEach((it) => {
      const div = document.createElement("div");
      div.className = "d-flex justify-content-between mb-1";
      div.innerHTML = `
        <span class="me-2 text-truncate" style="max-width: 220px;">
          ${escapeHtml(it.name || "Sản phẩm")}
        </span>
        <span class="text-nowrap">x${it.qty}</span>
      `;
      listEl.appendChild(div);
    });
  }

  if (totalQtyEl) totalQtyEl.textContent = s.totalQty;
  if (subtotalEl) subtotalEl.textContent = formatPrice(s.subtotal);
  if (taxEl) taxEl.textContent = formatPrice(s.tax);
  if (shippingEl) shippingEl.textContent = formatPrice(s.shipping);

  // TÍNH GIẢM GIÁ + ĐIỂM THƯỞNG CHO SUMMARY
  const loyaltyDiscount = getLoyaltyDiscountPreview();
  const totalDiscount = (Number(s.discount) || 0) + loyaltyDiscount;
  const finalTotal = calcBaseTotal() - loyaltyDiscount;

  if (discountEl) {
    if (totalDiscount > 0) {
      discountEl.textContent = "-" + formatPrice(totalDiscount);
    } else {
      discountEl.textContent = "0₫";
    }
  }

  if (totalEl) totalEl.textContent = formatPrice(finalTotal);

  // cập nhật text mô tả điểm thưởng
  updateLoyaltyInfoText();
}

/* ========= Điều hướng step ========= */

function initStepNavigation() {
  const btnStep1Next = document.getElementById("btn-step1-next");
  const formShipping = document.getElementById("checkout-shipping-form");
  const btnStep2Prev = document.getElementById("btn-step2-prev");
  const btnStep3Prev = document.getElementById("btn-step3-prev");

  if (btnStep1Next) {
    btnStep1Next.addEventListener("click", () => {
      if (!checkoutState.items.length) {
        alert("Không có sản phẩm nào để thanh toán.");
        return;
      }
      goToStep(2);
    });
  }

  if (formShipping) {
    formShipping.addEventListener("submit", (e) => {
      e.preventDefault();
      const msgEl = document.getElementById("checkout-shipping-message");
      if (msgEl) msgEl.textContent = "";

      const shipping = collectShippingForm();
      if (!shipping) return;

      checkoutState.shipping = shipping;
      renderConfirmShipping();
      renderConfirmItemsSummary();
      goToStep(3);
    });
  }

  if (btnStep2Prev) {
    btnStep2Prev.addEventListener("click", () => goToStep(1));
  }
  if (btnStep3Prev) {
    btnStep3Prev.addEventListener("click", () => goToStep(2));
  }
}

function goToStep(step) {
  document.querySelectorAll(".checkout-step").forEach((el) => {
    el.classList.remove("active");
  });
  const current = document.getElementById(`checkout-step-${step}`);
  if (current) current.classList.add("active");

  const links = document.querySelectorAll("#checkout-steps .nav-link");
  links.forEach((el) => {
    const s = Number(el.dataset.step);
    el.classList.remove("active", "disabled", "done");
    if (s === step) {
      el.classList.add("active");
    } else if (s < step) {
      el.classList.add("done");
    } else {
      el.classList.add("disabled");
    }
  });
}

/* ========= Shipping ========= */

function collectShippingForm() {
  const emailInput = document.getElementById("checkout-email");
  const fullNameInput = document.getElementById("checkout-full-name");
  const receiverInput = document.getElementById("checkout-receiver-name");
  const phoneInput = document.getElementById("checkout-phone");
  const addrInput = document.getElementById("checkout-address-details");
  const districtInput = document.getElementById("checkout-district");
  const cityInput = document.getElementById("checkout-city");
  //const postalInput = document.getElementById("checkout-postal-code");
  const msgEl = document.getElementById("checkout-shipping-message");

  const email = (emailInput.value || "").trim();
  const fullName = (fullNameInput.value || "").trim();
  const receiverName = (receiverInput.value || "").trim();
  const phone = (phoneInput.value || "").trim();
  const addressDetails = (addrInput.value || "").trim();
  const district = (districtInput.value || "").trim();
  const city = (cityInput.value || "").trim();
  // const postalCode = (postalInput.value || "").trim();

  if (
    !email ||
    !fullName ||
    !receiverName ||
    !phone ||
    !addressDetails ||
    !district ||
    !city
  ) {
    if (msgEl) {
      msgEl.textContent =
        "Vui lòng điền đầy đủ email, họ tên, người nhận, số điện thoại và địa chỉ giao hàng.";
    }
    return null;
  }

  return {
    email,
    full_name: fullName,
    receiver_name: receiverName,
    phone,
    address_details: addressDetails,
    district,
    city,
    //postal_code: postalCode,
  };
}

function renderConfirmShipping() {
  const box = document.getElementById("confirm-shipping-info");
  if (!box || !checkoutState.shipping) return;
  const s = checkoutState.shipping;

  box.innerHTML = `
    <h6 class="h6">Thông tin giao hàng</h6>
    <div><strong>${escapeHtml(s.receiver_name)}</strong> (${escapeHtml(
    s.full_name
  )})</div>
    <div>Email: ${escapeHtml(s.email)}</div>
    <div>Điện thoại: ${escapeHtml(s.phone)}</div>
    <div>Địa chỉ: ${escapeHtml(s.address_details)}, ${escapeHtml(
    s.district
  )}, ${escapeHtml(s.city)} ${
    //s.postal_code ? "(" + escapeHtml(s.postal_code) + ")" : ""
    ""
  }</div>
  `;
}

function renderConfirmItemsSummary() {
  const box = document.getElementById("confirm-items-summary");
  if (!box) return;
  const s = checkoutState.summary;
  if (!s) return;

  const loyaltyDiscount = getLoyaltyDiscountPreview();
  const totalDiscount = (Number(s.discount) || 0) + loyaltyDiscount;
  const finalTotal = calcBaseTotal() - loyaltyDiscount;

  let html = `
    <h6 class="h6">Sản phẩm & Tổng tiền</h6>
    <ul class="list-unstyled mb-2 small">
  `;
  checkoutState.items.forEach((it) => {
    html += `
      <li class="d-flex justify-content-between">
        <span class="me-2 text-truncate" style="max-width: 260px;">
          ${escapeHtml(it.name || "Sản phẩm")}
        </span>
        <span>x${it.qty}</span>
      </li>
    `;
  });
  html += `</ul>
    <div class="d-flex justify-content-between">
      <span>Tạm tính</span>
      <span>${formatPrice(s.subtotal)}</span>
    </div>
    <div class="d-flex justify-content-between">
      <span>Thuế (10%)</span>
      <span>${formatPrice(s.tax)}</span>
    </div>
    <div class="d-flex justify-content-between">
      <span>Phí vận chuyển</span>
      <span>${formatPrice(s.shipping)}</span>
    </div>
    <div class="d-flex justify-content-between">
      <span>Tổng giảm giá</span>
      <span>${
        totalDiscount > 0 ? "-" + formatPrice(totalDiscount) : "0₫"
      }</span>
    </div>
    <hr class="my-2" />
    <div class="d-flex justify-content-between fw-semibold">
      <span>Tổng thanh toán</span>
      <span>${formatPrice(finalTotal)}</span>
    </div>
  `;
  box.innerHTML = html;
}

/* ========= Payment method + Đặt hàng ========= */

function initPaymentSection() {
  document
    .querySelectorAll('input[name="payment_method"]')
    .forEach((el) => {
      el.addEventListener("change", () => {
        if (el.checked) {
          checkoutState.paymentMethod = el.value;
        }
      });
    });

  const btnPlace = document.getElementById("btn-place-order");
  if (btnPlace) {
    btnPlace.addEventListener("click", placeOrder);
  }
}

/* ========= MÃ GIẢM GIÁ UI ========= */

function initCouponUI() {
  const input = document.getElementById("coupon-code-input");
  const btnApply = document.getElementById("btn-apply-coupon");
  const btnRemove = document.getElementById("btn-remove-coupon");
  const msgEl = document.getElementById("coupon-message");

  if (!input || !btnApply) return;

  btnApply.addEventListener("click", async () => {
    let raw = (input.value || "").trim().toUpperCase();

    if (!raw) {
      msgEl.className = "small text-danger";
      msgEl.textContent = "Vui lòng nhập mã giảm giá.";
      return;
    }

    if (!/^[A-Z0-9]{5}$/.test(raw)) {
      msgEl.className = "small text-danger";
      msgEl.textContent =
        "Mã giảm giá phải gồm 5 ký tự chữ và số (VD: SALE1).";
      return;
    }

    msgEl.className = "small text-muted";
    msgEl.textContent = "Đang kiểm tra mã giảm giá...";

    try {
      const res = await fetch("/api/discount/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: raw }),
      });

      const data = await res.json();
      if (!res.ok || !data.valid) {
        msgEl.className = "small text-danger";
        msgEl.textContent =
          data.message || "Mã giảm giá không hợp lệ.";
        checkoutState.coupon = null;
        checkoutState.summary = calcSummary(checkoutState.items, null);
        renderSummaryBox();
        renderConfirmItemsSummary();
        if (btnRemove) btnRemove.classList.add("d-none");
        return;
      }

      checkoutState.coupon = {
        code: data.code,
        percent_off: data.percent_off,
      };
      checkoutState.summary = calcSummary(
        checkoutState.items,
        checkoutState.coupon
      );
      renderSummaryBox();
      renderConfirmItemsSummary();

      msgEl.className = "small text-success";
      msgEl.textContent = `Áp dụng mã ${
        data.code
      } - giảm ${data.percent_off}% (còn ${
        data.remaining_uses
      } lần sử dụng).`;
      if (btnRemove) btnRemove.classList.remove("d-none");
    } catch (err) {
      console.error("Lỗi validate coupon:", err);
      msgEl.className = "small text-danger";
      msgEl.textContent = "Có lỗi xảy ra khi kiểm tra mã giảm giá.";
    }
  });

  if (btnRemove) {
    btnRemove.addEventListener("click", () => {
      checkoutState.coupon = null;
      checkoutState.summary = calcSummary(checkoutState.items, null);
      renderSummaryBox();
      renderConfirmItemsSummary();
      msgEl.className = "small text-muted";
      msgEl.textContent = "Đã bỏ mã giảm giá.";
      btnRemove.classList.add("d-none");
      input.value = "";
    });
  }
}

/* ========= ĐẶT HÀNG ========= */

async function placeOrder() {
  const msgEl = document.getElementById("checkout-message");
  if (msgEl) {
    msgEl.className = "small mt-3";
    msgEl.textContent = "";
  }

  if (!checkoutState.items.length) {
    if (msgEl) {
      msgEl.classList.add("text-danger");
      msgEl.textContent = "Không có sản phẩm nào để thanh toán.";
    }
    return;
  }

  if (!checkoutState.shipping) {
    if (msgEl) {
      msgEl.classList.add("text-danger");
      msgEl.textContent = "Vui lòng hoàn thành bước thông tin giao hàng.";
    }
    return;
  }

  const saveAddressCheckbox = document.getElementById("checkout-save-address");
  const saveAddress = !!(saveAddressCheckbox && saveAddressCheckbox.checked);

  const payload = {
    items: checkoutState.items.map((it) => ({
      productId: it.productId,
      variantId: it.variantId || null,
      name: it.name,
      price: it.price,
      qty: it.qty,
      variantText: it.variantText || null,
    })),
    shipping: checkoutState.shipping,
    saveAddress,
    paymentMethod: checkoutState.paymentMethod,
    couponCode: checkoutState.coupon ? checkoutState.coupon.code : null,
    useLoyaltyPoints: !!checkoutState.useLoyaltyPoints, // <- GỬI LÊN BACKEND
  };

  const btnPlace = document.getElementById("btn-place-order");
  if (btnPlace) btnPlace.disabled = true;
  if (msgEl) {
    msgEl.classList.add("text-muted");
    msgEl.textContent = "Đang xử lý đơn hàng...";
  }

  try {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      if (msgEl) {
        msgEl.className = "small mt-3 text-danger";
        msgEl.textContent =
          data.message || "Có lỗi xảy ra khi tạo đơn hàng.";
      }
      if (btnPlace) btnPlace.disabled = false;
      return;
    }

    const orderId = data.order && data.order.id;

    // Xoá các sản phẩm đã thanh toán khỏi giỏ
    try {
      if (window.Cart && typeof Cart.removeSelected === "function") {
        Cart.removeSelected();
      } else if (window.Cart && typeof Cart.clear === "function") {
        Cart.clear();
      }
    } catch (e) {
      console.warn("Không thể cập nhật lại giỏ hàng sau khi đặt:", e);
    }

    // Lưu thông tin đơn hàng cuối cùng vào localStorage
    const successPayload = {
      order: data.order,
      items: checkoutState.items,
      summary: checkoutState.summary, // summary base (chưa trừ điểm), backend có total chính xác
      shipping: checkoutState.shipping,
      paymentMethod: checkoutState.paymentMethod,
      coupon: checkoutState.coupon,
      guestCreated: !!data.guestCreated,
      emailForAccount:
        data.emailForAccount ||
        (checkoutState.user
          ? checkoutState.user.email
          : checkoutState.shipping.email),
    };

    try {
      localStorage.setItem(
        "last_order_success",
        JSON.stringify(successPayload)
      );
    } catch (e) {
      console.warn("Không thể lưu last_order_success:", e);
    }

    // Chuyển sang trang màn hình thành công
    if (orderId) {
      window.location.href = `/order-success.html?id=${orderId}`;
    } else {
      // fallback nếu không có orderId
      if (msgEl) {
        msgEl.className = "small mt-3 alert alert-success";
        msgEl.textContent = "Đặt hàng thành công.";
      }
      setTimeout(() => {
        window.location.href = "/index.html";
      }, 3000);
    }
  } catch (err) {
    console.error("Lỗi placeOrder:", err);
    if (msgEl) {
      msgEl.className = "small mt-3 text-danger";
      msgEl.textContent = "Có lỗi xảy ra khi kết nối tới máy chủ.";
    }
    if (btnPlace) btnPlace.disabled = false;
  }
}

/* ========= nhỏ gọn ========= */

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}