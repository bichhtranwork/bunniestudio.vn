/**
 * Bunnie Studio: nhận thông tin khách từ website.
 * - Ghi mỗi lượt gửi thành 1 dòng trong tab "Brief"
 * - Gửi email báo về NOTIFY_EMAIL
 * Cài đặt: xem docs/HUONG-DAN-GOOGLE-SHEET.md
 */
const NOTIFY_EMAIL = 'bunniestuu@gmail.com';
const SHEET_BRIEF = 'Brief';
// Chuỗi bí mật, phải giống biến APPS_SCRIPT_TOKEN trên hosting (chống người lạ gửi rác).
const TOKEN = 'DOI-CHUOI-NAY';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');
    if (data.token !== TOKEN) return json_({ ok: false, error: 'token' });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName(SHEET_BRIEF);
    if (!sh) {
      sh = ss.insertSheet(SHEET_BRIEF);
      sh.appendRow(['Thời gian', 'Số điện thoại', 'Link brief', 'Gửi kèm', 'Trạng thái']);
      sh.setFrozenRows(1);
    }
    const at = new Date(data.at || Date.now());
    // Thêm dấu ' để Sheet giữ số 0 đầu số điện thoại
    sh.appendRow([at, "'" + String(data.phone || ''), data.briefUrl || '', data.summary || '', 'Mới']);

    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      subject: 'Brief mới từ website: ' + (data.phone || ''),
      body:
        'Số điện thoại: ' + (data.phone || '') + '\n' +
        'Link brief: ' + (data.briefUrl || '(không có)') + '\n\n' +
        (data.summary || '') + '\n\n' +
        'Xem tất cả: ' + ss.getUrl(),
    });
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// Chạy hàm này trong trình soạn Apps Script để thử: ghi 1 dòng vào tab Brief và gửi 1 email.
function thuGuiBrief() {
  const res = doPost({ postData: { contents: JSON.stringify({
    token: TOKEN, phone: '0900000000', briefUrl: '', summary: 'Đây là lượt gửi thử từ Apps Script.', at: new Date().toISOString(),
  }) } });
  Logger.log(res.getContent());
}
