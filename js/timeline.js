/* ======================================================
   FILE: timeline.js
   Chức năng: thanh giờ trong ngày + thanh chọn ngày (day tabs) + nút Play
   ====================================================== */

const timelineSlider = document.getElementById('timeline-slider');
const timelineLabel = document.getElementById('timeline-label');
const playBtn = document.getElementById('play-btn');
const dayTabsEl = document.getElementById('day-tabs');

const WEEKDAY_NAMES_VI = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

let selectedDayIndex = 0;
let hourOfDay = 0;

function getDateAtIndex(rawData, absoluteIndex) {
  const timeStr = rawData[0] && rawData[0].hourly ? rawData[0].hourly.time[absoluteIndex] : null;
  return timeStr ? new Date(timeStr) : null;
}

function formatHourLabel(date) {
  if (!date) return '--:--';
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function buildDayTabs(rawData) {
  dayTabsEl.innerHTML = '';

  for (let d = 0; d < FORECAST_DAYS; d++) {
    const date = getDateAtIndex(rawData, d * 24);
    if (!date) continue;

    const weekday = WEEKDAY_NAMES_VI[date.getDay()];
    const dayNum = date.getDate();
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    const tab = document.createElement('button');
    tab.className = 'day-tab' + (d === selectedDayIndex ? ' active' : '') + (isWeekend ? ' weekend' : '');
    tab.innerHTML = `${weekday} ${dayNum}` + (isWeekend ? '<span class="day-tab-dot"></span>' : '');
    tab.addEventListener('click', function () {
      selectDay(d);
    });

    dayTabsEl.appendChild(tab);
  }
}

function selectDay(dayIndex) {
  selectedDayIndex = dayIndex;

  document.querySelectorAll('.day-tab').forEach(function (tab, idx) {
    tab.classList.toggle('active', idx === dayIndex);
  });

  applySelection();
}

function applySelection() {
  const absoluteIndex = selectedDayIndex * 24 + hourOfDay;

  currentHourOffset = absoluteIndex - nowHourIndex;

  ensureGridData().then(function (rawData) {
    const date = getDateAtIndex(rawData, absoluteIndex);
    timelineLabel.textContent = formatHourLabel(date);

    if (window.WeatherContext && date) {
      WeatherContext.setSelectedTimestamp(date);
    }
  });

  showLayer(currentLayerName, currentHourOffset);
}

let sliderDebounceTimer = null;

timelineSlider.addEventListener('input', function () {
  hourOfDay = parseInt(timelineSlider.value);

  ensureGridData().then(function (rawData) {
    const absoluteIndex = selectedDayIndex * 24 + hourOfDay;
    const date = getDateAtIndex(rawData, absoluteIndex);
    timelineLabel.textContent = formatHourLabel(date);

    if (window.WeatherContext && date) {
      WeatherContext.setSelectedTimestamp(date);
    }
  });

  clearTimeout(sliderDebounceTimer);
  sliderDebounceTimer = setTimeout(applySelection, 200);
});

let isPlaying = false;
let playInterval = null;

playBtn.addEventListener('click', function () {
  isPlaying = !isPlaying;

  if (isPlaying) {
    playBtn.textContent = '⏸';
    playInterval = setInterval(function () {
      hourOfDay = (hourOfDay + 1) % 24;
      timelineSlider.value = hourOfDay;
      applySelection();
    }, 900);
  } else {
    playBtn.textContent = '▶';
    clearInterval(playInterval);
  }
});

ensureGridData().then(function (rawData) {
  selectedDayIndex = Math.floor(nowHourIndex / 24);
  hourOfDay = nowHourIndex % 24;

  timelineSlider.value = hourOfDay;
  buildDayTabs(rawData);

  const date = getDateAtIndex(rawData, nowHourIndex);
  timelineLabel.textContent = formatHourLabel(date);

  if (window.WeatherContext && date) {
    WeatherContext.setSelectedTimestamp(date);
  }
});