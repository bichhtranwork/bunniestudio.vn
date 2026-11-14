# Website Bunnie Studio

Node.js (Express + EJS). Nội dung nằm trong `content/*.json`, sửa file là web cập nhật.

## Chạy thử
```
npm install
npm start      # http://localhost:3000
```

## Cấu trúc
- `server.js`: server, API lịch trống, kiểm tra link brief, nhận form
- `views/`: giao diện (EJS)
- `public/`: CSS, JS, font, logo, sample (đã nén + watermark)
- `content/`: bảng giá, quy trình & rules, FAQ, blog, liên hệ

Biến môi trường: xem `.env.example`.
