/* =============================================
   Weather Dashboard App — app.js
   Uses Open-Meteo (free, no API key needed)
   + Nominatim reverse geocoding
   ============================================= */

// ── Weather code → icon & description ──────────
const WMO_MAP = {
  0:  { icon: '☀️',  desc: 'はれ' },
  1:  { icon: '🌤️', desc: 'はれ' },
  2:  { icon: '⛅',  desc: 'くもりがち' },
  3:  { icon: '☁️',  desc: 'くもり' },
  45: { icon: '🌫️', desc: 'きり' },
  48: { icon: '🌫️', desc: 'きり' },
  51: { icon: '🌦️', desc: 'かささがり' },
  53: { icon: '🌦️', desc: 'かささがり' },
  55: { icon: '🌦️', desc: 'かささがり' },
  61: { icon: '🌧️', desc: 'あめ' },
  63: { icon: '🌧️', desc: 'あめ' },
  65: { icon: '🌧️', desc: 'あめ' },
  71: { icon: '🌨️', desc: 'ゆき' },
  73: { icon: '🌨️', desc: 'ゆき' },
  75: { icon: '❄️',  desc: 'おおゆき' },
  80: { icon: '🌦️', desc: 'にわかあめ' },
  81: { icon: '🌦️', desc: 'にわかあめ' },
  82: { icon: '⛈️',  desc: 'にわかあめ' },
  95: { icon: '⛈️',  desc: 'らいう' },
  96: { icon: '⛈️',  desc: 'らいう' },
  99: { icon: '⛈️',  desc: 'らいう' },
};

function wmo(code) {
  return WMO_MAP[code] ?? { icon: '🌡️', desc: '不明' };
}

// ── Humidity → bar color gradient ──────────────
function humColor(pct) {
  if (pct < 40) return 'linear-gradient(180deg, #fbbf24, #f97316)';
  if (pct < 60) return 'linear-gradient(180deg, #34d399, #059669)';
  if (pct < 80) return 'linear-gradient(180deg, #22d3ee, #0891b2)';
  return         'linear-gradient(180deg, #818cf8, #6366f1)';
}

// ── Day-of-week in Japanese ─────────────────────
const JP_DAY = ['日', '月', '火', '水', '木', '金', '土'];
function jpDay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return JP_DAY[d.getDay()];
}
function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}がつ${d.getDate()}にち（${jpDay(dateStr)}）`;
}

function getLocalDateISO(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

// ── Formats ────────────────────────────────────
function fmtTime(isoStr) {
  const d = new Date(isoStr);
  return `${String(d.getHours()).padStart(2, '0')}:00`;
}

function round1(n) { return Math.round(n * 10) / 10; }

// ── State ──────────────────────────────────────
let weatherData = null;
let selectedDayIndex = null;

// ── Entry point ────────────────────────────────
async function loadWeather() {
  showState('loading');
  const btn = document.getElementById('refresh-btn');
  btn.classList.add('spinning');

  try {
    const pos = await getPosition();
    const { latitude: lat, longitude: lon } = pos.coords;

    const [weather, locationName] = await Promise.all([
      fetchWeather(lat, lon),
      reverseGeocode(lat, lon),
    ]);

    weatherData = weather;
    document.getElementById('location-text').textContent = locationName;
    renderDashboard(weather);
    showState('main');

    const now = new Date();
    document.getElementById('last-updated').textContent =
      `最終更新: ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
  } catch (err) {
    console.error(err);
    document.getElementById('error-message').textContent =
      err.message || '天気データの取得に失敗しました';
    showState('error');
  } finally {
    btn.classList.remove('spinning');
  }
}

// ── Geolocation ────────────────────────────────
function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('このブラウザは位置情報に対応していません'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (err) => {
      let msg = '位置情報へのアクセスが拒否されました';
      if (err.code === err.TIMEOUT)        msg = '位置情報の取得がタイムアウトしました';
      if (err.code === err.POSITION_UNAVAILABLE) msg = '位置情報を取得できません';
      reject(new Error(msg));
    }, { timeout: 10000 });
  });
}

// ── Open-Meteo fetch ───────────────────────────
async function fetchWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    timezone: 'auto',
    forecast_days: 3,
    current: [
      'temperature_2m',
      'relative_humidity_2m',
      'weather_code',
      'wind_speed_10m',
      'precipitation',
    ].join(','),
    hourly: [
      'temperature_2m',
      'relative_humidity_2m',
      'weather_code',
      'precipitation',
    ].join(','),
    daily: [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'uv_index_max',
      'relative_humidity_2m_max',
      'relative_humidity_2m_min',
    ].join(','),
  });

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`APIエラー: ${res.status}`);
  return res.json();
}

// ── Nominatim reverse geocode ──────────────────
async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=ja`,
      { headers: { 'User-Agent': 'WeatherDashboard/1.0' } }
    );
    if (!res.ok) throw new Error();
    const data = await res.json();
    const a = data.address;
    return a.city || a.town || a.village || a.county || a.state || data.display_name.split(',')[0];
  } catch {
    return '現在地';
  }
}

// ── Render ─────────────────────────────────────
function renderDashboard(d) {
  selectedDayIndex = null;
  renderToday(d, selectedDayIndex);
  renderClothingRecommendation(d);
  renderHourly(d);
  renderForecast(d);
  renderHumidityChart(d);
}

function getClothingRecommendation(cur, daily) {
  const temp = Math.round(cur.temperature_2m);
  const rainCodes = [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99];
  const precipitation = (daily.precipitation_sum?.[0] ?? 0);
  const needsRainGear = rainCodes.includes(cur.weather_code) || precipitation >= 1;

  const top = temp >= 25 ? { icon: '👕', label: 'はんそで' }
    : temp >= 20 ? { icon: '👚', label: 'うすでのながそで' }
    : temp >= 15 ? { icon: '👕', label: 'ながそで' }
    : temp >= 10 ? { icon: '🧶', label: 'あつでのながそで' }
    : { icon: '🧥', label: 'ぼうかんじゅうし' };

  const bottom = temp >= 24 ? { icon: '🩳', label: 'たんパン' }
    : { icon: '👖', label: 'ながズボン' };

  const outer = (temp < 18 || needsRainGear)
    ? { icon: '🧥', label: 'うわぎひつよう' }
    : { icon: '🧥', label: 'うわぎふよう' };

  const rain = needsRainGear
    ? { icon: '☔', label: 'あまぐあり' }
    : { icon: '☂️', label: 'あまぐふよう' };

  return { top, bottom, outer, rain };
}

function renderClothingRecommendation(d) {
  const cur = d.current;
  const daily = d.daily;
  const rec = getClothingRecommendation(cur, daily);

  document.getElementById('wardrobe-top-icon').textContent = rec.top.icon;
  document.getElementById('wardrobe-top-text').textContent = rec.top.label;
  document.getElementById('wardrobe-bottom-icon').textContent = rec.bottom.icon;
  document.getElementById('wardrobe-bottom-text').textContent = rec.bottom.label;
  document.getElementById('wardrobe-outer-icon').textContent = rec.outer.icon;
  document.getElementById('wardrobe-outer-text').textContent = rec.outer.label;
  document.getElementById('wardrobe-rain-icon').textContent = rec.rain.icon;
  document.getElementById('wardrobe-rain-text').textContent = rec.rain.label;
}

// ── Today hero ─────────────────────────────────
function renderToday(d, dayIndex = null) {
  const daily = d.daily;
  const isToday = dayIndex === null || dayIndex === 0;
  const selectedIndex = dayIndex === null ? 0 : dayIndex;
  const dateStr = daily.time[selectedIndex];
  const label = dayIndex === null ? 'きょう' : selectedIndex === 1 ? 'あした' : 'あさって';
  const code = dayIndex === null ? d.current.weather_code : daily.weather_code[selectedIndex];
  const { icon, desc } = wmo(code);
  const temp = dayIndex === null ? Math.round(d.current.temperature_2m) : Math.round(daily.temperature_2m_max[selectedIndex]);
  const humidity = dayIndex === null
    ? d.current.relative_humidity_2m
    : Math.round(((daily.relative_humidity_2m_max?.[selectedIndex] ?? 0) + (daily.relative_humidity_2m_min?.[selectedIndex] ?? 0)) / 2);
  const wind = dayIndex === null
    ? round1(d.current.wind_speed_10m / 3.6)
    : '--';

  document.getElementById('today-date').textContent = fmtDate(dateStr);
  document.getElementById('today-icon').textContent  = icon;
  document.getElementById('today-desc').textContent  = desc;
  document.getElementById('today-temp').textContent  = temp;
  document.getElementById('today-max').textContent   = Math.round(daily.temperature_2m_max[selectedIndex]);
  document.getElementById('today-min').textContent   = Math.round(daily.temperature_2m_min[selectedIndex]);
  document.getElementById('today-humidity').textContent = humidity === '--' ? '--' : humidity;
  document.getElementById('today-wind').textContent  = wind;
  document.getElementById('today-rain').textContent  = round1(daily.precipitation_sum[selectedIndex]);
  document.getElementById('today-uv').textContent    = Math.round(daily.uv_index_max[selectedIndex]);

  // Dynamic background tint based on weather
  const card = document.getElementById('today-card');
  const bg   = card.querySelector('.today-card-bg');
  const now = new Date();
  const isNight = now.getHours() < 6 || now.getHours() >= 20;
  if (isNight) {
    bg.style.background = 'linear-gradient(135deg, rgba(30,27,75,0.5), rgba(17,24,39,0.4))';
  } else if (code <= 1) {
    bg.style.background = 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(251,146,60,0.1), rgba(79,142,247,0.1))';
  } else if (code <= 3) {
    bg.style.background = 'linear-gradient(135deg, rgba(100,116,139,0.2), rgba(79,142,247,0.1))';
  } else if (code >= 61) {
    bg.style.background = 'linear-gradient(135deg, rgba(34,211,238,0.15), rgba(6,182,212,0.1))';
  }
  document.querySelector('.today-label').textContent = label;
}

// ── Hourly ─────────────────────────────────────
function renderHourly(d) {
  const container = document.getElementById('hourly-scroll');
  container.innerHTML = '';
  container.classList.remove('single-item');

  const now       = new Date();
  const nowHour   = now.getHours();
  const selectedDateStr = selectedDayIndex === null
    ? getLocalDateISO(now)
    : d.daily.time[selectedDayIndex];

  let startIdx = d.hourly.time.findIndex(t => t.split('T')[0] === selectedDateStr);
  
  // If no hourly data available for selected day, show single card
  if (startIdx === -1) {
    container.classList.add('single-item');
    const dayData = d.daily;
    const idx = selectedDayIndex === null ? 0 : selectedDayIndex;
    const { icon, desc } = wmo(dayData.weather_code[idx]);
    const temp = Math.round(dayData.temperature_2m_max[idx]);
    const dateStr = dayData.time[idx];
    
    const card = document.createElement('div');
    card.className = 'hourly-card single fade-in';
    card.innerHTML = `
      <div class="hourly-time" style="font-size: 0.85rem;">${fmtDate(dateStr)}</div>
      <div class="hourly-icon">${icon}</div>
      <div class="hourly-temp" style="font-size: 1.05rem;">${temp}°</div>
      <div class="hourly-hum" style="font-size: 0.75rem;">${desc}</div>
    `;
    container.appendChild(card);
    return;
  }

  // Show 24 hours from the selected date
  for (let i = 0; i < 24; i++) {
    const idx     = startIdx + i;
    if (idx >= d.hourly.time.length) break;
    const time    = d.hourly.time[idx];
    const hour    = new Date(time).getHours();
    const temp    = Math.round(d.hourly.temperature_2m[idx]);
    const hum     = d.hourly.relative_humidity_2m[idx];
    const code    = d.hourly.weather_code[idx];
    const { icon } = wmo(code);

    const isActive = selectedDayIndex === null && hour === nowHour;
    const card = document.createElement('div');
    card.className = `hourly-card${isActive ? ' active' : ''} fade-in`;
    card.style.animationDelay = `${i * 0.03}s`;
    card.innerHTML = `
      <div class="hourly-time">${String(hour).padStart(2,'0')}:00</div>
      <div class="hourly-icon">${icon}</div>
      <div class="hourly-temp">${temp}°</div>
      <div class="hourly-hum">💧${hum}%</div>
    `;
    container.appendChild(card);

    if (isActive) {
      setTimeout(() => card.scrollIntoView({ inline: 'center', behavior: 'smooth' }), 300);
    }
  }
}

// ── 3-Day Forecast ─────────────────────────────
function renderForecast(d) {
  const grid = document.getElementById('forecast-grid');
  grid.innerHTML = '';

  const todayStr = new Date().toISOString().slice(0, 10);

  d.daily.time.forEach((dateStr, i) => {
    const { icon, desc }   = wmo(d.daily.weather_code[i]);
    const maxT  = Math.round(d.daily.temperature_2m_max[i]);
    const minT  = Math.round(d.daily.temperature_2m_min[i]);
    const rain  = round1(d.daily.precipitation_sum[i]);
    const humMax = d.daily.relative_humidity_2m_max?.[i] ?? '--';
    const humMin = d.daily.relative_humidity_2m_min?.[i] ?? '--';
    const uv    = Math.round(d.daily.uv_index_max[i]);
    const isToday = dateStr === todayStr;

    const card = document.createElement('div');
    card.className = `forecast-card${isToday ? ' today-forecast' : ''} fade-in`;
    card.style.animationDelay = `${i * 0.1}s`;

    card.innerHTML = `
      <div class="forecast-day-label">${isToday ? 'きょう' : `${i}にちご`}</div>
      <div class="forecast-day-name">${jpDay(dateStr)}ようび</div>
      <div class="forecast-date-str">${fmtDate(dateStr)}</div>
      <div class="forecast-icon">${icon}</div>
      <div class="forecast-desc">${desc}</div>
      <div class="forecast-temps">
        <span class="fc-max">${maxT}°</span>
        <span class="fc-sep">/</span>
        <span class="fc-min">${minT}°</span>
      </div>
      <div class="forecast-metrics">
        <div class="fc-metric">
          <span class="fc-metric-icon">💧</span>
          <span>湿度&nbsp;</span>
          <span class="fc-metric-val">${humMin}〜${humMax}%</span>
        </div>
        <div class="fc-metric">
          <span class="fc-metric-icon">🌧️</span>
          <span>降水&nbsp;</span>
          <span class="fc-metric-val">${rain}mm</span>
        </div>
        <div class="fc-metric">
          <span class="fc-metric-icon">☀️</span>
          <span>UV&nbsp;</span>
          <span class="fc-metric-val">${uv}</span>
        </div>
      </div>
    `;
    card.addEventListener('click', () => {
      selectedDayIndex = i;
      renderToday(d, selectedDayIndex);
      renderHourly(d);
      updateForecastSelection(i);
    });

    grid.appendChild(card);
  });
}

function updateForecastSelection(index) {
  document.querySelectorAll('.forecast-card').forEach((card, idx) => {
    card.classList.toggle('selected', idx === index);
  });
}

// ── Humidity bar chart ─────────────────────────
function renderHumidityChart(d) {
  const container = document.getElementById('humidity-bars');
  container.innerHTML = '';

  const todayStr = getLocalDateISO(new Date());
  let startIdx = d.hourly.time.findIndex(t => t.split('T')[0] === todayStr);
  if (startIdx === -1) startIdx = 0;

  for (let i = 0; i < 24; i += 1) {
    const idx  = startIdx + i;
    if (idx >= d.hourly.time.length) break;
    const hum  = d.hourly.relative_humidity_2m[idx];
    const time = `${String(new Date(d.hourly.time[idx]).getHours()).padStart(2,'0')}:00`;
    const pct  = hum; // 0-100

    const wrap = document.createElement('div');
    wrap.className = 'hum-bar-wrap';

    const bar = document.createElement('div');
    bar.className = 'hum-bar';
    bar.style.height = `${Math.max(4, pct * 0.95)}px`;
    bar.style.background = humColor(pct);
    bar.style.boxShadow = '0 0 8px rgba(34,211,238,0.25)';
    bar.setAttribute('data-tip', `${time}  ${hum}%`);

    const val = document.createElement('div');
    val.className = 'hum-bar-val';
    val.textContent = `${hum}%`;

    const label = document.createElement('div');
    label.className = 'hum-bar-time';
    label.textContent = time;

    wrap.appendChild(val);
    wrap.appendChild(bar);
    wrap.appendChild(label);
    container.appendChild(wrap);
  }
}

// ── Show/hide state panels ─────────────────────
function showState(state) {
  document.getElementById('loading-state').classList.add('hidden');
  document.getElementById('error-state').classList.add('hidden');
  document.getElementById('main-content').classList.add('hidden');

  if (state === 'loading') document.getElementById('loading-state').classList.remove('hidden');
  if (state === 'error')   document.getElementById('error-state').classList.remove('hidden');
  if (state === 'main')    document.getElementById('main-content').classList.remove('hidden');
}

// ── Auto-refresh every 10 minutes ─────────────
setInterval(loadWeather, 10 * 60 * 1000);

// ── Start ──────────────────────────────────────
loadWeather();
