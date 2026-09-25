/* ======================================================
   FILE: layers.js
   Chức năng: Gió, Nhiệt độ, Mưa, Mây, Áp suất, UV, Kh.khí, Sóng,
              Legend, Gió nền, Regional layer, Isobar
   ====================================================== */

function speedDirectionToUV(speed, direction) {
  const rad = (direction * Math.PI) / 180;
  return {
    u: -speed * Math.sin(rad),
    v: -speed * Math.cos(rad)
  };
}

function buildWindVelocityData(rawData, hourIndex) {
  const nx = Math.round((GRID_CONFIG.lonMax - GRID_CONFIG.lonMin) / GRID_CONFIG.step) + 1;
  const ny = Math.round((GRID_CONFIG.latMax - GRID_CONFIG.latMin) / GRID_CONFIG.step) + 1;

  const uData = [];
  const vData = [];

  const safeHourIndex = Math.max(0, Number.isFinite(hourIndex) ? hourIndex : 0);

  rawData.forEach(function (point) {
    const speedArr = point && point.hourly ? point.hourly.wind_speed_10m : null;
    const dirArr = point && point.hourly ? point.hourly.wind_direction_10m : null;

    if (
      !speedArr || !dirArr ||
      speedArr[safeHourIndex] === undefined || speedArr[safeHourIndex] === null ||
      dirArr[safeHourIndex] === undefined || dirArr[safeHourIndex] === null
    ) {
      uData.push(0);
      vData.push(0);
      return;
    }

    const speed = Number(speedArr[safeHourIndex]);
    const direction = Number(dirArr[safeHourIndex]);

    if (!Number.isFinite(speed) || !Number.isFinite(direction)) {
      uData.push(0);
      vData.push(0);
      return;
    }

    const { u, v } = speedDirectionToUV(speed, direction);

    // Open-Meteo trả wind speed theo km/h, header khai báo m/s -> quy đổi /3.6
    uData.push(u / 3.6);
    vData.push(v / 3.6);
  });

  const header = {
    parameterUnit: "m.s-1",
    parameterNumberName: "Wind",
    la1: GRID_CONFIG.latMax,
    lo1: GRID_CONFIG.lonMin,
    la2: GRID_CONFIG.latMin,
    lo2: GRID_CONFIG.lonMax,
    dx: GRID_CONFIG.step,
    dy: GRID_CONFIG.step,
    nx: nx,
    ny: ny
  };

  return [
    { header: { ...header, parameterCategory: 2, parameterNumber: 2 }, data: uData },
    { header: { ...header, parameterCategory: 2, parameterNumber: 3 }, data: vData }
  ];
}

function buildValueGrid(rawData, fieldName, hourIndex, gridConfig) {
  const nx = Math.round((gridConfig.lonMax - gridConfig.lonMin) / gridConfig.step) + 1;
  const ny = Math.round((gridConfig.latMax - gridConfig.latMin) / gridConfig.step) + 1;

  const grid = [];
  let idx = 0;

  const safeRawData = Array.isArray(rawData) ? rawData : [];

  for (let i = 0; i < ny; i++) {
    const row = [];
    for (let j = 0; j < nx; j++) {
      const point = safeRawData[idx];
      let value = 0;
      const arr = point && point.hourly ? point.hourly[fieldName] : null;

      if (Array.isArray(arr) && arr.length > 0) {
        const safeIndex = Math.max(0, Math.min(arr.length - 1, Number.isFinite(hourIndex) ? hourIndex : 0));
        const candidate = Number(arr[safeIndex]);
        if (Number.isFinite(candidate)) {
          value = candidate;
        }
      }

      row.push(value);
      idx++;
    }
    grid.push(row);
  }

  return { grid, nx, ny };
}

function bilinearSample(grid, nx, ny, latIdxFloat, lonIdxFloat) {
  if (!grid || nx <= 0 || ny <= 0) return 0;

  const safeLat = Math.max(0, Math.min(ny - 1, latIdxFloat));
  const safeLon = Math.max(0, Math.min(nx - 1, lonIdxFloat));

  const i0 = Math.floor(safeLat);
  const i1 = Math.min(ny - 1, i0 + 1);
  const j0 = Math.floor(safeLon);
  const j1 = Math.min(nx - 1, j0 + 1);

  const fy = safeLat - i0;
  const fx = safeLon - j0;

  const v00 = Number(grid[i0][j0]) || 0;
  const v01 = Number(grid[i0][j1]) || 0;
  const v10 = Number(grid[i1][j0]) || 0;
  const v11 = Number(grid[i1][j1]) || 0;

  const top = v00 * (1 - fx) + v01 * fx;
  const bottom = v10 * (1 - fx) + v11 * fx;

  return top * (1 - fy) + bottom * fy;
}

function colorFromStops(value, stops) {
  if (!stops || stops.length === 0) return [0, 0, 0, 0];
  if (value <= stops[0].value) return stops[0].color;

  for (let k = 0; k < stops.length - 1; k++) {
    const a = stops[k];
    const b = stops[k + 1];

    if (value >= a.value && value <= b.value) {
      const range = b.value - a.value;
      const t = range === 0 ? 0 : (value - a.value) / range;

      return [
        a.color[0] + (b.color[0] - a.color[0]) * t,
        a.color[1] + (b.color[1] - a.color[1]) * t,
        a.color[2] + (b.color[2] - a.color[2]) * t,
        a.color[3] + (b.color[3] - a.color[3]) * t
      ];
    }
  }

  return stops[stops.length - 1].color;
}

const WIND_STOPS = [
  { value: 0, color: [98, 113, 183, 255] },
  { value: 3.6, color: [57, 97, 159, 255] },
  { value: 10.8, color: [74, 148, 169, 255] },
  { value: 18, color: [77, 141, 123, 255] },
  { value: 25.2, color: [83, 165, 83, 255] },
  { value: 32.4, color: [53, 159, 53, 255] },
  { value: 39.6, color: [167, 157, 81, 255] },
  { value: 46.8, color: [159, 127, 58, 255] },
  { value: 54, color: [161, 108, 92, 255] },
  { value: 61.2, color: [129, 58, 78, 255] },
  { value: 68.4, color: [175, 80, 136, 255] },
  { value: 75.6, color: [117, 74, 147, 255] },
  { value: 86.4, color: [109, 97, 163, 255] },
  { value: 97.2, color: [68, 105, 141, 255] },
  { value: 104.4, color: [92, 144, 152, 255] },
  { value: 129.6, color: [125, 68, 165, 255] },
  { value: 165.6, color: [231, 215, 215, 255] },
  { value: 183.6, color: [219, 212, 135, 255] },
  { value: 277.2, color: [205, 202, 112, 255] },
  { value: 374.4, color: [128, 128, 128, 255] }
];

const TEMP_STOPS = [
  { value: -70.2, color: [115, 70, 105, 255] },
  { value: -55.2, color: [202, 172, 195, 255] },
  { value: -40.2, color: [162, 70, 145, 255] },
  { value: -25.2, color: [143, 89, 169, 255] },
  { value: -15.2, color: [157, 219, 217, 255] },
  { value: -8.2, color: [106, 191, 181, 255] },
  { value: -4.2, color: [100, 166, 189, 255] },
  { value: 0, color: [93, 133, 198, 255] },
  { value: 5, color: [80, 170, 150, 255] },
  { value: 10, color: [110, 190, 90, 255] },
  { value: 15, color: [190, 210, 60, 255] },
  { value: 20, color: [250, 210, 20, 255] },
  { value: 25, color: [250, 150, 20, 255] },
  { value: 30, color: [230, 80, 20, 255] },
  { value: 35, color: [200, 30, 20, 255] },
  { value: 40, color: [140, 15, 10, 255] },
  { value: 46.9, color: [71, 14, 0, 255] }
];

const RAIN_STOPS = [
  { value: 0, color: [111, 111, 111, 255] },
  { value: 0.6, color: [60, 116, 160, 255] },
  { value: 6, color: [59, 161, 161, 255] },
  { value: 8, color: [59, 161, 61, 255] },
  { value: 10, color: [130, 161, 59, 255] },
  { value: 15, color: [161, 161, 59, 255] },
  { value: 20, color: [161, 59, 59, 255] },
  { value: 31, color: [161, 59, 161, 255] },
  { value: 50, color: [168, 168, 168, 255] }
];

const CLOUD_STOPS = [
  { value: 0, color: [255, 255, 255, 0] },
  { value: 50, color: [255, 255, 255, 110] },
  { value: 100, color: [255, 255, 255, 190] }
];

const PRESSURE_STOPS = [
  { value: 900, color: [8, 16, 48, 255] },
  { value: 950, color: [0, 32, 96, 255] },
  { value: 976, color: [0, 52, 146, 255] },
  { value: 986, color: [0, 90, 148, 255] },
  { value: 995, color: [0, 117, 146, 255] },
  { value: 1002, color: [26, 140, 147, 255] },
  { value: 1007, color: [103, 162, 155, 255] },
  { value: 1011.25, color: [155, 183, 172, 255] },
  { value: 1013.25, color: [182, 182, 182, 255] },
  { value: 1015.25, color: [176, 174, 152, 255] },
  { value: 1019, color: [167, 147, 107, 255] },
  { value: 1024, color: [163, 116, 67, 255] },
  { value: 1030, color: [159, 81, 44, 255] },
  { value: 1038, color: [142, 47, 57, 255] },
  { value: 1046, color: [111, 24, 64, 255] },
  { value: 1080, color: [48, 8, 24, 255] }
];

const UV_STOPS = [
  { value: 0, color: [110, 110, 110, 255] },
  { value: 2, color: [61, 167, 46, 255] },
  { value: 5, color: [255, 243, 0, 255] },
  { value: 7, color: [241, 139, 1, 255] },
  { value: 10, color: [229, 50, 17, 255] },
  { value: 11, color: [181, 103, 164, 255] },
  { value: 19, color: [255, 255, 255, 255] }
];

const AIR_QUALITY_STOPS = [
  { value: 0, color: [0, 102, 151, 255] },
  { value: 10, color: [125, 182, 209, 255] },
  { value: 15, color: [170, 183, 189, 255] },
  { value: 25, color: [194, 195, 125, 255] },
  { value: 150, color: [232, 83, 25, 255] },
  { value: 200, color: [189, 52, 19, 255] },
  { value: 300, color: [75, 12, 0, 255] }
];

const WAVE_STOPS = [
  { value: 0, color: [159, 185, 191, 255] },
  { value: 0.5, color: [48, 157, 185, 255] },
  { value: 1, color: [48, 98, 141, 255] },
  { value: 1.5, color: [56, 104, 191, 255] },
  { value: 2, color: [57, 60, 142, 255] },
  { value: 2.5, color: [187, 90, 191, 255] },
  { value: 3, color: [154, 48, 151, 255] },
  { value: 4, color: [133, 48, 48, 255] },
  { value: 5, color: [191, 51, 95, 255] },
  { value: 7, color: [191, 103, 87, 255] },
  { value: 10, color: [191, 191, 191, 255] }
];

function latToMercatorY(latDeg) {
  const safeLat = Math.max(-85.05112878, Math.min(85.05112878, latDeg));
  const latRad = (safeLat * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + latRad / 2));
}

function mercatorYToLat(mercY) {
  return ((2 * Math.atan(Math.exp(mercY)) - Math.PI / 2) * 180) / Math.PI;
}

function getMercatorCanvasSize(gridConfig, baseWidth) {
  const xRange = gridConfig.lonMax - gridConfig.lonMin;
  const mercTop = latToMercatorY(gridConfig.latMax);
  const mercBottom = latToMercatorY(gridConfig.latMin);
  const mercRange = Math.abs(mercTop - mercBottom);

  const aspect = mercRange / (xRange * Math.PI / 180);

  const width = Math.max(256, Math.round(baseWidth));
  const height = Math.max(256, Math.round(width * aspect));

  return { width, height };
}

function buildScalarCanvasDataUrl(grid, nx, ny, gridConfig, stops, baseWidth = 720) {
  const canvasSize = getMercatorCanvasSize(gridConfig, baseWidth);

  const canvas = document.createElement('canvas');
  canvas.width = canvasSize.width;
  canvas.height = canvasSize.height;

  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(canvas.width, canvas.height);

  const mercYTop = latToMercatorY(gridConfig.latMax);
  const mercYBottom = latToMercatorY(gridConfig.latMin);
  const mercRange = mercYTop - mercYBottom;
  const lonRange = gridConfig.lonMax - gridConfig.lonMin;

  for (let py = 0; py < canvas.height; py++) {
    const mercY = mercYTop - (py / (canvas.height - 1)) * mercRange;
    const lat = mercatorYToLat(mercY);
    const latIdxFloat = (gridConfig.latMax - lat) / gridConfig.step;

    for (let px = 0; px < canvas.width; px++) {
      const lon = gridConfig.lonMin + (px / (canvas.width - 1)) * lonRange;
      const lonIdxFloat = (lon - gridConfig.lonMin) / gridConfig.step;

      const value = bilinearSample(grid, nx, ny, latIdxFloat, lonIdxFloat);
      const color = colorFromStops(value, stops);

      const offset = (py * canvas.width + px) * 4;
      imageData.data[offset] = Math.round(color[0]);
      imageData.data[offset + 1] = Math.round(color[1]);
      imageData.data[offset + 2] = Math.round(color[2]);
      imageData.data[offset + 3] = Math.round(color[3]);
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

let currentDataLayer = null;
let backgroundWindLayer = null;
let isobarDataLayer = null;

function clearAllOverlayLayers() {
  if (currentDataLayer) {
    map.removeLayer(currentDataLayer);
    currentDataLayer = null;
  }
  if (backgroundWindLayer) {
    map.removeLayer(backgroundWindLayer);
    backgroundWindLayer = null;
  }
  if (isobarDataLayer) {
    map.removeLayer(isobarDataLayer);
    isobarDataLayer = null;
  }
}

function marchingSquaresSegments(grid, ny, nx, threshold) {
  const segments = [];

  function interp(v1, v2, idx1, idx2) {
    if (v1 === v2) return (idx1 + idx2) / 2;
    const t = (threshold - v1) / (v2 - v1);
    return idx1 + t * (idx2 - idx1);
  }

  for (let i = 0; i < ny - 1; i++) {
    for (let j = 0; j < nx - 1; j++) {
      const tl = Number(grid[i][j]) || 0;
      const tr = Number(grid[i][j + 1]) || 0;
      const bl = Number(grid[i + 1][j]) || 0;
      const br = Number(grid[i + 1][j + 1]) || 0;

      let caseIndex = 0;
      if (tl >= threshold) caseIndex |= 8;
      if (tr >= threshold) caseIndex |= 4;
      if (br >= threshold) caseIndex |= 2;
      if (bl >= threshold) caseIndex |= 1;

      if (caseIndex === 0 || caseIndex === 15) continue;

      const topPt = [i, interp(tl, tr, j, j + 1)];
      const rightPt = [interp(tr, br, i, i + 1), j + 1];
      const bottomPt = [i + 1, interp(bl, br, j, j + 1)];
      const leftPt = [interp(tl, bl, i, i + 1), j];

      switch (caseIndex) {
        case 1: segments.push([leftPt, bottomPt]); break;
        case 2: segments.push([bottomPt, rightPt]); break;
        case 3: segments.push([leftPt, rightPt]); break;
        case 4: segments.push([topPt, rightPt]); break;
        case 5: segments.push([leftPt, topPt], [bottomPt, rightPt]); break;
        case 6: segments.push([topPt, bottomPt]); break;
        case 7: segments.push([leftPt, topPt]); break;
        case 8: segments.push([leftPt, topPt]); break;
        case 9: segments.push([topPt, bottomPt]); break;
        case 10: segments.push([topPt, rightPt], [leftPt, bottomPt]); break;
        case 11: segments.push([topPt, rightPt]); break;
        case 12: segments.push([leftPt, rightPt]); break;
        case 13: segments.push([bottomPt, rightPt]); break;
        case 14: segments.push([leftPt, bottomPt]); break;
      }
    }
  }

  return segments;
}

function gridIndexToLatLon(rowIdx, colIdx, gridConfig) {
  const lat = gridConfig.latMax - rowIdx * gridConfig.step;
  const lon = gridConfig.lonMin + colIdx * gridConfig.step;
  return [lat, lon];
}

function buildIsobarLayer(rawData, hourIndex) {
  const { grid, nx, ny } = buildValueGrid(rawData, 'pressure_msl', hourIndex, GRID_CONFIG);

  const thresholds = [];
  for (let p = 972; p <= 1048; p += 4) {
    thresholds.push(p);
  }

  const group = L.layerGroup();

  thresholds.forEach(function (threshold) {
    const segments = marchingSquaresSegments(grid, ny, nx, threshold);

    segments.forEach(function (segment) {
      const [pt1, pt2] = segment;
      const latlng1 = gridIndexToLatLon(pt1[0], pt1[1], GRID_CONFIG);
      const latlng2 = gridIndexToLatLon(pt2[0], pt2[1], GRID_CONFIG);

      [-360, 0, 360].forEach(function (offset) {
        L.polyline(
          [
            [latlng1[0], latlng1[1] + offset],
            [latlng2[0], latlng2[1] + offset]
          ],
          {
            color: 'rgba(255,255,255,0.55)',
            weight: threshold % 20 === 0 ? 1.5 : 0.8,
            interactive: false
          }
        ).addTo(group);
      });
    });
  });

  return group;
}

function addWrappedOverlay(dataUrl, bounds, opacity) {
  const group = L.layerGroup();
  [-360, 0, 360].forEach(function (offset) {
    const shiftedBounds = [
      [bounds[0][0], bounds[0][1] + offset],
      [bounds[1][0], bounds[1][1] + offset]
    ];
    L.imageOverlay(dataUrl, shiftedBounds, {
      opacity: opacity,
      interactive: false,
      className: 'scalar-layer-img'
    }).addTo(group);
  });
  return group;
}

function renderScalarLayer(rawData, fieldName, stops, hourIndex, gridConfig) {
  if (!rawData || !Array.isArray(rawData)) {
    console.warn('Không có dữ liệu cho layer:', fieldName);
    return;
  }

  const { grid, nx, ny } = buildValueGrid(rawData, fieldName, hourIndex, gridConfig);
  const dataUrl = buildScalarCanvasDataUrl(grid, nx, ny, gridConfig, stops, 720);

  const bounds = [
    [gridConfig.latMin, gridConfig.lonMin],
    [gridConfig.latMax, gridConfig.lonMax]
  ];

  currentDataLayer = addWrappedOverlay(dataUrl, bounds, 0.65);
  currentDataLayer.addTo(map);
}

function showWindLayer(rawData, hourIndex) {
  const windData = buildWindVelocityData(rawData, hourIndex);

  currentDataLayer = L.velocityLayer({
    displayValues: true,
    displayOptions: {
      velocityType: 'Gió',
      position: 'bottomleft',
      emptyString: 'Không có dữ liệu gió',
      angleConvention: 'bearingCW',
      speedUnit: 'km/h'
    },
    data: windData,
    minVelocity: 0,
    maxVelocity: 15,
    velocityScale: 0.005,
    colorScale: [
      '#6271B7', '#39619F', '#4A94A9', '#4D8D7B', '#53A553',
      '#359F35', '#A79D51', '#9F7F3A', '#A16C5C', '#813A4E',
      '#AF5088', '#754A93', '#6D61A3', '#44698D', '#5C9098',
      '#7D44A5', '#E7D7D7', '#DBD487', '#CDCA70', '#808080'
    ]
  });

  currentDataLayer.addTo(map);
}

function buildSubtleWindLayer(rawData, hourIndex) {
  const windData = buildWindVelocityData(rawData, hourIndex);

  return L.velocityLayer({
    displayValues: false,
    data: windData,
    minVelocity: 0,
    maxVelocity: 15,
    velocityScale: 0.004,
    particleMultiplier: 1 / 1200,
    lineWidth: 1,
    colorScale: ['rgba(255,255,255,0.35)'],
    pane: 'windOverlayPane'
  });
}

const REGIONAL_MIN_ZOOM = 4;

const SCALAR_LAYER_INFO = {
  temp: { field: 'temperature_2m', stops: TEMP_STOPS, source: 'main' },
  rain: { field: 'precipitation', stops: RAIN_STOPS, source: 'main' },
  clouds: { field: 'cloud_cover', stops: CLOUD_STOPS, source: 'main' },
  pressure: { field: 'pressure_msl', stops: PRESSURE_STOPS, source: 'main' },
  uv: { field: 'uv_index', stops: UV_STOPS, source: 'main' },
  airquality: { field: 'pm2_5', stops: AIR_QUALITY_STOPS, source: 'airquality' },
  waves: { field: 'wave_height', stops: WAVE_STOPS, source: 'marine' }
};

const REGIONAL_ENABLED_LAYERS = ['temp', 'rain', 'clouds'];

let regionalDataLayer = null;
let regionalRequestToken = 0;

function clearRegionalLayer() {
  if (regionalDataLayer) {
    map.removeLayer(regionalDataLayer);
    regionalDataLayer = null;
  }
}

async function updateRegionalLayer() {
  if (!REGIONAL_ENABLED_LAYERS.includes(currentLayerName)) {
    clearRegionalLayer();
    return;
  }

  const layerInfo = SCALAR_LAYER_INFO[currentLayerName];

  if (!layerInfo || map.getZoom() < REGIONAL_MIN_ZOOM) {
    clearRegionalLayer();
    return;
  }

  const center = map.getCenter();
  const normalizedLon = normalizeLongitude(center.lng);
  const tileKey = getTileKeyForLatLon(center.lat, normalizedLon);

  const myToken = ++regionalRequestToken;

  try {
    const rawRegional = await fetchRegionalTileData(tileKey);
    if (myToken !== regionalRequestToken) return;

    const tileBounds = getTileBounds(tileKey);

    let hourIndex = nowHourIndex + currentHourOffset;

    const firstPoint = rawRegional && rawRegional[0];
    if (firstPoint && firstPoint.hourly && Array.isArray(firstPoint.hourly[layerInfo.field])) {
      const maxIndex = firstPoint.hourly[layerInfo.field].length - 1;
      hourIndex = Math.max(0, Math.min(maxIndex, hourIndex));
    }

    const { grid, nx, ny } = buildValueGrid(rawRegional, layerInfo.field, hourIndex, tileBounds);
    const dataUrl = buildScalarCanvasDataUrl(grid, nx, ny, tileBounds, layerInfo.stops, 480);

    clearRegionalLayer();

    const bounds = [
      [tileBounds.latMin, tileBounds.lonMin],
      [tileBounds.latMax, tileBounds.lonMax]
    ];

    regionalDataLayer = addWrappedOverlay(dataUrl, bounds, 0.65);

    regionalDataLayer.addTo(map);
  } catch (error) {
    console.error('Lỗi khi tải chi tiết khu vực:', error.message);
  }
}

let regionalUpdateTimer = null;
map.on('moveend zoomend', function () {
  clearTimeout(regionalUpdateTimer);
  regionalUpdateTimer = setTimeout(updateRegionalLayer, 500);
});

function rgbaCss(color) {
  return `rgba(${Math.round(color[0])}, ${Math.round(color[1])}, ${Math.round(color[2])}, ${(color[3] / 255).toFixed(2)})`;
}

function buildGradientCss(stops) {
  const minVal = stops[0].value;
  const maxVal = stops[stops.length - 1].value;
  const range = maxVal - minVal;

  const parts = stops.map(function (stop) {
    const percent = range === 0 ? 0 : ((stop.value - minVal) / range) * 100;
    return `${rgbaCss(stop.color)} ${percent}%`;
  });

  return `linear-gradient(to right, ${parts.join(', ')})`;
}

const LEGEND_CONFIG = {
  wind: { title: 'Tốc độ gió (km/h)', stops: WIND_STOPS },
  temp: { title: 'Nhiệt độ (°C)', stops: TEMP_STOPS },
  rain: { title: 'Lượng mưa (mm)', stops: RAIN_STOPS },
  clouds: { title: 'Độ phủ mây (%)', stops: CLOUD_STOPS },
  pressure: { title: 'Áp suất (hPa)', stops: PRESSURE_STOPS },
  uv: { title: 'Chỉ số UV', stops: UV_STOPS },
  airquality: { title: 'PM2.5 (μg/m³)', stops: AIR_QUALITY_STOPS },
  waves: { title: 'Độ cao sóng (m)', stops: WAVE_STOPS }
};

const legendTitleEl = document.getElementById('legend-title');
const legendGradientEl = document.getElementById('legend-gradient');
const legendMinEl = document.getElementById('legend-min');
const legendMaxEl = document.getElementById('legend-max');

function renderLegend(layerName) {
  const config = LEGEND_CONFIG[layerName];
  if (!config) return;

  legendTitleEl.textContent = config.title;
  legendGradientEl.style.background = buildGradientCss(config.stops);

  const minVal = config.stops[0].value;
  const maxVal = config.stops[config.stops.length - 1].value;

  legendMinEl.textContent = Math.round(minVal * 10) / 10;
  legendMaxEl.textContent = layerName === 'wind' ? `${Math.round(maxVal)}+` : Math.round(maxVal * 10) / 10;
}

let currentLayerName = 'wind';
let currentHourOffset = 0;
let latestRequestToken = 0;

async function showLayer(layerName, hourOffset) {
  hourOffset = hourOffset || 0;
  const myToken = ++latestRequestToken;

  try {
    clearAllOverlayLayers();

    if (layerName === 'wind') {
      const rawData = await ensureGridData();
      if (myToken !== latestRequestToken) return;

      const hourIndex = nowHourIndex + hourOffset;
      showWindLayer(rawData, hourIndex);

    } else {
      const layerInfo = SCALAR_LAYER_INFO[layerName];

      if (!layerInfo) {
        console.warn('Layer không tồn tại:', layerName);
        return;
      }

      let rawData;
      let gridConfig;
      let hourIndexForThisLayer;

      if (layerInfo.source === 'main') {
        rawData = await ensureGridData();
        gridConfig = GRID_CONFIG;
        hourIndexForThisLayer = nowHourIndex + hourOffset;
      } else if (layerInfo.source === 'airquality') {
        rawData = await airQualityFetcher.ensure();
        gridConfig = SECONDARY_GRID_CONFIG;
        hourIndexForThisLayer = airQualityFetcher.getNowIndex() + hourOffset;
      } else if (layerInfo.source === 'marine') {
        rawData = await marineFetcher.ensure();
        gridConfig = SECONDARY_GRID_CONFIG;
        hourIndexForThisLayer = marineFetcher.getNowIndex() + hourOffset;
      }

      if (myToken !== latestRequestToken) return;

      renderScalarLayer(rawData, layerInfo.field, layerInfo.stops, hourIndexForThisLayer, gridConfig);

      if (layerName === 'pressure') {
        isobarDataLayer = buildIsobarLayer(rawData, hourIndexForThisLayer);
        isobarDataLayer.addTo(map);
      }

      const mainRawData = await ensureGridData();
      if (myToken !== latestRequestToken) return;

      const mainHourIndex = nowHourIndex + hourOffset;
      backgroundWindLayer = buildSubtleWindLayer(mainRawData, mainHourIndex);
      backgroundWindLayer.addTo(map);
    }

    renderLegend(layerName);
    currentLayerName = layerName;
    currentHourOffset = hourOffset;

    updateRegionalLayer();
  } catch (error) {
    console.error('Lỗi khi tải lớp dữ liệu:', error.message);
  }
}

showLayer('wind', 0);

const layerButtons = document.querySelectorAll('.layer-btn');

layerButtons.forEach(function (button) {
  button.addEventListener('click', function () {
    layerButtons.forEach(function (btn) {
      btn.classList.remove('active');
    });
    button.classList.add('active');

    const selectedLayer = button.getAttribute('data-layer');
    showLayer(selectedLayer, currentHourOffset);
  });
});