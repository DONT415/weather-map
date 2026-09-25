/* ======================================================
   FILE: meteogram.js
   Chức năng: vẽ biểu đồ dự báo Nhiệt độ (đường) + Mưa (cột)
              cho 24 giờ tới, tại điểm vừa click/tìm kiếm
   ====================================================== */

const meteogramPanel = document.getElementById('meteogram-panel');
const meteogramCanvas = document.getElementById('meteogram-canvas');
let meteogramChart = null;

function renderMeteogramChart(hourly) {
  if (!hourly) {
    meteogramPanel.style.display = 'none';
    return;
  }

  const now = new Date();
  const pad = function (n) { return String(n).padStart(2, '0'); };
  const nowPrefix = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}`;
  let startIdx = hourly.time.findIndex(function (t) {
    return t.slice(0, 13) >= nowPrefix;
  });
  if (startIdx === -1) startIdx = 0;

  const labels = [];
  const temps = [];
  const rains = [];

  for (let i = startIdx; i < startIdx + 24 && i < hourly.time.length; i++) {
    const date = new Date(hourly.time[i]);
    labels.push(String(date.getHours()).padStart(2, '0') + 'h');
    temps.push(hourly.temperature_2m[i]);
    rains.push(hourly.precipitation[i]);
  }

  if (meteogramChart) {
    meteogramChart.destroy();
  }

  meteogramChart = new Chart(meteogramCanvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          type: 'line',
          label: 'Nhiệt độ (°C)',
          data: temps,
          borderColor: '#ff9800',
          backgroundColor: '#ff9800',
          yAxisID: 'yTemp',
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2
        },
        {
          type: 'bar',
          label: 'Mưa (mm)',
          data: rains,
          backgroundColor: 'rgba(79, 195, 247, 0.6)',
          yAxisID: 'yRain'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: 'rgba(255,255,255,0.7)', font: { size: 10 }, boxWidth: 12 }
        }
      },
      scales: {
        x: {
          ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 9 }, maxTicksLimit: 8 },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        yTemp: {
          position: 'left',
          ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 9 } },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        yRain: {
          position: 'right',
          ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 9 } },
          grid: { display: false },
          min: 0
        }
      }
    }
  });

  meteogramPanel.style.display = 'block';
}