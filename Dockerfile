# Sử dụng Node.js image nhẹ
FROM node:20-alpine

# Thư mục làm việc trong container
WORKDIR /usr/src/app

# Copy file khai báo dependencies
COPY package*.json ./

# Cài dependencies (thay cho npm install bên ngoài)
RUN npm install

# Copy toàn bộ source code
COPY . .

# Đảm bảo PORT trong container trùng với .env
ENV PORT=8080

# Mở port ra trong container
EXPOSE 8080

# Lệnh chạy app
CMD ["npm", "start"]
