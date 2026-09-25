/* ======================================================
   FILE: click-info.js
   Chức năng: click vào bản đồ -> gọi API lấy thời tiết tại 1 điểm,
              hiển thị panel bên trái + tooltip nổi kiểu Windy
   ====================================================== */

const locationNameEl = document.getElementById('location-name');
const weatherDetailsEl = document.getElementById('weather-details');
let tooltipMarker = null;

function normalizeLongitude(lng) {
  return ((lng + 180) % 360 + 360) % 360 - 180;
}

async function fetchPointData(lat, lon) {
  const timezone = typeof APP_TIMEZONE !== 'undefined' ? APP_TIMEZONE : 'Asia/Ho_Chi_Minh';
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,wind_speed_10m,wind_direction_10m,precipitation,relative_humidity_2m` +
    `&hourly=temperature_2m,precipitation,precipitation_probability,wind_speed_10m,wind_direction_10m,relative_humidity_2m,cloud_cover` +
    `&forecast_days=${typeof FORECAST_DAYS !== 'undefined' ? FORECAST_DAYS : 7}&timezone=${encodeURIComponent(timezone)}`;

  try {
    const response = await throttledFetch(url, undefined, 'high');
    if (!response.ok) throw new Error(`Status ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Lỗi khi gọi API thời tiết:', error);
    return null;
  }
}

function renderWeatherDetails(weather) {
  if (!weather) {
    weatherDetailsEl.innerHTML = `<span class="placeholder-text">Không lấy được dữ liệu, thử lại sau</span>`;
    return;
  }
  weatherDetailsEl.innerHTML = `
    <div class="weather-row">🌡️ Nhiệt độ: <strong>${weather.temperature_2m}°C</strong></div>
    <div class="weather-row">💨 Gió: <strong>${weather.wind_speed_10m} km/h</strong></div>
    <div class="weather-row">🧭 Hướng gió: <strong>${weather.wind_direction_10m}°</strong></div>
    <div class="weather-row">💧 Độ ẩm: <strong>${weather.relative_humidity_2m}%</strong></div>
    <div class="weather-row">🌧️ Mưa: <strong>${weather.precipitation} mm</strong></div>
  `;
}

function degreesToCompass(deg) {
  const directions = ['Bắc', 'Đông Bắc', 'Đông', 'Đông Nam', 'Nam', 'Tây Nam', 'Tây', 'Tây Bắc'];
  const index = Math.round(deg / 45) % 8;
  return directions[index];
}

function buildTooltipHtml(weather) {
  const arrowRotation = (weather.wind_direction_10m + 180) % 360;
  const compassLabel = degreesToCompass(weather.wind_direction_10m);

  return `
    <div class="tooltip-box">
      <span class="tooltip-arrow" style="transform: rotate(${arrowRotation}deg)">▲</span>
      <span>${weather.wind_speed_10m} km/h</span>
      <span class="tooltip-compass">${compassLabel}</span>
      <button class="tooltip-close-btn" onclick="closeWeatherTooltip()">×</button>
    </div>
    <div class="tooltip-line"></div>
    <div class="tooltip-dot"></div>
  `;
}

function renderWindTooltip(lat, lon, weather) {
  if (tooltipMarker) {
    map.removeLayer(tooltipMarker);
    tooltipMarker = null;
  }
  if (!weather) return;

  const icon = L.divIcon({
    className: 'wind-tooltip-marker',
    html: buildTooltipHtml(weather),
    iconSize: [170, 96],
    iconAnchor: [85, 96]
  });

  tooltipMarker = L.marker([lat, lon], { icon: icon, interactive: false }).addTo(map);
}

window.closeWeatherTooltip = function () {
  if (tooltipMarker) {
    map.removeLayer(tooltipMarker);
    tooltipMarker = null;
  }
};

async function selectPointOnMap(lat, lon, label) {
  const rawLon = lon;
  lon = normalizeLongitude(lon);

  locationNameEl.textContent = label || `Vị trí: ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  weatherDetailsEl.innerHTML = `<span class="placeholder-text">Đang tải dữ liệu...</span>`;
  meteogramPanel.style.display = 'none';

  const data = await fetchPointData(lat.toFixed(4), lon.toFixed(4));
 
  if (!data) {
    weatherDetailsEl.innerHTML =
      `<span class="placeholder-text">Không tải được dữ liệu (có thể do gọi API quá nhanh - đã tự thử lại nhưng vẫn lỗi). Hãy thử click lại sau vài giây.</span>`;
    meteogramPanel.style.display = 'none';
    return;
  }

  const weather = data.current;
  const hourly = data.hourly;

  renderWeatherDetails(weather);
  renderWindTooltip(lat, rawLon, weather);
  renderMeteogramChart(hourly);

  if (window.WeatherContext) {
    WeatherContext.setLocation({
      lat: lat,
      lon: rawLon,
      label: label || null,
      current: weather,
      hourly: hourly
    });
  }
}

map.on('click', function (e) {
  selectPointOnMap(e.latlng.lat, e.latlng.lng);
});