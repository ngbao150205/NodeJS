// backend/src/routes/orders.js
const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { getDB } = require('../config/db');

// Hàm tạo transporter y như reset password
async function mailer() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

// format tiền VND
function formatVnd(n) {
  n = Number(n || 0);
  return new Intl.NumberFormat('vi-VN').format(n) + 'đ';
}

// Gửi email xác nhận đơn hàng
async function sendOrderConfirmation(orderId) {
  const conn = await getDB();

  // 1) Lấy thông tin đơn hàng
  const [orders] = await conn.query(
    `SELECT 
       id, email, full_name,
       receiver_name, phone,
       address_details, district, city, postal_code,
       subtotal, tax, shipping_fee, discount_amount, total_amount,
       coupon_code, created_at
     FROM orders
     WHERE id = ?`,
    [orderId]
  );

  if (!orders.length) {
    throw new Error('Order not found');
  }

  const order = orders[0];

  // 2) Lấy danh sách sản phẩm trong đơn
  const [items] = await conn.query(
    `SELECT 
       oi.*,
       p.slug AS product_slug
     FROM order_items oi
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ?`,
    [orderId]
  );

  // 3) Build HTML bảng sản phẩm
  let rowsHtml = '';
  for (const it of items) {
    const name = it.name || '';
    const qty = Number(it.qty || 1);
    const unit = Number(it.unit_price || 0);
    const lineTotal = Number(it.line_total || (unit * qty));

    let attrsText = '';
    if (it.attrs) {
      try {
        const attrs = JSON.parse(it.attrs);
        if (attrs && typeof attrs === 'object') {
          const parts = [];
          for (const [k, v] of Object.entries(attrs)) {
            parts.push(`${k}: ${v}`);
          }
          attrsText = parts.join(', ');
        }
      } catch (_) {}
    }

    rowsHtml += `
      <tr>
        <td style="padding:8px;border:1px solid #e5e7eb;">
          ${name}
          ${attrsText ? `<br><small style="color:#6b7280;">${attrsText}</small>` : ''}
        </td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:center;">${qty}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${formatVnd(unit)}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${formatVnd(lineTotal)}</td>
      </tr>`;
  }

  const sub      = formatVnd(order.subtotal);
  const tax      = formatVnd(order.tax);
  const ship     = formatVnd(order.shipping_fee);
  const discount = formatVnd(order.discount_amount);
  const total    = formatVnd(order.total_amount);

  const percent  = order.subtotal
    ? Math.round((order.discount_amount / (order.subtotal + order.tax + order.shipping_fee)) * 100)
    : 0;

  const toEmail = order.email;
  const toName  = order.full_name || order.receiver_name || order.email;

  const shippingAddress = `${order.address_details}, ${order.district}, ${order.city}` +
    (order.postal_code ? ` (${order.postal_code})` : '');

  const subject = `Xác nhận đơn hàng #${order.id} - E-Store.PC`;

  const body = `
  <html>
  <body style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;">
    <h2 style="color:#0ea5e9;">Cảm ơn bạn đã đặt hàng tại E-Store.PC</h2>
    <p>Xin chào <strong>${toName}</strong>,</p>
    <p>Chúng tôi đã nhận được đơn hàng <strong>#${order.id}</strong> của bạn.</p>
    <p>
      <strong>Thông tin giao hàng:</strong><br/>
      Người nhận: ${order.receiver_name}<br/>
      Địa chỉ: ${shippingAddress}<br/>
      SĐT: ${order.phone}
    </p>

    <h3 style="margin-top:20px;">Chi tiết đơn hàng</h3>
    <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:700px;">
      <thead>
        <tr>
          <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Sản phẩm</th>
          <th style="padding:8px;border:1px solid #e5e7eb;text-align:center;">SL</th>
          <th style="padding:8px;border:1px solid #e5e7eb;text-align:right;">Đơn giá</th>
          <th style="padding:8px;border:1px solid #e5e7eb;text-align:right;">Thành tiền</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <p style="margin-top:16px;">
      Tạm tính: <strong>${sub}</strong><br/>
      Thuế (10%): <strong>${tax}</strong><br/>
      Phí vận chuyển: <strong>${ship}</strong><br/>
      Giảm giá: <strong>-${discount}</strong><br/>
      Tổng thanh toán: <strong style="color:#0ea5e9;font-size:16px;">${total}</strong>
    </p>

    <p style="margin-top:16px;font-size:12px;color:#6b7280;">
      Nếu bạn không thực hiện đơn hàng này, vui lòng liên hệ ngay với chúng tôi để được hỗ trợ.
    </p>

    <p>Trân trọng,<br/><strong>E-Store.PC</strong></p>
  </body>
  </html>
  `;

  const transporter = await mailer();

  await transporter.sendMail({
    from: process.env.MAIL_FROM || '"E-Store.PC" <no-reply@estorepc.local>',
    to: toEmail,
    subject,
    html: body
  });
}

// POST /api/orders/:id/send-confirmation
router.post('/:id/send-confirmation', async (req, res) => {
  try {
    const orderId = Number(req.params.id || 0);
    if (!orderId) {
      return res.status(400).json({ message: 'Invalid order id' });
    }

    await sendOrderConfirmation(orderId);
    return res.json({ message: 'Order confirmation email sent' });
  } catch (err) {
    console.error('send-confirmation error:', err);
    return res.status(500).json({ message: 'Không thể gửi email xác nhận đơn hàng' });
  }
});

module.exports = router;
