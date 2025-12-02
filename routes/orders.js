// routes/orders.js
const express = require("express");
const router = express.Router();
const db = require("../config/db");

function getAuthUser(req) {
  if (req.user) return req.user;
  if (req.session && req.session.user) return req.session.user;
  return null;
}

// GET /api/orders/:id  → lấy chi tiết đơn + items + lịch sử trạng thái
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) {
    return res.status(400).json({ message: "Mã đơn không hợp lệ." });
  }

  try {
    const [orderRows] = await db.query(
      "SELECT * FROM orders WHERE id = ?",
      [id]
    );
    if (!orderRows.length) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng." });
    }

    const order = orderRows[0];
    const authUser = getAuthUser(req);

    // Nếu là customer thì chỉ được xem đơn của mình
    if (
      authUser &&
      authUser.role !== "admin" &&
      order.user_id &&
      Number(order.user_id) !== Number(authUser.id)
    ) {
      return res.status(403).json({ message: "Không có quyền xem đơn này." });
    }

    const [items] = await db.query(
      "SELECT * FROM order_items WHERE order_id = ?",
      [id]
    );
    const [statusHistory] = await db.query(
      "SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at DESC",
      [id]
    );

    res.json({ order, items, statusHistory });
  } catch (err) {
    console.error("Lỗi GET /api/orders/:id:", err);
    res.status(500).json({ message: "Có lỗi xảy ra." });
  }
});

module.exports = router;
