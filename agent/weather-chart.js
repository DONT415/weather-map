/* ======================================================
   FILE: agent/weather-chart.js
   Chức năng: vẽ biểu đồ cho tính năng Báo cáo tự động (Chức năng 2),
   dùng Chart.js đã có sẵn trong project (không cần thêm thư viện).
   ====================================================== */

(function () {
  const canvas = document.getElementById('agent-report-chart');
  let chartInstance = null;

  function destroyChart() {
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
  }

  function renderHourly24h(stats) {
    const labels = stats.hours.map(function (h) {
      return h.time ? h.time.slice(11, 16) : '--:--';
    });
    const temps = stats.hours.map(function (h) { return h.temperature_2m; });
    const rains = stats.hours.map(function (h) { return h.precipitation; });

    chartInstance = new Chart(canvas, {
      data: {
        labels: labels,
        datasets: [
          {
            type: 'line',
            label: 'Nhiệt độ (°C)',
            data: temps,
            borderColor: '#4fc3f7',
            backgroundColor: '#4fc3f7',
            yAxisID: 'yTemp',
            tension: 0.3,
            pointRadius: 2
          },
          {
            type: 'bar',
            label: 'Mưa (mm)',
            data: rains,
            backgroundColor: 'rgba(79, 195, 247, 0.35)',
            yAxisID: 'yRain'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { color: '#fff' } } },
        scales: {
          x: { ticks: { color: 'rgba(255,255,255,0.6)' }, grid: { color: 'rgba(255,255,255,0.08)' } },
          yTemp: { position: 'left', ticks: { color: '#4fc3f7' }, grid: { color: 'rgba(255,255,255,0.08)' } },
          yRain: { position: 'right', ticks: { color: 'rgba(255,255,255,0.6)' }, grid: { display: false } }
        }
      }
    });
  }

  function renderDailySummary(stats) {
    const labels = stats.days.map(function (d) { return `${d.weekday} ${d.date.slice(8, 10)}/${d.date.slice(5, 7)}`; });
    const tempMax = stats.days.map(function (d) { return d.tempMaxC; });
    const tempMin = stats.days.map(function (d) { return d.tempMinC; });
    const rain = stats.days.map(function (d) { return d.totalPrecipitationMm; });

    chartInstance = new Chart(canvas, {
      data: {
        labels: labels,
        datasets: [
          {
            type: 'line',
            label: 'Nhiệt độ cao nhất (°C)',
            data: tempMax,
            borderColor: '#ffb74d',
            backgroundColor: '#ffb74d',
            yAxisID: 'yTemp',
            tension: 0.3
          },
          {
            type: 'line',
            label: 'Nhiệt độ thấp nhất (°C)',
            data: tempMin,
            borderColor: '#4fc3f7',
            backgroundColor: '#4fc3f7',
            yAxisID: 'yTemp',
            tension: 0.3
          },
          {
            type: 'bar',
            label: 'Tổng mưa (mm)',
            data: rain,
            backgroundColor: 'rgba(79, 195, 247, 0.35)',
            yAxisID: 'yRain'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { color: '#fff' } } },
        scales: {
          x: { ticks: { color: 'rgba(255,255,255,0.6)' }, grid: { color: 'rgba(255,255,255,0.08)' } },
          yTemp: { position: 'left', ticks: { color: '#ffb74d' }, grid: { color: 'rgba(255,255,255,0.08)' } },
          yRain: { position: 'right', ticks: { color: 'rgba(255,255,255,0.6)' }, grid: { display: false } }
        }
      }
    });
  }

  function render(stats) {
    destroyChart();
    if (!stats) return;

    if (stats.type === 'hourly24h') {
      renderHourly24h(stats);
    } else if (stats.type === 'dailySummary') {
      renderDailySummary(stats);
    }
  }

  window.WeatherChart = { render: render };
})();