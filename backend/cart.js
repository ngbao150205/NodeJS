// public/cart.js

(function () {
  /**
   * Xác định KEY giỏ hàng theo user
   * - Nếu chưa đăng nhập: cart_items_v1_guest
   * - Nếu đã đăng nhập: cart_items_v1_user_<id>
   */
  function detectCartKey() {
    var defaultKey = "cart_items_v1_guest";

    try {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", "/api/auth/me", false); // sync cho đơn giản
      xhr.setRequestHeader("Accept", "application/json");
      xhr.send(null);

      if (xhr.status >= 200 && xhr.status < 300) {
        var data = JSON.parse(xhr.responseText || "{}");
        if (data && data.user && data.user.id) {
          var uid = data.user.id;
          window.__CURRENT_USER = data.user;
          return "cart_items_v1_user_" + uid;
        }
      }
    } catch (e) {
      console.error("Không thể xác định user cho giỏ hàng:", e);
    }

    // Mặc định guest
    return defaultKey;
  }

  const CART_KEY = detectCartKey();

  /* ================== HÀM LÀM VIỆC VỚI localStorage ================== */

  function loadCartRaw() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("Lỗi đọc giỏ hàng:", e);
      return [];
    }
  }

  function saveCartRaw(items) {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items || []));
    } catch (e) {
      console.error("Lỗi lưu giỏ hàng:", e);
    }
  }

  /**
   * Chuẩn hoá dữ liệu giỏ hàng:
   *  - qty tối thiểu 1
   *  - selected mặc định = true nếu chưa có
   */
  function normalizeCartItems(items) {
    if (!Array.isArray(items)) return [];
    let changed = false;

    items.forEach((it) => {
      if (!it || typeof it !== "object") return;

      let qty = Number(it.qty);
      if (!qty || qty < 1) {
        it.qty = 1;
        changed = true;
      }

      if (typeof it.selected === "undefined") {
        it.selected = true;
        changed = true;
      }
    });

    if (changed) {
      saveCartRaw(items);
    }
    return items;
  }

  function loadCart() {
    const items = loadCartRaw();
    return normalizeCartItems(items);
  }

  function saveCart(items) {
    normalizeCartItems(items);
    saveCartRaw(items);
  }

  /* ================== API Cart dùng chung ================== */

  function getSelectedItems() {
    const items = loadCart();
    return items.filter((it) => it.selected);
  }

  function removeSelectedItems() {
    const items = loadCart();
    const remaining = items.filter((it) => !it.selected);
    saveCart(remaining);
  }

  window.Cart = Object.assign(window.Cart || {}, {
    getItems: loadCart,
    setItems: saveCart,
    clear() {
      saveCart([]);
    },
    getSelectedItems,
    removeSelected: removeSelectedItems,
  });

  /* ================== PHẦN DƯỚI CHỈ CHẠY Ở TRANG cart.html ================== */

  document.addEventListener("DOMContentLoaded", () => {
    const tbody = document.getElementById("cart-table-body");
    if (!tbody) return; // không phải cart.html

    const emptyEl = document.getElementById("cart-empty");
    const btnClear = document.getElementById("btn-cart-clear");
    const selectAllCheckbox = document.getElementById("cart-select-all");

    const totalQtyEl = document.getElementById("cart-total-qty");
    const subtotalEl = document.getElementById("cart-subtotal");
    const taxEl = document.getElementById("cart-tax");
    const shippingEl = document.getElementById("cart-shipping");
    const totalAmountEl = document.getElementById("cart-total-amount");

    function formatPrice(num) {
      if (num == null) return "0₫";
      const n = Number(num) || 0;
      return n.toLocaleString("vi-VN") + "₫";
    }

    function escapeHtml(str) {
      return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function getCartItemImageUrl(item) {
      // Nếu có sẵn link ảnh riêng
      if (item.image) return item.image;
      // Nếu có slug thì dùng chung rule với products
      if (item.slug) {
        return `/acess/product/${item.slug}-1.jpg`;
      }
      // Fallback
      return "https://via.placeholder.com/60x60?text=No+Image";
    }

    function renderCart() {
      const items = loadCart();
      tbody.innerHTML = "";

      if (!items.length) {
        if (emptyEl) emptyEl.classList.remove("d-none");
        if (selectAllCheckbox) {
          selectAllCheckbox.checked = false;
          selectAllCheckbox.indeterminate = false;
        }
        updateSummary(items);
        return;
      }

      if (emptyEl) emptyEl.classList.add("d-none");

      items.forEach((item, index) => {
        const tr = document.createElement("tr");
        tr.className = "align-middle";
        tr.dataset.index = index;

        const checked = !!item.selected;
        const imgSrc = getCartItemImageUrl(item);

        tr.innerHTML = `
          <!-- checkbox -->
          <td class="text-center">
            <input type="checkbox"
                   class="form-check-input cart-item-select"
                   ${checked ? "checked" : ""}>
          </td>

          <!-- ảnh sản phẩm -->
          <td class="text-center">
            <img
              src="${imgSrc}"
              alt="${escapeHtml(item.name || "Sản phẩm")}"
              class="img-fluid cart-item-image"
              style="max-width: 60px; max-height: 60px; object-fit: cover;"
            />
          </td>

          <!-- thông tin sản phẩm -->
          <td>
            <div class="fw-semibold small">${escapeHtml(
              item.name || "Sản phẩm"
            )}</div>
            ${
              item.variantText
                ? `<div class="text-muted small">Biến thể: ${escapeHtml(
                    item.variantText
                  )}</div>`
                : ""
            }
          </td>

          <!-- đơn giá -->
          <td class="text-end small">
            <span class="text-muted">Đơn giá</span><br>
            <span class="fw-semibold text-danger">
              ${formatPrice(item.price)}
            </span>
          </td>

          <!-- số lượng -->
          <td class="text-center">
            <div class="d-inline-flex align-items-center border rounded small">
              <button type="button"
                      class="btn btn-sm btn-light border-0 cart-qty-minus">−</button>
              <input type="number"
                     class="form-control form-control-sm border-0 text-center cart-qty-input"
                     style="width: 60px"
                     min="1"
                     value="${item.qty || 1}">
              <button type="button"
                      class="btn btn-sm btn-light border-0 cart-qty-plus">+</button>
            </div>
          </td>

          <!-- thành tiền -->
          <td class="text-end small">
            <span class="text-muted">Thành tiền</span><br>
            <span class="fw-semibold text-danger cart-item-total">
              ${formatPrice((item.price || 0) * (item.qty || 1))}
            </span>
          </td>

          <!-- xóa -->
          <td class="text-center">
            <button type="button"
                    class="btn btn-link btn-sm text-danger p-0 cart-item-remove">
              Xóa
            </button>
          </td>
        `;

        tbody.appendChild(tr);

        // fallback ảnh
        const imgEl = tr.querySelector("img.cart-item-image");
        if (imgEl) {
          imgEl.onerror = () => {
            imgEl.onerror = null;
            imgEl.src =
              "https://via.placeholder.com/60x60?text=No+Image";
          };
        }
      });

      bindRowEvents();
      updateSummary(loadCart());
      updateSelectAllState(loadCart());
    }

    function updateSelectAllState(items) {
      if (!selectAllCheckbox) return;
      if (!items.length) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
        return;
      }
      const selectedCount = items.filter((it) => it.selected).length;
      if (selectedCount === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
      } else if (selectedCount === items.length) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
      } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
      }
    }

    function bindRowEvents() {
      const items = loadCart();
      const rows = tbody.querySelectorAll("tr.align-middle");

      rows.forEach((row) => {
        const idx = Number(row.dataset.index);
        const item = items[idx];
        if (!item) return;

        const cb = row.querySelector(".cart-item-select");
        const btnMinus = row.querySelector(".cart-qty-minus");
        const btnPlus = row.querySelector(".cart-qty-plus");
        const inputQty = row.querySelector(".cart-qty-input");
        const btnRemove = row.querySelector(".cart-item-remove");

        // Tick chọn
        if (cb) {
          cb.addEventListener("change", () => {
            const newItems = loadCart();
            if (!newItems[idx]) return;
            newItems[idx].selected = cb.checked;
            saveCart(newItems);
            updateSummary(newItems);
            updateSelectAllState(newItems);
          });
        }

        // Giảm số lượng
        if (btnMinus && inputQty) {
          btnMinus.addEventListener("click", () => {
            let qty = Number(inputQty.value) || 1;
            qty = Math.max(1, qty - 1);
            inputQty.value = qty;

            const newItems = loadCart();
            if (!newItems[idx]) return;
            newItems[idx].qty = qty;
            saveCart(newItems);
            renderCart();
          });
        }

        // Tăng số lượng
        if (btnPlus && inputQty) {
          btnPlus.addEventListener("click", () => {
            let qty = Number(inputQty.value) || 1;
            qty++;
            inputQty.value = qty;

            const newItems = loadCart();
            if (!newItems[idx]) return;
            newItems[idx].qty = qty;
            saveCart(newItems);
            renderCart();
          });
        }

        // Nhập số lượng tay
        if (inputQty) {
          inputQty.addEventListener("change", () => {
            let qty = Number(inputQty.value) || 1;
            if (qty < 1) qty = 1;
            inputQty.value = qty;

            const newItems = loadCart();
            if (!newItems[idx]) return;
            newItems[idx].qty = qty;
            saveCart(newItems);
            renderCart();
          });
        }

        // Xoá sản phẩm
        if (btnRemove) {
          btnRemove.addEventListener("click", () => {
            const newItems = loadCart();
            newItems.splice(idx, 1);
            saveCart(newItems);
            renderCart();
          });
        }
      });
    }

    function updateSummary(items) {
      const selectedItems = items.filter((it) => it.selected);

      const totalQty = selectedItems.reduce(
        (sum, it) => sum + (Number(it.qty) || 1),
        0
      );
      const subtotal = selectedItems.reduce(
        (sum, it) =>
          sum + (Number(it.price) || 0) * (Number(it.qty) || 1),
        0
      );
      const tax = Math.round(subtotal * 0.1);
      const shipping = selectedItems.length > 0 ? 30000 : 0;
      const total = subtotal + tax + shipping;

      if (totalQtyEl) totalQtyEl.textContent = totalQty;
      if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
      if (taxEl) taxEl.textContent = formatPrice(tax);
      if (shippingEl) shippingEl.textContent = formatPrice(shipping);
      if (totalAmountEl) totalAmountEl.textContent = formatPrice(total);
    }

    // Chọn / bỏ chọn tất cả
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener("change", () => {
        const items = loadCart();
        items.forEach((it) => {
          it.selected = selectAllCheckbox.checked;
        });
        saveCart(items);
        renderCart();
      });
    }

    // Xoá toàn bộ
    if (btnClear) {
      btnClear.addEventListener("click", () => {
        if (!confirm("Bạn có chắc muốn xóa toàn bộ giỏ hàng?")) return;
        saveCart([]);
        renderCart();
      });
    }

    // Lần đầu vào trang
    renderCart();
  });
})();
