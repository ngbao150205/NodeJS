// public/admin/users.js

let userPage = 1;
const userPerPage = 10;

let filterQ = "";
let filterRole = "";
let filterBanned = "";

document.addEventListener("DOMContentLoaded", () => {
  initUserFilterForm();
  loadUsers();
});

function initUserFilterForm() {
  const form = document.getElementById("user-filter-form");
  const qInput = document.getElementById("user-filter-q");
  const roleSelect = document.getElementById("user-filter-role");
  const bannedSelect = document.getElementById("user-filter-banned");

  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    filterQ = (qInput.value || "").trim();
    filterRole = roleSelect.value || "";
    filterBanned = bannedSelect.value || "";
    userPage = 1;
    loadUsers();
  });
}

async function loadUsers() {
  const tbody = document.getElementById("users-tbody");
  const paginationEl = document.getElementById("users-pagination");

  if (tbody) {
    tbody.innerHTML =
      '<tr><td colspan="8" class="text-center text-muted small">Đang tải...</td></tr>';
  }
  if (paginationEl) {
    paginationEl.innerHTML = "";
  }

  const params = new URLSearchParams();
  params.set("page", userPage);
  params.set("limit", userPerPage);
  if (filterQ) params.set("q", filterQ);
  if (filterRole) params.set("role", filterRole);
  if (filterBanned) params.set("banned", filterBanned);

  try {
    const res = await fetch(`/api/admin/users?${params.toString()}`);
    if (!res.ok) throw new Error("Không thể tải user");
    const data = await res.json();

    renderUsersTable(data.users || []);
    renderUsersPagination(data.pagination || { totalPages: 1, currentPage: userPage });
  } catch (err) {
    console.error("Lỗi loadUsers:", err);
    if (tbody) {
      tbody.innerHTML =
        '<tr><td colspan="8" class="text-center text-danger small">Lỗi tải danh sách người dùng.</td></tr>';
    }
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById("users-tbody");
  if (!tbody) return;

  if (!users || users.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="8" class="text-center text-muted small">Không có người dùng.</td></tr>';
    return;
  }

  tbody.innerHTML = "";
  users.forEach((u) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.id}</td>
      <td>${escapeHtml(u.email || "")}</td>
      <td>${escapeHtml(u.full_name || "")}</td>
      <td>
        <span class="badge bg-${u.role === "admin" ? "primary" : "secondary"}">
          ${u.role}
        </span>
      </td>
      <td>
        ${
          u.is_banned
            ? '<span class="badge bg-danger">Đã cấm</span>'
            : '<span class="badge bg-success">Hoạt động</span>'
        }
      </td>
      <td>${u.loyalty_points || 0}</td>
      <td>${formatDateTime(u.created_at)}</td>
      <td>
        <button class="btn btn-sm btn-outline-secondary btn-edit-user" data-id="${u.id}">
          Sửa
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".btn-edit-user").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      openUserModal(id);
    });
  });
}

function renderUsersPagination(pagination) {
  const paginationEl = document.getElementById("users-pagination");
  if (!paginationEl) return;

  const totalPages = Math.max(1, pagination.totalPages || 1);
  const page = pagination.currentPage || 1;

  paginationEl.innerHTML = "";

  const addBtn = (p, label, disabled, active) => {
    const li = document.createElement("li");
    li.className = "page-item" + (disabled ? " disabled" : "") + (active ? " active" : "");
    li.innerHTML = `<button class="page-link" type="button" data-page="${p}">${label}</button>`;
    paginationEl.appendChild(li);
  };

  addBtn(page - 1, "«", page <= 1, false);
  for (let i = 1; i <= totalPages; i++) {
    addBtn(i, i, false, i === page);
  }
  addBtn(page + 1, "»", page >= totalPages, false);

  paginationEl.querySelectorAll("button.page-link").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = Number(btn.dataset.page);
      if (!p || p === userPage || p < 1 || p > totalPages) return;
      userPage = p;
      loadUsers();
    });
  });
}

/* ========== USER MODAL ========== */

async function openUserModal(userId) {
  const modalEl = document.getElementById("userModal");
  const modal = new bootstrap.Modal(modalEl);

  const titleEl = document.getElementById("userModalLabel");
  const idInput = document.getElementById("user-id");
  const emailInput = document.getElementById("user-email");
  const fullNameInput = document.getElementById("user-full-name");
  const roleSelect = document.getElementById("user-role");
  const bannedCheckbox = document.getElementById("user-is-banned");
  const pointsInput = document.getElementById("user-loyalty-points");
  const createdAtEl = document.getElementById("user-created-at");

  idInput.value = "";
  emailInput.value = "";
  fullNameInput.value = "";
  roleSelect.value = "customer";
  bannedCheckbox.checked = false;
  pointsInput.value = "";
  createdAtEl.textContent = "";

  try {
    const res = await fetch(`/api/admin/users/${userId}`);
    if (!res.ok) throw new Error("Không thể tải user");
    const data = await res.json();
    const u = data.user;

    titleEl.textContent = `Người dùng #${u.id}`;
    idInput.value = u.id;
    emailInput.value = u.email || "";
    fullNameInput.value = u.full_name || "";
    roleSelect.value = u.role || "customer";
    bannedCheckbox.checked = !!u.is_banned;
    pointsInput.value = u.loyalty_points || 0;
    createdAtEl.textContent = `Ngày tạo: ${formatDateTime(u.created_at)}`;

    modal.show();
  } catch (err) {
    console.error("Lỗi openUserModal:", err);
    alert("Không thể tải thông tin người dùng.");
  }
}

// submit form user
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("user-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("user-id").value;
    const full_name = document.getElementById("user-full-name").value.trim();
    const role = document.getElementById("user-role").value;
    const is_banned = document.getElementById("user-is-banned").checked;
    const loyalty_points = document.getElementById("user-loyalty-points").value;

    if (!id) {
      alert("Thiếu ID người dùng.");
      return;
    }

    const payload = {
      full_name,
      role,
      is_banned,
      loyalty_points,
    };

    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Lỗi lưu người dùng");
      }

      const modalEl = document.getElementById("userModal");
      const modal = bootstrap.Modal.getInstance(modalEl);
      modal.hide();

      await loadUsers();
    } catch (err) {
      console.error("Lỗi submit user form:", err);
      alert(err.message || "Có lỗi khi lưu người dùng.");
    }
  });
});

/* ========== HELPERS ========== */

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDateTime(dt) {
  if (!dt) return "";
  try {
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return dt;
    return d.toLocaleString("vi-VN");
  } catch {
    return dt;
  }
}
