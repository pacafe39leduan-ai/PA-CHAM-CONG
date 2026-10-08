// Service worker cho app PA staff.
// - Lưu sẵn giao diện và bộ nhận diện khuôn mặt (~7 MB: face-api.js và các file *_model) để mở app nhanh, không tải lại mỗi lần.
// - Không bao giờ lưu dữ liệu chấm công hay kết quả kiểm tra WiFi: những yêu cầu đó luôn đi thẳng lên mạng.
// Khi sửa index.html, tăng số phiên bản dưới đây để điện thoại nhân viên nhận bản mới.
const VERSION = 'pastaff-v22';
const APP = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const BO_NHAN_DIEN = 'faceapi-v1';   // bộ nhận diện ít khi đổi nên lưu riêng, không xóa khi đổi phiên bản app

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(APP.map(u => new Request(u, { cache: 'no-cache' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== BO_NHAN_DIEN).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                 // chấm công (POST) luôn đi thẳng lên máy chủ
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;  // kiểm tra WiFi, máy chủ Google: không qua bộ nhớ đệm

  // Bộ nhận diện khuôn mặt: dùng bản đã lưu, chỉ tải một lần
  if (/(face-api\.js|_model\.bin|weights_manifest\.json)$/.test(url.pathname)) {
    e.respondWith(caches.open(BO_NHAN_DIEN).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }

  // Giao diện app: ưu tiên bản mới trên mạng, mất mạng thì dùng bản đã lưu
  // cache:'no-cache' = luôn hỏi GitHub bản mới nhất (không dùng bản trình duyệt giữ tạm 10 phút)
  e.respondWith(
    fetch(req.url, { cache: 'no-cache' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
  );
});
