// Service worker cho app PA staff.
// - Lưu sẵn giao diện và bộ nhận diện khuôn mặt (~7 MB) để mở app nhanh, không tải lại mỗi lần.
// - Không bao giờ lưu dữ liệu chấm công hay kết quả kiểm tra WiFi: những yêu cầu đó luôn đi thẳng lên mạng.
// Khi sửa index.html, tăng số phiên bản dưới đây để điện thoại nhân viên nhận bản mới.
const VERSION = 'pastaff-v4';
const APP = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const LIB = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(APP)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== 'faceapi-lib').map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                 // chấm công (POST) luôn đi thẳng lên máy chủ
  const url = req.url;

  // Bộ nhận diện khuôn mặt: dùng bản đã lưu, chỉ tải một lần
  if (url.startsWith(LIB)) {
    e.respondWith(caches.open('faceapi-lib').then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }

  // Giao diện app: ưu tiên bản mới trên mạng, mất mạng thì dùng bản đã lưu
  if (new URL(url).origin === self.location.origin) {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
  }
  // Mọi yêu cầu khác (kiểm tra WiFi, máy chủ Google) không đi qua bộ nhớ đệm
});
