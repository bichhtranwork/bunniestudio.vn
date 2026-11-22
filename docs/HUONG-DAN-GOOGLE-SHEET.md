# Hướng dẫn: Google Sheet cho lịch trống và nhận brief

Làm một lần, khoảng 15 phút. Dùng tài khoản Google của Bunnie (bunniestuu@gmail.com).

## 1. Tạo Google Sheet

1. Vào https://sheets.new, đặt tên file: **Bunnie Website**.
2. Đổi tên tab đầu tiên thành **Lịch**, gõ tiêu đề cột ở dòng 1:

| A | B | C |
|---|---|---|
| Ngày | Trạng thái | Ghi chú |

3. Vào **Tệp → Cài đặt → Ngôn ngữ**, chọn **Việt Nam** để ngày hiển thị dạng ngày/tháng/năm.
4. Từ dòng 2, mỗi dòng là một ngày:
   - Cột **Ngày** gõ dạng `15/11/2026` (ngày/tháng/năm).
   - Cột **Trạng thái** chỉ gõ một trong ba chữ: `Trống`, `Còn ít`, `Kín`.
   - Ngày nào không ghi thì web hiểu là **Trống**.
   - Mẹo: chọn cột B → **Dữ liệu → Xác thực dữ liệu → Menu thả xuống** với 3 giá trị trên để chọn nhanh trên điện thoại.

## 2. Xuất bản tab Lịch (để web đọc được)

1. **Tệp → Chia sẻ → Xuất bản lên web**.
2. Chọn tab **Lịch**, định dạng **Giá trị được phân tách bằng dấu phẩy (.csv)** → **Xuất bản**.
3. Sao chép link vừa hiện ra. Đây là giá trị cho biến **`AVAILABILITY_CSV_URL`** trên hosting. Link phải kết thúc bằng `output=csv` (nếu là `output=tsv` thì sửa chữ `tsv` thành `csv`).

Chỉ tab Lịch được công khai. Tab Brief (bước 3) không công khai.

## 3. Cài Apps Script nhận brief

1. Trong file Sheet: **Tiện ích mở rộng → Apps Script**.
2. Xóa hết code mẫu, dán toàn bộ nội dung file `google-apps-script/Code.gs` trong repo.
3. Sửa dòng `const TOKEN = 'DOI-CHUOI-NAY';` thành một chuỗi bí mật bất kỳ, dài và khó đoán. Ghi lại chuỗi này, đây là giá trị cho biến **`APPS_SCRIPT_TOKEN`** trên hosting.
4. Bấm **Lưu** (biểu tượng đĩa mềm).
5. **Triển khai → Tùy chọn triển khai mới**:
   - Bấm biểu tượng bánh răng, chọn **Ứng dụng web**.
   - **Thực thi dưới dạng:** Tôi (bunniestuu@gmail.com)
   - **Người có quyền truy cập:** Bất kỳ ai
   - Bấm **Triển khai**, rồi **Cho phép truy cập** và chọn tài khoản Bunnie. Nếu Google cảnh báo "ứng dụng chưa được xác minh", bấm **Nâng cao → Đi tới … (không an toàn)**. Đây là script của chính bạn.
6. Sao chép **URL ứng dụng web** (dạng `https://script.google.com/macros/s/…/exec`). Đây là giá trị cho biến **`APPS_SCRIPT_URL`** trên hosting.

7. **Thử ngay trong Apps Script:** chọn hàm `thuGuiBrief` ở thanh công cụ (cạnh nút Gỡ lỗi), bấm **Chạy**. Nếu Sheet có thêm tab **Brief** với 1 dòng thử và hộp thư nhận được email, nghĩa là đã cài đúng. Xóa dòng thử đi là xong.

Khi khách gửi form, Sheet tự có thêm tab **Brief**, mỗi lượt gửi là một dòng, và email báo sẽ về bunniestuu@gmail.com.

## Sửa code Apps Script sau này

Sau khi sửa, vào **Triển khai → Quản lý các lần triển khai → biểu tượng bút chì → Phiên bản: Phiên bản mới → Triển khai**. URL giữ nguyên.
