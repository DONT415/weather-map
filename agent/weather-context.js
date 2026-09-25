/* ======================================================
   FILE: agent/weather-context.js
   Chức năng: giữ "ngữ cảnh" thời tiết hiện tại cho LLM Agent:
     - vị trí đang chọn trên bản đồ (lat/lon)
     - thời điểm đang chọn trên timeline (đồng bộ 2 chiều)
     - dữ liệu forecast THẬT lấy từ click-info.js (không tự bịa)
   ====================================================== */

(function () {
  const WEEKDAYS_FALLBACK = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

  const state = {
    location: null,          
    current: null,           
    hourly: null,            
    selectedTimestamp: null, 
    next24h: [],
    dailySummary: [],
    selectedConditions: null,
    fetchedAt: null
  };

  const listeners = [];

  function notify() {
    const snapshot = getSnapshot();
    listeners.forEach(function (fn) {
      try { fn(snapshot); } catch (e) { console.error('WeatherContext listener lỗi:', e); }
    });
  }

  function weekdayName(date) {
    const names = (typeof WEEKDAY_NAMES_VI !== 'undefined') ? WEEKDAY_NAMES_VI : WEEKDAYS_FALLBACK;
    return names[date.getDay()];
  }

  function formatLocalDateTime(input) {
    if (!input) return null;
    const d = (input instanceof Date) ? input : new Date(input + (String(input).endsWith('Z') ? '' : 'Z'));
    if (isNaN(d.getTime())) return null;
    const pad = function (n) { return String(n).padStart(2, '0'); };
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function findHourIndexForDate(timeArray, date) {
    if (!timeArray || !date) return -1;
    const targetPrefix = date.toISOString().slice(0, 13);
    for (let i = 0; i < timeArray.length; i++) {
      if (timeArray[i].slice(0, 13) === targetPrefix) return i;
    }
    return -1;
  }

  function findNowIndex(timeArray) {
    if (!timeArray) return -1;
    const nowPrefix = new Date().toISOString().slice(0, 13);
    for (let i = 0; i < timeArray.length; i++) {
      if (timeArray[i].slice(0, 13) >= nowPrefix) return i;
    }
    return -1;
  }

  function pickHourFields(hourly, idx) {
    if (!hourly || idx < 0 || idx >= hourly.time.length) return null;
    function val(field) { return hourly[field] ? hourly[field][idx] : null; }
    return {
      time: formatLocalDateTime(hourly.time[idx]),
      temperature_2m: val('temperature_2m'),
      precipitation: val('precipitation'),
      precipitation_probability: val('precipitation_probability'),
      wind_speed_10m: val('wind_speed_10m'),
      wind_direction_10m: val('wind_direction_10m'),
      relative_humidity_2m: val('relative_humidity_2m'),
      cloud_cover: val('cloud_cover')
    };
  }

  function buildNext24h(hourly) {
    if (!hourly || !hourly.time) return [];
    const startIdx = findNowIndex(hourly.time);
    if (startIdx === -1) return [];
    const out = [];
    for (let i = startIdx; i < startIdx + 24 && i < hourly.time.length; i++) {
      out.push(pickHourFields(hourly, i));
    }
    return out;
  }

  function buildDailySummary(hourly) {
    if (!hourly || !hourly.time) return [];
    const startIdx = findNowIndex(hourly.time);
    if (startIdx === -1) return [];

    const totalHours = hourly.time.length;
    const days = [];
    let dayStart = startIdx;

    while (dayStart < totalHours && days.length < 7) {
      const dayEnd = Math.min(dayStart + 24, totalHours);
      let tempMin = Infinity, tempMax = -Infinity;
      let totalPrecip = 0, maxPrecipProb = 0;
      let maxWind = -Infinity, maxWindTime = null, maxWindDir = null;
      let humiditySum = 0, humidityCount = 0;
      let cloudSum = 0, cloudCount = 0;

      for (let i = dayStart; i < dayEnd; i++) {
        const t = hourly.temperature_2m ? hourly.temperature_2m[i] : null;
        const p = hourly.precipitation ? hourly.precipitation[i] : null;
        const pp = hourly.precipitation_probability ? hourly.precipitation_probability[i] : null;
        const w = hourly.wind_speed_10m ? hourly.wind_speed_10m[i] : null;
        const wd = hourly.wind_direction_10m ? hourly.wind_direction_10m[i] : null;
        const h = hourly.relative_humidity_2m ? hourly.relative_humidity_2m[i] : null;
        const c = hourly.cloud_cover ? hourly.cloud_cover[i] : null;

        if (Number.isFinite(t)) { tempMin = Math.min(tempMin, t); tempMax = Math.max(tempMax, t); }
        if (Number.isFinite(p)) totalPrecip += p;
        if (Number.isFinite(pp)) maxPrecipProb = Math.max(maxPrecipProb, pp);
        if (Number.isFinite(w) && w > maxWind) { maxWind = w; maxWindTime = hourly.time[i]; maxWindDir = wd; }
        if (Number.isFinite(h)) { humiditySum += h; humidityCount++; }
        if (Number.isFinite(c)) { cloudSum += c; cloudCount++; }
      }

      const localDayStart = new Date(hourly.time[dayStart] + 'Z');

      days.push({
        date: formatLocalDateTime(localDayStart).slice(0, 10),
        weekday: weekdayName(localDayStart),
        tempMinC: Number.isFinite(tempMin) ? Math.round(tempMin * 10) / 10 : null,
        tempMaxC: Number.isFinite(tempMax) ? Math.round(tempMax * 10) / 10 : null,
        totalPrecipitationMm: Math.round(totalPrecip * 10) / 10,
        maxPrecipitationProbabilityPercent: maxPrecipProb || null,
        maxWindKmh: Number.isFinite(maxWind) ? Math.round(maxWind * 10) / 10 : null,
        maxWindTime: formatLocalDateTime(maxWindTime),
        maxWindDirectionDeg: maxWindDir,
        avgHumidityPercent: humidityCount ? Math.round(humiditySum / humidityCount) : null,
        avgCloudCoverPercent: cloudCount ? Math.round(cloudSum / cloudCount) : null
      });

      dayStart += 24;
    }

    return days;
  }

  function recomputeDerived() {
    state.next24h = buildNext24h(state.hourly);
    state.dailySummary = buildDailySummary(state.hourly);
    state.selectedConditions = (state.hourly && state.selectedTimestamp)
      ? pickHourFields(state.hourly, findHourIndexForDate(state.hourly.time, state.selectedTimestamp))
      : null;
  }

  function setLocation(payload) {
    state.location = { lat: payload.lat, lon: payload.lon, label: payload.label || null };
    state.current = payload.current || null;
    state.hourly = payload.hourly || null;
    state.fetchedAt = new Date().toISOString();

    recomputeDerived();
    notify();
  }

  function setSelectedTimestamp(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return;
    state.selectedTimestamp = date;
    recomputeDerived();
    notify();
  }

  function hasLocation() {
    return !!(state.location && state.hourly);
  }

  // Trả về toàn bộ context để gửi lên Agent backend.
  function getSnapshot() {
    return {
      location: state.location,
      generatedAt: formatLocalDateTime(state.fetchedAt),
      dataAvailableDays: state.hourly && state.hourly.time ? Math.floor(state.hourly.time.length / 24) : 0,
      selectedTimestamp: formatLocalDateTime(state.selectedTimestamp),
      currentConditions: state.current ? Object.assign({}, state.current, {
        time: formatLocalDateTime(state.current.time)
      }) : null,
      selectedConditions: state.selectedConditions || null,
      next24h: state.next24h || [],
      dailySummary: state.dailySummary || [],
      note: 'Tất cả mốc thời gian trong dữ liệu này đã quy đổi theo giờ trên máy người dùng.'
    };
  }

  function computeRangeStats(rangeDays) {
    if (!hasLocation()) return null;

    if (rangeDays === 1) {
      return {
        type: 'hourly24h',
        rangeDays: 1,
        location: state.location,
        hours: state.next24h
      };
    }

    const days = (state.dailySummary || []).slice(0, rangeDays);
    return {
      type: 'dailySummary',
      rangeDays: rangeDays,
      location: state.location,
      days: days
    };
  }

  function onChange(fn) {
    if (typeof fn === 'function') listeners.push(fn);
  }

  window.WeatherContext = {
    setLocation: setLocation,
    setSelectedTimestamp: setSelectedTimestamp,
    hasLocation: hasLocation,
    getSnapshot: getSnapshot,
    computeRangeStats: computeRangeStats,
    onChange: onChange
  };
})();