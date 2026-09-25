/* ======================================================
   FILE: search.js
   Chức năng: thanh tìm kiếm địa điểm
   ====================================================== */

const searchInput = document.getElementById('search-input');
const searchSuggestions = document.getElementById('search-suggestions');
let searchDebounceTimer = null;

async function searchPlaces(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=vi&format=json`;

  const response = await throttledFetch(url, undefined, 'high');
  if (!response.ok) return []; 
  const data = await response.json();
  return data.results || [];
}

function renderSuggestions(results) {
  if (results.length === 0) {
    searchSuggestions.style.display = 'none';
    searchSuggestions.innerHTML = '';
    return;
  }

  searchSuggestions.innerHTML = results.map(function (place) {
    const subLabel = [place.admin1, place.country].filter(Boolean).join(', ');
    return `
      <div class="suggestion-item" data-lat="${place.latitude}" data-lon="${place.longitude}" data-name="${place.name}">
        ${place.name}
        <div class="suggestion-sub">${subLabel}</div>
      </div>
    `;
  }).join('');

  searchSuggestions.style.display = 'block';

  document.querySelectorAll('.suggestion-item').forEach(function (item) {
    item.addEventListener('click', function () {
      const lat = parseFloat(item.getAttribute('data-lat'));
      const lon = parseFloat(item.getAttribute('data-lon'));
      const name = item.getAttribute('data-name');

      map.flyTo([lat, lon], 10);
      selectPointOnMap(lat, lon, name);

      searchSuggestions.style.display = 'none';
      searchInput.value = name;
    });
  });
}

searchInput.addEventListener('input', function () {
  clearTimeout(searchDebounceTimer);
  const query = searchInput.value.trim();

  if (query.length < 2) {
    searchSuggestions.style.display = 'none';
    return;
  }

  searchDebounceTimer = setTimeout(async function () {
    try {
      const results = await searchPlaces(query);
      renderSuggestions(results);
    } catch (error) {
      console.warn('Lỗi tìm kiếm địa điểm:', error.message);
    }
  }, 400);
});

document.addEventListener('click', function (e) {
  if (!e.target.closest('#search-bar')) {
    searchSuggestions.style.display = 'none';
  }
});