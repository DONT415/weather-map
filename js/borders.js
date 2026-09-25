/* ======================================================
   FILE: borders.js
   Chức năng: vẽ đường biên giới quốc gia/châu lục đậm nét,
              luôn hiện phía trên các lớp màu (Nhiệt độ/Mưa/Mây...)
   ====================================================== */

const COUNTRY_BORDERS_URLS = [
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson',
  'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector/geojson/ne_110m_admin_0_countries.geojson'
];

function renderCountryBorders(geojson) {
  L.geoJSON(geojson, {
    pane: 'bordersPane',
    interactive: false,
    style: {
      color: 'rgba(255, 255, 255, 0.65)',
      weight: 1.2,
      fill: false
    }
  }).addTo(map);
}

async function loadCountryBorders() {
  for (let i = 0; i < COUNTRY_BORDERS_URLS.length; i++) {
    const url = COUNTRY_BORDERS_URLS[i];
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const geojson = await response.json();

      renderCountryBorders(geojson);
      if (i > 0) {
        console.warn('Đã dùng nguồn border dự phòng (nguồn chính lỗi):', COUNTRY_BORDERS_URLS[0]);
      }
      return;
    } catch (error) {
      console.warn(`Không tải được border từ nguồn ${i + 1}/${COUNTRY_BORDERS_URLS.length}:`, error.message);
    }
  }

  console.warn('Không tải được đường biên giới quốc gia từ bất kỳ nguồn nào. Bản đồ và các lớp thời tiết vẫn hoạt động bình thường.');
}

loadCountryBorders();