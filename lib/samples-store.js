'use strict';
// Kho sample: danh sách lưu trong UPLOAD_DIR/samples.json (ngoài repo, không bị ghi đè khi deploy).
// Lần đầu chạy: khởi tạo từ content/samples-seed.json (các mẫu có sẵn trong repo).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

module.exports = function createStore({ uploadDir, seedFile }) {
  const file = path.join(uploadDir, 'samples.json');
  fs.mkdirSync(path.join(uploadDir, 'samples'), { recursive: true });

  function load() {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    const seed = JSON.parse(fs.readFileSync(seedFile, 'utf8')).map((s) => ({
      id: crypto.randomBytes(6).toString('hex'), hidden: false, title: '', hideName: false, ...s,
    }));
    save(seed);
    return seed;
  }
  function save(items) {
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(items, null, 1));
    fs.renameSync(tmp, file);
  }
  let items = load();

  return {
    all: () => items,
    visible: () => items.filter((s) => !s.hidden),
    add(item) { item.id = crypto.randomBytes(6).toString('hex'); items.unshift(item); save(items); return item; },
    update(id, patch) { const it = items.find((s) => s.id === id); if (it) { Object.assign(it, patch); save(items); } return it; },
    remove(id) {
      const it = items.find((s) => s.id === id); if (!it) return;
      items = items.filter((s) => s.id !== id); save(items);
      // Chỉ xóa file nằm trong thư mục upload (không đụng mẫu có sẵn trong repo).
      ['src', 'thumb', 'poster'].forEach((k) => {
        if (it[k] && it[k].startsWith('/uploads/')) {
          const f = path.join(uploadDir, it[k].replace('/uploads/', ''));
          if (f.startsWith(uploadDir)) fs.rmSync(f, { force: true });
        }
      });
    },
    // Đổi chỗ với mẫu gần nhất cùng nhóm theo hướng dir (-1 lên, +1 xuống).
    move(id, dir) {
      const i = items.findIndex((s) => s.id === id); if (i < 0) return;
      let j = i + dir;
      while (j >= 0 && j < items.length && items[j].category !== items[i].category) j += dir;
      if (j < 0 || j >= items.length) return;
      [items[i], items[j]] = [items[j], items[i]]; save(items);
    },
  };
};
