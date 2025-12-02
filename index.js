// index.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const session = require("express-session");
const passport = require("passport");
require("dotenv").config();

const app = express();

// parse JSON
app.use(express.json());

// session (bắt buộc trước passport.session)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev_secret_123",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
    },
  })
);

// Passport config
require("./config/passport")(passport);
app.use(passport.initialize());
app.use(passport.session());

// static files
app.use(express.static(path.join(__dirname, "public")));

// routes
const mainRouter = require("./routes/router");
const authRouter = require("./routes/authRoutes");
const profileRouter = require("./routes/profileRoutes");



app.use("/", mainRouter);

app.use("/api/auth", authRouter);

app.use("/api/profile", profileRouter);
// middleware lỗi
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ message: "Lỗi server" });
});


app.use("/api/orders", require("./routes/orders"));

//app.use("/api/checkout", require("./routes/checkout"));

// === TÍCH HỢP SOCKET.IO ===
const server = http.createServer(app);
const io = new Server(server);

// Cho phép router truy cập io qua req.app.get('io')
app.set("io", io);

// Lắng nghe kết nối socket
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // Client join vào "room" của 1 sản phẩm cụ thể
  socket.on("product:join", ({ productId }) => {
    if (!productId) return;
    const roomName = `product_${productId}`;
    socket.join(roomName);
    // console.log(`Socket ${socket.id} join room ${roomName}`);
  });

  socket.on("disconnect", () => {
    // console.log("Socket disconnected:", socket.id);
  });
});


const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server chạy: http://localhost:${PORT}`);
});
