/* ======================================================
   FILE: agent/weather-report.js
   Chức năng: Chức năng 2 - Tự tạo biểu đồ và báo cáo.
   ====================================================== */

(function () {
  const statusEl = document.getElementById('agent-report-context-status');
  const narrativeEl = document.getElementById('agent-report-narrative');
  const rangeButtons = document.querySelectorAll('.agent-range-btn');

  let activeRangeDays = null;

  function setActiveButton(rangeDays) {
    rangeButtons.forEach(function (btn) {
      btn.classList.toggle('active', parseInt(btn.dataset.range, 10) === rangeDays);
    });
  }

  async function generate(rangeDays) {
    activeRangeDays = rangeDays;
    setActiveButton(rangeDays);

    if (!WeatherContext.hasLocation()) {
      statusEl.textContent = 'Chưa chọn điểm nào trên bản đồ. Hãy click vào 1 vị trí trước.';
      narrativeEl.textContent = '';
      return;
    }

    const snapshot = WeatherContext.getSnapshot();
    statusEl.textContent = `📍 ${snapshot.location.label || `${snapshot.location.lat.toFixed(2)}, ${snapshot.location.lon.toFixed(2)}`}`;

    const stats = WeatherContext.computeRangeStats(rangeDays);

    if (!stats || (stats.type === 'dailySummary' && stats.days.length === 0) ||
        (stats.type === 'hourly24h' && stats.hours.length === 0)) {
      narrativeEl.textContent = 'Chưa đủ dữ liệu forecast để tổng hợp cho khoảng thời gian này.';
      WeatherChart.render(null);
      return;
    }

    WeatherChart.render(stats);

    narrativeEl.textContent = 'Đang tạo nhận xét...';

    try {
      const response = await fetch(`${AGENT_API_BASE}/api/agent/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: snapshot, rangeDays: rangeDays, stats: stats })
      });

      if (!response.ok) {
        const errBody = await response.json().catch(function () { return {}; });
        throw new Error(errBody.error || `Status ${response.status}`);
      }

      const data = await response.json();
      narrativeEl.textContent = data.narrative || 'Không có nhận xét.';
    } catch (error) {
      console.error('Lỗi tạo báo cáo Agent:', error);

      if (error instanceof TypeError) {
        narrativeEl.textContent =
          `Không kết nối được backend Agent tại ${AGENT_API_BASE} ` +
          '(kiểm tra đã chạy "npm run dev" ở thư mục gốc project chưa). ' +
          'Biểu đồ số liệu phía trên vẫn là dữ liệu thật, không bị ảnh hưởng.';
      } else {
        narrativeEl.textContent =
          `Backend Agent báo lỗi: ${error.message}. ` +
          'Biểu đồ số liệu phía trên vẫn là dữ liệu thật, không bị ảnh hưởng.';
      }
    }
  }

  rangeButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      generate(parseInt(btn.dataset.range, 10));
    });
  });

  WeatherContext.onChange(function () {
    if (activeRangeDays) generate(activeRangeDays);
  });

  window.WeatherReport = { generate: generate };
})();