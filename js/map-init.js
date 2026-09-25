/* ======================================================
   FILE: map-init.js
   Chức năng: khởi tạo bản đồ nền, lớp tile, nút định vị,
              tạo pane riêng cho lớp gió mờ (luôn nổi trên cùng)
   Biến toàn cục quan trọng export cho các file khác dùng: map
   ====================================================== */

const WORLD_CENTER = [20, 10];
const INITIAL_ZOOM = 2;

const map = L.map('map', {
  zoomControl: true,
  attributionControl: true,
  minZoom: 2,
  worldCopyJump: true
}).setView(WORLD_CENTER, INITIAL_ZOOM);

map.createPane('windOverlayPane');
map.getPane('windOverlayPane').style.zIndex = 450;
map.getPane('windOverlayPane').style.pointerEvents = 'none';

map.createPane('bordersPane');
map.getPane('bordersPane').style.zIndex = 460;
map.getPane('bordersPane').style.pointerEvents = 'none';

const CARTO_API_KEY = 'cb1_2lik_1_34b328f8555cd205681e8299';
const CARTO_TILE_URL_WITH_KEY = `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`;
const CARTO_TILE_URL_FALLBACK = `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png`;

document.getElementById('map').style.backgroundColor = '#05080b';
const BASE_TILE_OPACITY = 0.72; 

let baseTileLayer = L.tileLayer(CARTO_TILE_URL_WITH_KEY, {
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  subdomains: 'abcd',
  maxZoom: 19,
  opacity: BASE_TILE_OPACITY
}).addTo(map);

let tileFallbackTriggered = false;
baseTileLayer.on('tileerror', function () {
  if (tileFallbackTriggered) return;
  tileFallbackTriggered = true;

  console.warn(
    'Không tải được tile bản đồ nền bằng API key hiện tại ' +
    '(có thể do domain hiện tại chưa được cấp phép trong Carto dashboard, ' +
    'hoặc key không hợp lệ/hết hạn). Đang chuyển sang tile dự phòng không cần key...'
  );

  map.removeLayer(baseTileLayer);
  baseTileLayer = L.tileLayer(CARTO_TILE_URL_FALLBACK, {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 19,
    opacity: BASE_TILE_OPACITY
  }).addTo(map);
});

let userMarker = null;

const userLocationIcon = L.divIcon({
  className: 'user-location-marker',
  html: '<div class="pulse-dot"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

function locateUser() {
  if (!navigator.geolocation) {
    alert('Trình duyệt của bạn không hỗ trợ định vị.');
    return;
  }

  const locateBtn = document.getElementById('locate-btn');
  locateBtn.textContent = '⏳';

  navigator.geolocation.getCurrentPosition(
    function (position) {
      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;

      if (userMarker) {
        userMarker.setLatLng([userLat, userLng]);
      } else {
        userMarker = L.marker([userLat, userLng], { icon: userLocationIcon })
          .addTo(map)
          .bindPopup("Vị trí của bạn");
      }

      map.flyTo([userLat, userLng], 10);
      locateBtn.textContent = '📍';
    },
    function (error) {
      console.warn('Không lấy được vị trí:', error.message);
      alert('Không thể xác định vị trí. Vui lòng kiểm tra quyền truy cập vị trí trên trình duyệt.');
      locateBtn.textContent = '📍';
    }
  );
}

document.getElementById('locate-btn').addEventListener('click', locateUser);


let lastOpenMeteoRequestTime = 0;
const MIN_REQUEST_GAP_MS = 350; 
const MAX_429_RETRIES = 3;

const highPriorityQueue = []; 
const lowPriorityQueue = [];  
let isDrainingQueue = false;

function throttledFetch(url, options, priority) {
  return new Promise(function (resolve, reject) {
    const task = {
      url: url,
      options: options,
      priority: priority === 'high' ? 'high' : 'low',
      retryCount: 0,
      resolve: resolve,
      reject: reject
    };
    (task.priority === 'high' ? highPriorityQueue : lowPriorityQueue).push(task);
    drainQueue();
  });
}

async function drainQueue() {
  if (isDrainingQueue) return; 
  isDrainingQueue = true;

  while (highPriorityQueue.length > 0 || lowPriorityQueue.length > 0) {
  
    const task = highPriorityQueue.length > 0 ? highPriorityQueue.shift() : lowPriorityQueue.shift();

    const now = Date.now();
    const waitTime = Math.max(0, lastOpenMeteoRequestTime + MIN_REQUEST_GAP_MS - now);
    if (waitTime > 0) {
      await new Promise(function (resolve) { setTimeout(resolve, waitTime); });
    }

    lastOpenMeteoRequestTime = Date.now();

    try {
      const response = await fetch(task.url, task.options);

      if (response.status === 429 && task.retryCount < MAX_429_RETRIES) {
        const retryAfterHeader = response.headers.get('Retry-After');
        const retryAfterMs = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : null;
        const backoffMs = retryAfterMs || (1000 * Math.pow(2, task.retryCount)); // 1s, 2s, 4s...

        task.retryCount += 1;
        console.warn(`Bị giới hạn tốc độ gọi API (429). Thử lại sau ${backoffMs}ms (lần ${task.retryCount}/${MAX_429_RETRIES})...`);

        await new Promise(function (resolve) { setTimeout(resolve, backoffMs); });
        (task.priority === 'high' ? highPriorityQueue : lowPriorityQueue).unshift(task);
        continue;
      }

      task.resolve(response);
    } catch (error) {
      task.reject(error);
    }
  }

  isDrainingQueue = false;
}