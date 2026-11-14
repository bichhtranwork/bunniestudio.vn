# Hướng dẫn deploy lên Hostinger

Website là ứng dụng **Node.js** (Express). Cần gói hosting có mục **Node.js** (ví dụ Business Web Hosting hoặc Cloud). Gói Premium/Single không chạy được.

## 1. Mua gói và tên miền
- Mua gói có Node.js, kèm tên miền theo thứ tự ưu tiên: `bunniestudio.vn`, `bunniestu.com`, `bunniestudio.com`, `bunniestu.vn`.

## 2. Tạo ứng dụng Node.js từ GitHub
Trong hPanel (tên mục có thể khác chút tùy giao diện Hostinger):
1. **Websites → Add website → Node.js app** (hoặc vào website → **Node.js**).
2. Chọn **Import from GitHub**, cấp quyền cho repo `bichhtranwork/bunniestudio.vn`, nhánh **main**.
3. Cấu hình build:
   - **Node version:** 20 trở lên
   - **Install command:** `npm install`
   - **Build command:** để trống
   - **Start command / Entry file:** `npm start` (hoặc `server.js`)
4. **Environment variables**, thêm các biến sau:

| Biến | Giá trị |
|---|---|
| `NODE_ENV` | `production` |
| `SITE_URL` | `https://bunniestudio.vn` (tên miền thật) |
| `ADMIN_PASSWORD` | mật khẩu trang /admin, dài và khó đoán |
| `SESSION_SECRET` | chuỗi ngẫu nhiên dài (khác mật khẩu) |
| `UPLOAD_DIR` | thư mục lưu ảnh upload, **nằm ngoài thư mục code**, ví dụ `/home/<user>/bunnie-uploads` |
| `DATA_DIR` | thư mục lưu dự phòng brief, ví dụ `/home/<user>/bunnie-data` |
| `AVAILABILITY_CSV_URL` | link CSV tab Lịch (xem HUONG-DAN-GOOGLE-SHEET.md) |
| `APPS_SCRIPT_URL` | URL ứng dụng web Apps Script |
| `APPS_SCRIPT_TOKEN` | chuỗi bí mật giống `TOKEN` trong Code.gs |

5. Bấm **Deploy**. Mỗi lần code mới được đẩy lên nhánh `main`, Hostinger tự deploy lại (nếu bật auto-deploy).

## 3. Kiểm tra sau khi deploy
- Mở trang chủ, thử gửi form với số điện thoại của bạn → kiểm tra tab Brief trong Sheet và email.
- Vào `/admin`, đăng nhập, thử thêm 1 ảnh → xem ảnh hiện ở mục Sample.
- Deploy lại 1 lần → ảnh vừa upload vẫn còn (nếu mất, nghĩa là `UPLOAD_DIR` đang nằm trong thư mục code).

## 4. Lưu ý
- Ảnh upload và file `samples.json` nằm trong `UPLOAD_DIR`. Nên tải bản sao lưu thư mục này định kỳ qua File Manager.
- Font và sample có sẵn nằm trong repo, nên giữ repo ở chế độ **Private**.
