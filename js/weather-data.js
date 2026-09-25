/* ======================================================
   FILE: weather-data.js
   Chức năng: gọi API lấy dữ liệu lưới CHÍNH + PHỤ + KHU VỰC
   ====================================================== */

const GRID_CONFIG = {
  latMin: -85,
  latMax: 85,
  lonMin: -180,
  lonMax: 180,
  step: 10  
};

const GRID_METADATA = {
  latMin: GRID_CONFIG.latMin,
  latMax: GRID_CONFIG.latMax,
  lonMin: GRID_CONFIG.lonMin,
  lonMax: GRID_CONFIG.lonMax,
  step: GRID_CONFIG.step,
  rows: Math.round((GRID_CONFIG.latMax - GRID_CONFIG.latMin) / GRID_CONFIG.step) + 1,
  cols: Math.round((GRID_CONFIG.lonMax - GRID_CONFIG.lonMin) / GRID_CONFIG.step) + 1
};

const FORECAST_DAYS = 7;
const APP_TIMEZONE = 'Asia/Ho_Chi_Minh';

function buildGridPoints(config) {
  const points = [];
  for (let lat = config.latMax; lat >= config.latMin; lat -= config.step) {
    for (let lon = config.lonMin; lon <= config.lonMax; lon += config.step) {
      points.push({ lat, lon });
    }
  }
  return points;
}

const CACHE_KEY = 'weatherGridCacheV6';
const CACHE_DURATION_MS = 30 * 60 * 1000;

function getCachedGrid() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    const isExpired = Date.now() - parsed.timestamp > CACHE_DURATION_MS;
    if (isExpired) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed.data;
  } catch (error) {
    console.warn('Không đọc được cache, bỏ qua:', error.message);
    return null;
  }
}

function setCachedGrid(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
  } catch (error) {
    console.warn('Không lưu được cache (dữ liệu có thể quá lớn):', error.message);
  }
}

async function fetchGridData() {
  const cached = getCachedGrid();
  if (cached) {
    console.log('Dùng dữ liệu lưới chính từ cache');
    return cached;
  }

  const points = buildGridPoints(GRID_CONFIG);
  const latList = points.map(p => p.lat).join(',');
  const lonList = points.map(p => p.lon).join(',');

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${latList}` +
    `&longitude=${lonList}` +
    `&hourly=wind_speed_10m,wind_direction_10m,temperature_2m,precipitation,cloud_cover,pressure_msl,uv_index` +
    `&forecast_days=${FORECAST_DAYS}` +
    `&timezone=${encodeURIComponent(APP_TIMEZONE)}`;

  console.log(`Đang gọi API cho ${points.length} điểm lưới chính...`);
  console.log(`Grid: ${GRID_METADATA.rows} hàng × ${GRID_METADATA.cols} cột`);

  const response = await throttledFetch(url);
  if (!response.ok) throw new Error(`Status ${response.status}`);
  const rawData = await response.json();

  setCachedGrid(rawData);
  return rawData;
}

function computeNowHourIndex(rawData) {
  const timeArray = rawData[0] && rawData[0].hourly ? rawData[0].hourly.time : null;
  if (!timeArray || timeArray.length === 0) return 0;

  const now = new Date();
  const pad = function (n) { return String(n).padStart(2, '0'); };
  const nowPrefix = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}`;

  for (let i = 0; i < timeArray.length; i++) {
    if (timeArray[i].slice(0, 13) >= nowPrefix) {
      return i;
    }
  }
  return 0;
}

let gridDataCache = null;
let gridDataPromise = null;
let nowHourIndex = 0;

function ensureGridData() {
  if (gridDataCache) {
    return Promise.resolve(gridDataCache);
  }

  if (!gridDataPromise) {
    gridDataPromise = fetchGridData().then(function (data) {
      gridDataCache = data;
      nowHourIndex = computeNowHourIndex(data);
      return data;
    }).catch(function (error) {
      gridDataPromise = null;
      throw error;
    });
  }

  return gridDataPromise;
}

const SECONDARY_GRID_CONFIG = {
  latMin: -85,
  latMax: 85,
  lonMin: -180,
  lonMax: 180,
  step: 15
};

const SECONDARY_FORECAST_DAYS = FORECAST_DAYS;

function makeSecondaryFetcher(cacheKey, apiBaseUrl, hourlyFields) {
  let dataCache = null;
  let dataPromise = null;
  let nowIndex = 0;

  function getCached() {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      const isExpired = Date.now() - parsed.timestamp > CACHE_DURATION_MS;
      if (isExpired) {
        localStorage.removeItem(cacheKey);
        return null;
      }
      return parsed.data;
    } catch (error) {
      return null;
    }
  }

  function setCached(data) {
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data }));
    } catch (error) {
      console.warn(`Không lưu được cache cho ${cacheKey}:`, error.message);
    }
  }

  async function fetchData() {
    const cached = getCached();
    if (cached) {
      console.log(`Dùng dữ liệu (${cacheKey}) từ cache`);
      dataCache = cached;
      nowIndex = computeNowHourIndex(cached);
      return cached;
    }

    const points = buildGridPoints(SECONDARY_GRID_CONFIG);
    const latList = points.map(p => p.lat).join(',');
    const lonList = points.map(p => p.lon).join(',');

    const url =
      `${apiBaseUrl}` +
      `?latitude=${latList}` +
      `&longitude=${lonList}` +
      `&hourly=${hourlyFields}` +
      `&forecast_days=${SECONDARY_FORECAST_DAYS}` +
      `&timezone=${encodeURIComponent(APP_TIMEZONE)}`;

    console.log(`Đang gọi API phụ (${cacheKey}) cho ${points.length} điểm...`);

    const response = await throttledFetch(url);
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const rawData = await response.json();

    setCached(rawData);
    dataCache = rawData;
    nowIndex = computeNowHourIndex(rawData);
    return rawData;
  }

  function ensure() {
    if (dataCache) return Promise.resolve(dataCache);
    if (!dataPromise) {
      dataPromise = fetchData().catch(function (error) {
        dataPromise = null;
        throw error;
      });
    }
    return dataPromise;
  }

  function getNowIndex() {
    return nowIndex;
  }

  return { ensure, getNowIndex };
}

const airQualityFetcher = makeSecondaryFetcher(
  'airQualityGridCacheV3',
  'https://air-quality-api.open-meteo.com/v1/air-quality',
  'pm2_5'
);

const marineFetcher = makeSecondaryFetcher(
  'marineGridCacheV3', 
  'https://marine-api.open-meteo.com/v1/marine',
  'wave_height'
);

const REGIONAL_TILE_SIZE = 30;
const REGIONAL_STEP = 2;
const REGIONAL_CACHE_DURATION_MS = 30 * 60 * 1000;

const regionalCache = {};

function getTileKeyForLatLon(lat, lon) {
  const normalizedLon = Math.max(GRID_CONFIG.lonMin, Math.min(GRID_CONFIG.lonMax, lon));
  const tileLat = Math.floor(lat / REGIONAL_TILE_SIZE) * REGIONAL_TILE_SIZE;
  const tileLon = Math.floor(normalizedLon / REGIONAL_TILE_SIZE) * REGIONAL_TILE_SIZE;
  return `${tileLat}_${tileLon}`;
}

function getTileBounds(tileKey) {
  const [tileLatStr, tileLonStr] = tileKey.split('_');
  const tileLat = parseFloat(tileLatStr);
  const tileLon = parseFloat(tileLonStr);

  return {
    latMin: Math.max(tileLat, GRID_CONFIG.latMin),
    latMax: Math.min(tileLat + REGIONAL_TILE_SIZE, GRID_CONFIG.latMax),
    lonMin: Math.max(tileLon, GRID_CONFIG.lonMin),
    lonMax: Math.min(tileLon + REGIONAL_TILE_SIZE, GRID_CONFIG.lonMax),
    step: REGIONAL_STEP
  };
}

function fetchRegionalTileData(tileKey) {
  const now = Date.now();
  const cached = regionalCache[tileKey];

  if (cached && cached.data && (now - cached.timestamp < REGIONAL_CACHE_DURATION_MS)) {
    return Promise.resolve(cached.data);
  }
  if (cached && cached.promise) {
    return cached.promise;
  }

  const bounds = getTileBounds(tileKey);
  const points = buildGridPoints(bounds);
  const latList = points.map(p => p.lat).join(',');
  const lonList = points.map(p => p.lon).join(',');

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${latList}` +
    `&longitude=${lonList}` +
    `&hourly=temperature_2m,precipitation,cloud_cover` +
    `&forecast_days=${FORECAST_DAYS}` +
    `&timezone=${encodeURIComponent(APP_TIMEZONE)}`;

  console.log(`Đang tải chi tiết khu vực (ô ${tileKey}, ${points.length} điểm)...`);

  const promise = throttledFetch(url)
    .then(function (response) {
      if (!response.ok) throw new Error(`Status ${response.status}`);
      return response.json();
    })
    .then(function (data) {
      regionalCache[tileKey] = { data: data, timestamp: Date.now() };
      return data;
    })
    .catch(function (error) {
      delete regionalCache[tileKey];
      throw error;
    });

  regionalCache[tileKey] = { promise: promise, timestamp: now };
  return promise;
}