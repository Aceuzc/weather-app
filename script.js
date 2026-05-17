const API_KEY_STORAGE = 'owm_api_key';
let API_KEY = localStorage.getItem(API_KEY_STORAGE) || '';

function ensureApiKey() {
	if (API_KEY && API_KEY !== 'YOUR_OPENWEATHERMAP_API_KEY') return true;
	const key = prompt('Enter your OpenWeatherMap API key (stored locally in this browser):');
	if (!key?.trim()) {
		alert('API key required');
		return false;
	}
	API_KEY = key.trim();
	localStorage.setItem(API_KEY_STORAGE, API_KEY);
	return true;
}

// ── FAVORITES & RECENT ───────────────────────────────────────────────────────
const FAVORITES_KEY = 'weather_favorites';
const RECENT_KEY    = 'weather_recent';

function getFavorites(){ try { return JSON.parse(localStorage.getItem(FAVORITES_KEY)||'[]'); } catch { return []; } }
function getRecent()   { try { return JSON.parse(localStorage.getItem(RECENT_KEY)||'[]');    } catch { return []; } }

function addToRecent(cityName){
	let recent = getRecent();
	recent = [cityName, ...recent.filter(c => c.toLowerCase() !== cityName.toLowerCase())].slice(0, 6);
	localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
	renderQuickAccess();
}

function toggleFavorite(){
	if(!currentWeatherData) return;
	const city = currentWeatherData.name;
	let favs = getFavorites();
	const idx = favs.findIndex(c => c.toLowerCase() === city.toLowerCase());
	if(idx === -1){
		favs.push(city);
		showNavToast(`⭐ ${city} saved to favorites`);
	} else {
		favs.splice(idx, 1);
		showNavToast(`☆ ${city} removed from favorites`);
	}
	localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
	updateFavoriteBtn();
	renderQuickAccess();
}

function updateFavoriteBtn(){
	const btn = document.getElementById('favorite-btn');
	if(!btn || !currentWeatherData) return;
	const isFav = getFavorites().some(c => c.toLowerCase() === currentWeatherData.name.toLowerCase());
	btn.textContent = isFav ? '★' : '☆';
	btn.setAttribute('aria-pressed', isFav);
	btn.title = isFav ? 'Remove from favorites' : 'Add to favorites';
	btn.classList.toggle('is-fav', isFav);
}

function renderQuickAccess(){
	const favs   = getFavorites();
	const recent = getRecent();

	const favSection    = document.getElementById('favorites-section');
	const recentSection = document.getElementById('recent-section');
	const favChips      = document.getElementById('favorites-chips');
	const recentChips   = document.getElementById('recent-chips');
	if(!favSection || !recentSection) return;

	if(favs.length > 0){
		favSection.removeAttribute('hidden');
		favChips.innerHTML = favs.map(city =>
			`<button class="quick-chip" data-city="${city}">${city}</button>`
		).join('');
		favChips.querySelectorAll('.quick-chip').forEach(btn =>
			btn.addEventListener('click', () => { elements.cityInput.value = btn.dataset.city; getWeatherByCity(btn.dataset.city); })
		);
	} else {
		favSection.setAttribute('hidden', '');
	}

	if(recent.length > 0){
		recentSection.removeAttribute('hidden');
		recentChips.innerHTML = recent.map(city =>
			`<button class="quick-chip" data-city="${city}">${city}</button>`
		).join('');
		recentChips.querySelectorAll('.quick-chip').forEach(btn =>
			btn.addEventListener('click', () => { elements.cityInput.value = btn.dataset.city; getWeatherByCity(btn.dataset.city); })
		);
	} else {
		recentSection.setAttribute('hidden', '');
	}
}

document.getElementById('favorite-btn')?.addEventListener('click', toggleFavorite);
// ─────────────────────────────────────────────────────────────────────────────

// ── UV INDEX ──────────────────────────────────────────────────────────────────
async function fetchUVIndex(lat, lon){
	try {
		const url = `https://api.openweathermap.org/data/2.5/uvi?lat=${lat}&lon=${lon}&appid=${API_KEY}`;
		const data = await fetchJSON(url);
		return typeof data.value === 'number' ? data.value : null;
	} catch { return null; }
}

function getUVInfo(uv){
	if(uv === null || uv === undefined) return { label:'--', risk:'N/A', color:'rgba(255,255,255,0.4)', pct:0 };
	const clamped = Math.min(uv, 11);
	if(uv < 3)  return { label: uv.toFixed(1), risk:'Low',       color:'#22c55e', pct: (clamped/11)*100 };
	if(uv < 6)  return { label: uv.toFixed(1), risk:'Moderate',  color:'#eab308', pct: (clamped/11)*100 };
	if(uv < 8)  return { label: uv.toFixed(1), risk:'High',      color:'#f97316', pct: (clamped/11)*100 };
	if(uv < 11) return { label: uv.toFixed(1), risk:'Very High', color:'#ef4444', pct: (clamped/11)*100 };
	return           { label: uv.toFixed(1), risk:'Extreme',   color:'#a855f7', pct: 100 };
}

function renderUVIndex(uv){
	const el = document.getElementById('uv-index-card');
	if(!el) return;
	const { label, risk, color, pct } = getUVInfo(uv);
	el.innerHTML = `
		<div class="uv-top">
			<span class="uv-icon">☀️</span>
			<div>
				<div class="uv-label-small">UV Index</div>
				<div class="uv-value" style="color:${color}">${label} <span class="uv-risk" style="color:${color}">${risk}</span></div>
			</div>
		</div>
		<div class="uv-bar-track">
			<div class="uv-bar-fill" style="width:${pct}%;background:${color}"></div>
		</div>
	`;
}
// ─────────────────────────────────────────────────────────────────────────────

// ── AI CONFIG ─────────────────────────────────────────────────────────────────
// To enable AI weather summaries, paste your key below and set the provider.
//   Provider options: 'gemini'  → get a free key at aistudio.google.com
//                     'openrouter' → get a key at openrouter.ai
const AI_API_KEY       = 'YOUR_GEMINI_OR_OPENROUTER_KEY';
const AI_PROVIDER      = 'gemini';        // 'gemini' | 'openrouter'
const OPENROUTER_SITE  = 'https://yoursite.com';
const OPENROUTER_APP   = 'Weather Dashboard';
const OPENROUTER_MODEL = 'google/gemini-2.0-flash-exp:free';
// ─────────────────────────────────────────────────────────────────────────────

// ── UNIT TOGGLE ───────────────────────────────────────────────────────────────
let tempUnit = 'C'; // 'C' | 'F'
function toDisplay(celsius) {
	return tempUnit === 'F' ? Math.round(celsius * 9 / 5 + 32) : Math.round(celsius);
}
function unitLabel() { return `°${tempUnit}`; }
function formatTemp(celsius) { return `${toDisplay(celsius)}${unitLabel()}`; }

function updateTempUnitDisplay() {
	const el = document.querySelector('.temp-unit');
	if (el) el.textContent = unitLabel();
}
// ─────────────────────────────────────────────────────────────────────────────
const elements = {
	form: document.getElementById('search-form'),
	cityInput: document.getElementById('city-input'),
	geoBtn: document.getElementById('geo-btn'),
	cityName: document.getElementById('city-name'),
	temp: document.getElementById('temp'),
	desc: document.getElementById('desc'),
	weatherIcon: document.getElementById('weather-icon'),
	forecast: document.getElementById('forecast'),
	statHumidity: document.getElementById('stat-humidity'),
	statWind: document.getElementById('stat-wind'),
	statPressure: document.getElementById('stat-pressure'),
	statVisibility: document.getElementById('stat-visibility'),
	weatherMap: document.getElementById('weather-map'),
	dayDisplay: document.getElementById('day-display'),
	chartCanvas: document.getElementById('chart-canvas'),
	summaryChart: document.getElementById('summary-chart'),
	forecastTabs: document.getElementById('forecast-tabs'),
	summaryTabs: document.getElementById('summary-tabs'),
	hourlyList: document.getElementById('hourly-list'),
	detailsGrid: document.getElementById('details-grid'),
	aiSummary: document.getElementById('ai-summary'),
	aiSummaryText: document.getElementById('ai-summary-text')
};

// Store data for re-rendering
let forecastList = [];
let hourlyData = [];
let currentWeatherData = null;
let activeForecastDays = 6;
let lastFetchTime = null;

// Cities modal weather cache — declared here so autocomplete can access it early
const citiesWeatherCache = {};

// Set current day display
const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
elements.dayDisplay.textContent = dayNames[new Date().getDay()];

function getWeatherEmoji(condition){
	const cond = condition.toLowerCase();
	if(cond.includes('thunder')) return '⛈️';
	if(cond.includes('drizzle')) return '🌦️';
	if(cond.includes('rain')) return '🌧️';
	if(cond.includes('snow')) return '❄️';
	if(cond.includes('cloud') && cond.includes('scatter')) return '⛅';
	if(cond.includes('cloud')) return '☁️';
	if(cond.includes('clear')) return '☀️';
	if(cond.includes('sunny')) return '🌞';
	if(cond.includes('mist') || cond.includes('fog') || cond.includes('haze')) return '🌫️';
	if(cond.includes('wind')) return '💨';
	return '🌤️';
}

async function fetchJSON(url){
	const res = await fetch(url);
	if(!res.ok) throw new Error(await res.text());
	return res.json();
}

async function fetchWithRetry(url, options, retries = 3){
	for(let i = 0; i < retries; i++){
		const res = await fetch(url, options);

		if(res.status !== 429){
			return res;
		}

		const retryAfter = Number(res.headers.get('Retry-After')) || 2;

		await new Promise(r => setTimeout(r, retryAfter * 1000));
	}

	throw new Error('Rate limit exceeded');
}

function formatTime(dt){
	const d = new Date(dt * 1000);
	return d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

function formatDay(dt){
	const d = new Date(dt * 1000);
	return d.toLocaleDateString([], {weekday: 'short'});
}

function formatDate(dt){
	const d = new Date(dt * 1000);
	return d.toLocaleDateString([], {month: 'short', day: 'numeric'});
}

function setLoading(){
	elements.temp.textContent = '…';
	elements.desc.textContent = 'Loading…';
	elements.forecast.innerHTML = '<div class="loading-placeholder">Loading forecast…</div>';
	setAISummary('Generating AI summary…', true);
	// Search loading state
	elements.cityInput.disabled = true;
	elements.cityInput.classList.add('is-loading');
	const submitBtn = elements.form.querySelector('button[type="submit"]');
	if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '…'; }
}

function clearLoading(){
	elements.cityInput.disabled = false;
	elements.cityInput.classList.remove('is-loading');
	const submitBtn = elements.form.querySelector('button[type="submit"]');
	if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Search'; }
}

function setAISummary(text, isLoading){
	if(!elements.aiSummary || !elements.aiSummaryText) return;
	elements.aiSummaryText.textContent = text;
	elements.aiSummary.classList.toggle('loading', Boolean(isLoading));
}

function getLocalHour(dt, tzOffset){
	const d = new Date((dt + tzOffset) * 1000);
	return d.getUTCHours();
}

function buildSummaryData(cur, list){
	const tzOffset = cur.timezone || 0;
	const nowUtc = Math.floor(Date.now() / 1000);
	const localNow = new Date((nowUtc + tzOffset) * 1000);
	const dayName = localNow.toLocaleDateString([], { weekday: 'long' });

	const next24 = list.slice(0, 8);
	const maxTemps = next24.map(item => item.main.temp_max);
	const minTemps = next24.map(item => item.main.temp_min);

	const eveningEntries = next24.filter(item => {
		const hour = getLocalHour(item.dt, tzOffset);
		return hour >= 15 && hour <= 21;
	});

	let eveningChance = null;
	let eveningPeakHour = null;
	if(eveningEntries.length > 0){
		let maxPop = 0;
		let maxItem = eveningEntries[0];
		eveningEntries.forEach(item => {
			const pop = typeof item.pop === 'number' ? item.pop : 0;
			if(pop >= maxPop){
				maxPop = pop;
				maxItem = item;
			}
		});
		eveningChance = Math.round(maxPop * 100);
		eveningPeakHour = getLocalHour(maxItem.dt, tzOffset);
	}

	return {
		city: cur.name,
		country: cur.sys.country,
		dayName,
		current: {
			tempC: Math.round(cur.main.temp),
			feelsLikeC: Math.round(cur.main.feels_like),
			humidityPct: cur.main.humidity,
			windMs: Math.round(cur.wind.speed),
			description: cur.weather[0].description
		},
		next24: {
			highC: Math.round(Math.max(...maxTemps)),
			lowC: Math.round(Math.min(...minTemps))
		},
		eveningRain: {
			chancePct: eveningChance,
			peakHourLocal: eveningPeakHour
		}
	};
}

async function generateAISummary(cur, list){
	setAISummary('Generating AI summary…', true);

	if(!AI_API_KEY || AI_API_KEY.startsWith('YOUR_')){
		setAISummary('Add your Gemini API key to enable the AI summary.', false);
		return;
	}


	function generateFallbackSummary(cur) {
		return `${cur.name} is currently ${formatTemp(cur.main.temp)} with ${cur.weather[0].description}. Stay hydrated and prepare for changing conditions today.`;
	}

	const data = buildSummaryData(cur, list);
	const prompt = [
		'Write 1-2 sentences of natural language weather summary.',
		'Use the provided data only. Use vivid, specific phrasing and avoid generic filler.',
		'Mention the day name and city, describe how it feels,',
		'and include a specific timing for rain if evening rain chance is 40% or higher.',
		'If rain chance is lower, mention a good outdoor window instead.',
		'Include one practical suggestion (umbrella, hydration, light layers).',
		'Keep it under 45 words, plain text, no emojis, no bullet points, no quotes.',
		`Data: ${JSON.stringify(data)}`
	].join(' ');

	try{
		let res;
		let text;

		if(AI_PROVIDER === 'openrouter'){
			res = await fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${AI_API_KEY}`,
					'HTTP-Referer': OPENROUTER_SITE,
					'X-Title': OPENROUTER_APP
				},
				body: JSON.stringify({
					model: OPENROUTER_MODEL,
					messages: [{ role: 'user', content: prompt }],
					temperature: 0.7,
					max_tokens: 120
				})
			});

			if(!res.ok){
				const errorText = await res.text();
                console.error(errorText);
                throw new Error(errorText);
			}

			const json = await res.json();
			text = json?.choices?.[0]?.message?.content?.trim();
		} else {
			res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${AI_API_KEY}`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						contents: [{ role: 'user', parts: [{ text: prompt }] }],
						generationConfig: { temperature: 0.7, maxOutputTokens: 120 }
					})
				}
			);

			if(!res.ok){
                console.log(await res.clone().text());
				throw new Error(await res.text());
			}

			const json = await res.json();
			text = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
		}

		setAISummary(text || 'AI summary unavailable.', false);
	}catch(err){
		console.error(err);
		if (err.message.includes('429')) {
			setAISummary('AI is busy right now. Retrying shortly...', false);
		} else {
			setAISummary(generateFallbackSummary(cur), false);
		}
	}
}

function renderCurrent(d){
	elements.cityName.textContent = `${d.name}, ${d.sys.country}`;
	elements.temp.textContent = `${toDisplay(d.main.temp)}`;
	updateTempUnitDisplay();
	elements.desc.textContent = d.weather[0].description.replace(/\b\w/g, c => c.toUpperCase());
	elements.weatherIcon.textContent = getWeatherEmoji(d.weather[0].main);
	elements.statHumidity.textContent = `${d.main.humidity}%`;
	elements.statWind.textContent = `${Math.round(d.wind.speed)} m/s`;
	elements.statPressure.textContent = `${d.main.pressure} hPa`;
	elements.statVisibility.textContent = `${(d.visibility/1000).toFixed(1)} km`;

	// Last updated timestamp
	lastFetchTime = new Date();
	updateLastUpdated();

	// New feature calls
	updateWeatherBackground(d);
	renderMoodBoard(d);
	renderOutfitPanel(d);
	generatePlainAlerts(d, forecastList);
	updateFavoriteBtn();
	addToRecent(d.name);
}

function updateLastUpdated(){
	const el = document.getElementById('last-updated');
	if (!el || !lastFetchTime) return;
	const diff = Math.round((Date.now() - lastFetchTime) / 1000);
	if (diff < 60) el.textContent = `Updated just now`;
	else if (diff < 3600) el.textContent = `Updated ${Math.floor(diff / 60)}m ago`;
	else el.textContent = `Updated ${Math.floor(diff / 3600)}h ago`;
}
// Refresh the "x mins ago" label every minute
setInterval(updateLastUpdated, 60000);

function updateMap(lat, lon){
	const bbox = `${lon - 0.15},${lat - 0.2},${lon + 0.15},${lat + 0.2}`;
	elements.weatherMap.src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`;
}

// ===== FORECAST TAB LOGIC =====
function renderForecast7Days(list, maxDays){
	elements.forecast.innerHTML = '';

	// Group by day
	const dailyMap = {};
	list.forEach(item => {
		const dateKey = new Date(item.dt * 1000).toLocaleDateString();
		if(!dailyMap[dateKey]){
			dailyMap[dateKey] = {
				temps: [],
				conditions: [],
				pops: [],
				dt: item.dt
			};
		}
		dailyMap[dateKey].temps.push(item.main.temp);
		dailyMap[dateKey].conditions.push(item.weather[0].main);
		if (typeof item.pop === 'number') dailyMap[dateKey].pops.push(item.pop);
	});

	const dailyArr = Object.values(dailyMap);
	const days = dailyArr.slice(0, maxDays || 6);

	days.forEach((day, index) => {
		const el = document.createElement('div');
		el.className = 'forecast-item';
		el.style.animationDelay = `${index * 0.05}s`;
		const maxTemp = toDisplay(Math.max(...day.temps));
		const minTemp = toDisplay(Math.min(...day.temps));
		const condCount = {};
		day.conditions.forEach(c => condCount[c] = (condCount[c]||0) + 1);
		const mainCond = Object.keys(condCount).sort((a,b) => condCount[b] - condCount[a])[0];
		const emoji = getWeatherEmoji(mainCond);
		const dayName = formatDay(day.dt);
		const dateStr = formatDate(day.dt);
		const popPct = day.pops && day.pops.length
			? Math.round((day.pops.reduce((a, b) => a + b, 0) / day.pops.length) * 100)
			: 0;
		const popColor = popPct >= 60 ? '#60a5fa' : popPct >= 30 ? '#93c5fd' : 'rgba(148,163,184,0.5)';

		el.innerHTML = `
			<div class="time">${dayName}</div>
			<div class="date">${dateStr}</div>
			<div class="icon">${emoji}</div>
			<div class="ftemp">${maxTemp}${unitLabel()}</div>
			<div class="ftemp-low">${minTemp}${unitLabel()}</div>
			${popPct > 0 ? `
			<div class="fpop-bar" title="${popPct}% chance of rain">
				<div class="fpop-fill" style="width:${popPct}%;background:${popColor}"></div>
			</div>
			<div class="fpop-label" style="color:${popColor}">${popPct}%</div>
			` : ''}
		`;
		elements.forecast.appendChild(el);
	});
}

// Forecast tab click handlers
elements.forecastTabs.addEventListener('click', (e) => {
	const btn = e.target.closest('.tab-btn');
	if(!btn) return;

	// Update active state
	elements.forecastTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
	btn.classList.add('active');

	// Re-render with selected day count
	activeForecastDays = parseInt(btn.dataset.days);
	if(forecastList.length > 0){
		renderForecast7Days(forecastList, activeForecastDays);
	}
});

// ===== SUMMARY TAB LOGIC =====
function switchSummaryPanel(viewName){
	// Update panels
	document.querySelectorAll('.summary-panel').forEach(p => p.classList.remove('active'));
	const target = document.getElementById(`panel-${viewName}`);
	if(target) target.classList.add('active');

	if (viewName === 'summary' && hourlyData.length > 0) {
		setTimeout(() => renderSummaryChart(forecastList), 50);
	}
	if (viewName === 'feellike' && forecastList.length > 0) {
		const panel = document.getElementById('panel-feellike');
		// Render deferred chart now that the panel is visible
		if (panel?._needsRender) {
			setTimeout(() => renderFeelLikeChart(panel._needsRender), 50);
		} else {
			setTimeout(() => renderFeelLikeChart(forecastList), 50);
		}
	}
}

elements.summaryTabs.addEventListener('click', (e) => {
	const btn = e.target.closest('.tab-btn');
	if(!btn) return;

	elements.summaryTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
	btn.classList.add('active');

	switchSummaryPanel(btn.dataset.view);
});

// ===== HOURLY VIEW =====
function renderHourlyList(list){
	const el = elements.hourlyList;
	el.innerHTML = '';
	
	// Show next 8 x 3-hour intervals
	const entries = list.slice(0, 8);

	entries.forEach(item => {
		const div = document.createElement('div');
		div.className = 'hourly-item';
		const emoji = getWeatherEmoji(item.weather[0].main);
		const temp = toDisplay(item.main.temp);
		const time = formatTime(item.dt);
		const desc = item.weather[0].description.replace(/\b\w/g, c => c.toUpperCase());
		const wind = `${Math.round(item.wind.speed)} m/s`;

		div.innerHTML = `
			<span class="hourly-time">${time}</span>
			<span class="hourly-icon">${emoji}</span>
			<span class="hourly-desc">${desc}</span>
			<span class="hourly-temp">${temp}${unitLabel()}</span>
			<span class="hourly-wind">💨 ${wind}</span>
		`;
		el.appendChild(div);
	});
}

// ===== MORE DETAILS VIEW =====
function renderMoreDetails(cur, list){
	const el = elements.detailsGrid;
	el.innerHTML = '';

	// Compute averages from forecast
	const next24 = list.slice(0, 8);
	const avgHumidity = Math.round(next24.reduce((s,i) => s + i.main.humidity, 0) / next24.length);
	const maxWind = Math.round(Math.max(...next24.map(i => i.wind.speed)));
	const avgPressure = Math.round(next24.reduce((s,i) => s + i.main.pressure, 0) / next24.length);
	const maxTemp = Math.max(...next24.map(i => i.main.temp_max));
	const minTemp = Math.min(...next24.map(i => i.main.temp_min));
	const avgClouds = Math.round(next24.reduce((s,i) => s + i.clouds.all, 0) / next24.length);

	const sunrise = cur.sys.sunrise ? formatTime(cur.sys.sunrise) : '--';
	const sunset = cur.sys.sunset ? formatTime(cur.sys.sunset) : '--';

	// Sunrise/sunset arc canvas
	const arcContainer = document.createElement('div');
	arcContainer.className = 'sunpath-arc-container';
	arcContainer.style.gridColumn = '1 / -1';
	arcContainer.innerHTML = `<canvas id="sunpath-canvas" class="sunpath-canvas"></canvas>`;
	el.appendChild(arcContainer);
	// Render arc after insertion
	requestAnimationFrame(() => renderSunpathArc(cur, sunrise, sunset));

	const details = [
		{ icon: '🌡️', label: 'Feels Like', value: `${toDisplay(cur.main.feels_like)}${unitLabel()}`, sub: 'Current sensation' },
		{ icon: '💧', label: 'Avg Humidity', value: `${avgHumidity}%`, sub: 'Next 24h average' },
		{ icon: '💨', label: 'Max Wind', value: `${maxWind} m/s`, sub: 'Next 24h peak' },
		{ icon: '🌡️', label: 'Pressure', value: `${avgPressure} hPa`, sub: 'Avg atmospheric' },
		{ icon: '🔺', label: 'High Temp', value: `${toDisplay(maxTemp)}${unitLabel()}`, sub: 'Next 24h maximum' },
		{ icon: '🔻', label: 'Low Temp', value: `${toDisplay(minTemp)}${unitLabel()}`, sub: 'Next 24h minimum' },
		{ icon: '☁️', label: 'Cloud Cover', value: `${avgClouds}%`, sub: 'Avg coverage' },
		{ icon: '👁️', label: 'Visibility', value: `${(cur.visibility/1000).toFixed(1)} km`, sub: 'Current' },
	];

	details.forEach(d => {
		const card = document.createElement('div');
		card.className = 'detail-card';
		card.innerHTML = `
			<div class="detail-icon">${d.icon}</div>
			<div class="detail-label">${d.label}</div>
			<div class="detail-value">${d.value}</div>
			<div class="detail-sub">${d.sub}</div>
		`;
		el.appendChild(card);
	});
}

// ===== SUMMARY CHART =====
function renderSummaryChart(list){
	const canvas = elements.chartCanvas;
	const container = elements.summaryChart;
	if(!canvas || !container) return;

	const entries = list.slice(0, 8);
	hourlyData = entries;

	const ctx = canvas.getContext('2d');
	const dpr = window.devicePixelRatio || 1;

	// Reset to 0 BEFORE measuring so the canvas never inflates the container rect
	canvas.width = 0;
	canvas.height = 0;

	const W = container.offsetWidth;
	const H = container.offsetHeight;
	if(W === 0 || H === 0) return;

	canvas.width = W * dpr;
	canvas.height = H * dpr;
	ctx.scale(dpr, dpr);

	ctx.clearRect(0, 0, W, H);

	if(entries.length === 0) return;

	const temps = entries.map(e => e.main.temp);
	const labels = entries.map(e => formatTime(e.dt));
	const minT = Math.min(...temps) - 2;
	const maxT = Math.max(...temps) + 2;

	const padL = 50, padR = 20, padT = 30, padB = 40;
	const plotW = W - padL - padR;
	const plotH = H - padT - padB;

	function xPos(i){ return padL + (i / (entries.length - 1)) * plotW; }
	function yPos(t){ return padT + (1 - (t - minT) / (maxT - minT)) * plotH; }

	// Draw horizontal grid lines
	ctx.strokeStyle = 'rgba(255,255,255,0.08)';
	ctx.lineWidth = 1;
	const gridSteps = 4;
	for(let i = 0; i <= gridSteps; i++){
		const t = minT + (maxT - minT) * (i / gridSteps);
		const y = yPos(t);
		ctx.beginPath();
		ctx.moveTo(padL, y);
		ctx.lineTo(W - padR, y);
		ctx.stroke();

		ctx.fillStyle = 'rgba(255,255,255,0.5)';
		ctx.font = '11px Inter, -apple-system, sans-serif';
		ctx.textAlign = 'right';
		ctx.fillText(`${Math.round(t)}°`, padL - 8, y + 4);
	}

	// Draw gradient fill under the line
	const gradient = ctx.createLinearGradient(0, padT, 0, H - padB);
	gradient.addColorStop(0, 'rgba(110,231,183,0.3)');
	gradient.addColorStop(1, 'rgba(110,231,183,0.02)');
	ctx.beginPath();
	ctx.moveTo(xPos(0), yPos(temps[0]));
	for(let i = 1; i < temps.length; i++){
		const cx = (xPos(i-1) + xPos(i)) / 2;
		ctx.bezierCurveTo(cx, yPos(temps[i-1]), cx, yPos(temps[i]), xPos(i), yPos(temps[i]));
	}
	ctx.lineTo(xPos(temps.length - 1), H - padB);
	ctx.lineTo(xPos(0), H - padB);
	ctx.closePath();
	ctx.fillStyle = gradient;
	ctx.fill();

	// Draw the line
	ctx.beginPath();
	ctx.moveTo(xPos(0), yPos(temps[0]));
	for(let i = 1; i < temps.length; i++){
		const cx = (xPos(i-1) + xPos(i)) / 2;
		ctx.bezierCurveTo(cx, yPos(temps[i-1]), cx, yPos(temps[i]), xPos(i), yPos(temps[i]));
	}
	ctx.strokeStyle = '#6ee7b7';
	ctx.lineWidth = 2.5;
	ctx.stroke();

	// Draw data points
	temps.forEach((t, i) => {
		ctx.beginPath();
		ctx.arc(xPos(i), yPos(t), 4, 0, Math.PI * 2);
		ctx.fillStyle = '#6ee7b7';
		ctx.fill();
		ctx.strokeStyle = '#0f172a';
		ctx.lineWidth = 2;
		ctx.stroke();
	});

	// Draw X-axis labels
	ctx.fillStyle = 'rgba(255,255,255,0.5)';
	ctx.font = '10px Inter, -apple-system, sans-serif';
	ctx.textAlign = 'center';
	labels.forEach((lbl, i) => {
		ctx.fillText(lbl, xPos(i), H - padB + 18);
	});

	// Chart title
	ctx.fillStyle = 'rgba(255,255,255,0.4)';
	ctx.font = '11px Inter, -apple-system, sans-serif';
	ctx.textAlign = 'left';
	ctx.fillText('Temperature (next 24h)', padL, padT - 12);
}

// ===== POPULAR CITIES =====
async function updatePopularCities(){
	const cities = [
		{ label: 'Manila', query: 'Manila,PH' },
		{ label: 'Quezon City', query: 'Quezon City,PH' },
		{ label: 'Makati', query: 'Makati,PH' },
		{ label: 'Cebu City', query: 'Cebu City,PH' },
		{ label: 'Davao City', query: 'Davao City,PH' }
	];
	const listEl = document.getElementById('cities-list');

	try {
		const promises = cities.map(city => {
			const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city.query)}&units=metric&appid=${API_KEY}`;
			return fetchJSON(url).catch(() => null);
		});

		const results = await Promise.all(promises);
		listEl.innerHTML = '';

		results.forEach((data, i) => {
			const div = document.createElement('div');
			div.className = 'city-item';
			div.style.cursor = 'pointer';

			if(data){
				const emoji = getWeatherEmoji(data.weather[0].main);
				const temp = formatTemp(data.main.temp);
				const desc = data.weather[0].description.replace(/\b\w/g, c => c.toUpperCase());
				div.innerHTML = `
					<span class="city-name">${emoji} ${cities[i].label}</span>
					<span class="city-temp">${temp}</span>
					<span class="city-condition">${desc}</span>
				`;
				div.addEventListener('click', () => {
					elements.cityInput.value = cities[i].label;
					getWeatherByCity(cities[i].query);
				});
			} else {
				div.innerHTML = `
					<span class="city-name">${cities[i].label}</span>
					<span class="city-condition">Unavailable</span>
				`;
			}
			listEl.appendChild(div);
		});
	} catch(e) {
		// Silently fail, keep static cities
	}
}

// ===== SEARCH AUTOCOMPLETE DROPDOWN =====
(function initSearchAutocomplete() {
	const input    = elements.cityInput;
	const dropdown = document.getElementById('search-dropdown');
	if (!input || !dropdown) return;

	// Build flat city list with region labels (populated lazily from CITIES_BY_REGION)
	// We reference it after CITIES_BY_REGION is declared below, so we use a getter.
	function getAllCities() {
		if (typeof CITIES_BY_REGION === 'undefined') return [];
		return Object.entries(CITIES_BY_REGION).flatMap(([region, cities]) =>
			cities.map(city => ({ city, region }))
		);
	}

	let activeIdx = -1;
	let currentItems = [];

	// ── Open / close helpers ──────────────────────────────────────────────
	function openDropdown() {
		dropdown.removeAttribute('hidden');
		input.classList.add('dropdown-open');
	}
	function closeDropdown() {
		dropdown.setAttribute('hidden', '');
		input.classList.remove('dropdown-open');
		activeIdx = -1;
		currentItems = [];
	}

	// ── Highlight matched substring ───────────────────────────────────────
	function highlight(text, query) {
		if (!query) return text;
		const idx = text.toLowerCase().indexOf(query.toLowerCase());
		if (idx === -1) return text;
		return (
			text.slice(0, idx) +
			`<span class="sd-match">${text.slice(idx, idx + query.length)}</span>` +
			text.slice(idx + query.length)
		);
	}

	// ── Render section header ─────────────────────────────────────────────
	function sectionHeader(label) {
		const div = document.createElement('div');
		div.className = 'sd-section';
		div.textContent = label;
		return div;
	}

	// ── Build a clickable suggestion row ─────────────────────────────────
	function buildItem(cityName, regionLabel, query, weatherData) {
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'sd-item';
		btn.setAttribute('role', 'option');
		btn.dataset.city = cityName;

		const emoji = weatherData ? getWeatherEmoji(weatherData.weather[0].main) : '🌐';
		const temp  = weatherData ? formatTemp(weatherData.main.temp) : '';
		const cond  = weatherData
			? weatherData.weather[0].description.replace(/\b\w/g, c => c.toUpperCase())
			: '';

		btn.innerHTML = `
			<span class="sd-item-emoji">${emoji}</span>
			<span class="sd-item-name">${highlight(cityName, query)}</span>
			<span class="sd-item-region">${regionLabel}</span>
			<span class="sd-item-meta">
				${temp  ? `<span class="sd-item-temp">${temp}</span>` : ''}
				${cond  ? `<span class="sd-item-cond">${cond}</span>` : ''}
			</span>
		`;

		btn.addEventListener('mousedown', e => {
			e.preventDefault(); // keep focus on input
			selectCity(cityName);
		});
		return btn;
	}

	// ── Select a city ─────────────────────────────────────────────────────
	function selectCity(cityName) {
		input.value = cityName;
		closeDropdown();
		getWeatherByCity(`${cityName},PH`);
	}

	// ── Render the dropdown contents ──────────────────────────────────────
	function renderDropdown(query) {
		dropdown.innerHTML = '';
		activeIdx = -1;
		currentItems = [];

		const allCities = getAllCities();
		if (allCities.length === 0) { closeDropdown(); return; }

		const q = query.trim().toLowerCase();

		// ── Empty query: show Favorites then Recent ──────────────────────
		if (!q) {
			const favs   = getFavorites();
			const recent = getRecent();
			let hasContent = false;

			if (favs.length) {
				dropdown.appendChild(sectionHeader('⭐ Favorites'));
				favs.forEach(city => {
					const btn = buildItem(city, 'Favorite', '', citiesWeatherCache[city] || null);
					dropdown.appendChild(btn);
					currentItems.push(btn);
				});
				hasContent = true;
			}

			if (recent.length) {
				dropdown.appendChild(sectionHeader('🕒 Recent'));
				recent.forEach(city => {
					const btn = buildItem(city, 'Recent', '', citiesWeatherCache[city] || null);
					dropdown.appendChild(btn);
					currentItems.push(btn);
				});
				hasContent = true;
			}

			if (!hasContent) {
				// Show first 8 popular cities as suggestions
				dropdown.appendChild(sectionHeader('🇵🇭 Popular Cities'));
				allCities.slice(0, 8).forEach(({ city, region }) => {
					const btn = buildItem(city, region, '', citiesWeatherCache[city] || null);
					dropdown.appendChild(btn);
					currentItems.push(btn);
				});
			}

			appendHint();
			openDropdown();
			return;
		}

		// ── Typed query: filter all cities ───────────────────────────────
		const matches = allCities.filter(({ city }) =>
			city.toLowerCase().includes(q)
		);

		if (matches.length === 0) {
			const empty = document.createElement('div');
			empty.className = 'sd-empty';
			empty.textContent = `No Philippine city matches "${query}"`;
			dropdown.appendChild(empty);
			appendHint();
			openDropdown();
			return;
		}

		// Group by region, show max 12 total
		const grouped = {};
		let total = 0;
		for (const { city, region } of matches) {
			if (total >= 12) break;
			if (!grouped[region]) grouped[region] = [];
			grouped[region].push(city);
			total++;
		}

		Object.entries(grouped).forEach(([region, cities]) => {
			dropdown.appendChild(sectionHeader(region));
			cities.forEach(city => {
				const btn = buildItem(city, '', q, citiesWeatherCache[city] || null);
				dropdown.appendChild(btn);
				currentItems.push(btn);
			});
		});

		if (matches.length > 12) {
			const more = document.createElement('div');
			more.className = 'sd-section';
			more.style.color = 'rgba(255,255,255,0.3)';
			more.textContent = `+${matches.length - 12} more — keep typing`;
			dropdown.appendChild(more);
		}

		appendHint();
		openDropdown();
	}

	function appendHint() {
		const hint = document.createElement('div');
		hint.className = 'sd-hint';
		hint.innerHTML = '<kbd>↑↓</kbd> navigate &nbsp; <kbd>↵</kbd> select &nbsp; <kbd>Esc</kbd> close';
		dropdown.appendChild(hint);
	}

	// ── Keyboard navigation ───────────────────────────────────────────────
	function updateActiveItem(newIdx) {
		currentItems.forEach((el, i) => el.classList.toggle('sd-active', i === newIdx));
		if (currentItems[newIdx]) {
			currentItems[newIdx].scrollIntoView({ block: 'nearest' });
		}
		activeIdx = newIdx;
	}

	input.addEventListener('keydown', e => {
		if (!currentItems.length) return;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			updateActiveItem(Math.min(activeIdx + 1, currentItems.length - 1));
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			updateActiveItem(Math.max(activeIdx - 1, 0));
		} else if (e.key === 'Enter' && activeIdx >= 0) {
			e.preventDefault();
			selectCity(currentItems[activeIdx].dataset.city);
		} else if (e.key === 'Escape') {
			closeDropdown();
		}
	});

	// ── Input events ──────────────────────────────────────────────────────
	input.addEventListener('input', () => renderDropdown(input.value));
	input.addEventListener('focus', () => renderDropdown(input.value));

	// Close when clicking outside
	document.addEventListener('mousedown', e => {
		if (!input.closest('.search-autocomplete-wrap').contains(e.target)) {
			closeDropdown();
		}
	});
})();

// ===== EVENT LISTENERS =====
elements.form.addEventListener('submit', e => {
	e.preventDefault();
	const q = elements.cityInput.value.trim();
	// Close dropdown on submit
	document.getElementById('search-dropdown')?.setAttribute('hidden', '');
	elements.cityInput.classList.remove('dropdown-open');
	if(q) getWeatherByCity(q);
});

elements.geoBtn.addEventListener('click', () => {
	if(!navigator.geolocation) return alert('Geolocation not supported');
	navigator.geolocation.getCurrentPosition(pos => {
		getWeatherByCoords(pos.coords.latitude, pos.coords.longitude);
	}, err => alert('Geolocation error: ' + err.message));
});

// Handle chart resize
window.addEventListener('resize', () => {
	if (hourlyData.length === 0) return;
	const summaryPanel = document.getElementById('panel-summary');
	if (summaryPanel?.classList.contains('active')) renderSummaryChart(forecastList);
	const feelPanel = document.getElementById('panel-feellike');
	if (feelPanel?.classList.contains('active')) renderFeelLikeChart(forecastList);
});

// Toast notification utility (used by modals, share, city load)
function showNavToast(message){
	const existing = document.querySelector('.nav-toast');
	if(existing) existing.remove();
	const toast = document.createElement('div');
	toast.className = 'nav-toast';
	toast.textContent = message;
	document.body.appendChild(toast);
	requestAnimationFrame(() => toast.classList.add('show'));
	setTimeout(() => {
		toast.classList.remove('show');
		setTimeout(() => toast.remove(), 400);
	}, 2500);
}

// ============================================================
//  FEATURE: ANIMATED WEATHER BACKGROUND
// ============================================================

function isNightTime(weatherData) {
	const now = Math.floor(Date.now() / 1000);
	const tz = weatherData.timezone || 0;
	const localHour = new Date((now + tz) * 1000).getUTCHours();
	return localHour < 6 || localHour >= 19;
}

function updateWeatherBackground(weatherData) {
	const bg = document.getElementById('weather-bg');
	if (!bg) return;

	// Fade out old content
	bg.style.opacity = '0';

	setTimeout(() => {
		bg.innerHTML = '';
		bg.className = 'weather-bg';

		const cond = weatherData.weather[0].main.toLowerCase();
		const night = isNightTime(weatherData);

		if (night) {
			bg.classList.add('bg-night');
			// Moon
			const moon = document.createElement('div');
			moon.className = 'moon-orb';
			bg.appendChild(moon);
			// Stars
			for (let i = 0; i < 90; i++) {
				const star = document.createElement('div');
				star.className = 'star';
				const size = Math.random() * 2 + 0.8;
				star.style.cssText = [
					`left:${Math.random() * 100}%`,
					`top:${Math.random() * 75}%`,
					`width:${size}px`,
					`height:${size}px`,
					`animation-delay:${(Math.random() * 3).toFixed(2)}s`,
					`animation-duration:${(Math.random() * 2 + 1.5).toFixed(2)}s`
				].join(';');
				bg.appendChild(star);
			}
		} else if (cond.includes('thunder') || cond.includes('storm')) {
			bg.classList.add('bg-storm');
			// Heavy rain + lightning flash
			const flash = document.createElement('div');
			flash.className = 'lightning-flash';
			bg.appendChild(flash);
			spawnRaindrops(bg, 90, true);
		} else if (cond.includes('rain') || cond.includes('drizzle')) {
			bg.classList.add('bg-rain');
			spawnRaindrops(bg, 55, false);
		} else if (cond.includes('snow')) {
			bg.classList.add('bg-snow');
			const flakes = ['❄', '❅', '❆', '✦', '✧'];
			for (let i = 0; i < 38; i++) {
				const flake = document.createElement('div');
				flake.className = 'snowflake';
				flake.textContent = flakes[Math.floor(Math.random() * flakes.length)];
				flake.style.cssText = [
					`left:${Math.random() * 100}%`,
					`font-size:${(Math.random() * 10 + 8).toFixed(0)}px`,
					`animation-delay:${(Math.random() * 6).toFixed(2)}s`,
					`animation-duration:${(Math.random() * 3 + 4).toFixed(2)}s`,
					`opacity:${(Math.random() * 0.5 + 0.25).toFixed(2)}`
				].join(';');
				bg.appendChild(flake);
			}
		} else if (cond.includes('clear') || cond.includes('sunny')) {
			bg.classList.add('bg-sunny');
			// Sun orb with rotating rays
			const container = document.createElement('div');
			container.className = 'sun-container';
			const core = document.createElement('div');
			core.className = 'sun-core';
			const raysWrap = document.createElement('div');
			raysWrap.className = 'sun-rays';
			const RAY_COUNT = 8;
			for (let i = 0; i < RAY_COUNT; i++) {
				const ray = document.createElement('div');
				ray.className = 'sun-ray';
				ray.style.transform = `rotate(${i * (360 / RAY_COUNT)}deg)`;
				raysWrap.appendChild(ray);
			}
			container.appendChild(core);
			container.appendChild(raysWrap);
			bg.appendChild(container);
		} else if (cond.includes('cloud') || cond.includes('overcast')) {
			bg.classList.add('bg-cloudy');
			// Drifting cloud blobs
			for (let i = 0; i < 4; i++) {
				const cloud = document.createElement('div');
				cloud.className = 'cloud-shape';
				const w = 200 + Math.random() * 300;
				const h = 80 + Math.random() * 120;
				cloud.style.cssText = [
					`top:${5 + Math.random() * 45}%`,
					`width:${w}px`,
					`height:${h}px`,
					`animation-delay:${(Math.random() * 20).toFixed(0)}s`,
					`animation-duration:${(40 + Math.random() * 30).toFixed(0)}s`
				].join(';');
				bg.appendChild(cloud);
			}
		} else {
			// Mist / fog / haze — subtle clouds
			bg.classList.add('bg-mist');
			for (let i = 0; i < 3; i++) {
				const cloud = document.createElement('div');
				cloud.className = 'cloud-shape';
				cloud.style.cssText = [
					`top:${20 + Math.random() * 50}%`,
					`width:${300 + Math.random() * 250}px`,
					`height:${100 + Math.random() * 100}px`,
					`animation-delay:${(Math.random() * 15).toFixed(0)}s`,
					`animation-duration:${(50 + Math.random() * 30).toFixed(0)}s`,
					`opacity:0.04`
				].join(';');
				bg.appendChild(cloud);
			}
		}

		// Fade back in
		bg.style.opacity = '1';
	}, 300);
}

function spawnRaindrops(container, count, heavy) {
	for (let i = 0; i < count; i++) {
		const drop = document.createElement('div');
		drop.className = heavy ? 'raindrop heavy' : 'raindrop';
		const h = heavy ? (Math.random() * 14 + 10) : (Math.random() * 10 + 8);
		drop.style.cssText = [
			`left:${Math.random() * 100}%`,
			`height:${h.toFixed(0)}px`,
			`animation-delay:${(Math.random() * 2).toFixed(2)}s`,
			`animation-duration:${(Math.random() * 0.4 + (heavy ? 0.45 : 0.6)).toFixed(2)}s`,
			`opacity:${(Math.random() * 0.35 + 0.2).toFixed(2)}`
		].join(';');
		container.appendChild(drop);
	}
}

// ============================================================
//  FEATURE: MOOD BOARD
// ============================================================

const MOOD_PALETTES = {
	storm:   { swatches: ['#1a1a2e','#16213e','#0f3460','#7b2d8b'], vibe: 'Moody & Electric'     },
	rain:    { swatches: ['#0d1b2a','#1b4371','#2e6db4','#7eb2dd'], vibe: 'Cool & Contemplative' },
	drizzle: { swatches: ['#1a2a40','#2a5080','#3a80c0','#88b8e0'], vibe: 'Soft & Subdued'       },
	snow:    { swatches: ['#d0e8f0','#90c8e0','#50a0c8','#2070a0'], vibe: 'Crisp & Pure'         },
	hot:     { swatches: ['#ff6b35','#f7c59f','#fffacd','#004e89'], vibe: 'Warm & Intense'       },
	sunny:   { swatches: ['#ffd166','#06d6a0','#118ab2','#073b4c'], vibe: 'Bright & Uplifting'   },
	cloud:   { swatches: ['#6b7c93','#8898aa','#aab7c4','#cfd7e0'], vibe: 'Soft & Overcast'      },
	night:   { swatches: ['#0a0e1a','#12182e','#1e2a45','#c9a227'], vibe: 'Still & Starlit'      },
	mist:    { swatches: ['#c5d5e5','#8fa8c8','#607898','#303850'], vibe: 'Hazy & Mysterious'    },
	default: { swatches: ['#3a7bd5','#3a6073','#00d2ff','#e0eafc'], vibe: 'Clear & Fresh'        }
};

function getMoodPalette(weatherData) {
	const cond = weatherData.weather[0].main.toLowerCase();
	const temp = weatherData.main.temp;
	if (isNightTime(weatherData))        return MOOD_PALETTES.night;
	if (cond.includes('thunder') || cond.includes('storm')) return MOOD_PALETTES.storm;
	if (cond.includes('rain'))            return MOOD_PALETTES.rain;
	if (cond.includes('drizzle'))         return MOOD_PALETTES.drizzle;
	if (cond.includes('snow'))            return MOOD_PALETTES.snow;
	if (cond.includes('mist') || cond.includes('fog') || cond.includes('haze')) return MOOD_PALETTES.mist;
	if (cond.includes('clear') || cond.includes('sunny')) {
		return temp >= 33 ? MOOD_PALETTES.hot : MOOD_PALETTES.sunny;
	}
	if (cond.includes('cloud') || cond.includes('overcast')) return MOOD_PALETTES.cloud;
	return MOOD_PALETTES.default;
}

function renderMoodBoard(weatherData) {
	const swatchContainer = document.getElementById('mood-swatches');
	const vibeText        = document.getElementById('mood-vibe-text');
	if (!swatchContainer || !vibeText) return;

	const palette = getMoodPalette(weatherData);
	swatchContainer.innerHTML = palette.swatches
		.map(c => `<div class="mood-swatch" style="background:${c}" title="${c}"></div>`)
		.join('');
	vibeText.textContent = palette.vibe;
}

// ============================================================
//  FEATURE: OUTFIT / ACTIVITY SUGGESTER
// ============================================================

function getOutfitSuggestion(weatherData) {
	const temp    = weatherData.main.temp;
	const feelsLike = weatherData.main.feels_like;
	const humidity  = weatherData.main.humidity;
	const cond      = weatherData.weather[0].main.toLowerCase();

	if (cond.includes('thunder') || cond.includes('storm')) {
		return {
			icon: '⛈️',
			clothes: 'Rain gear, rubber boots — stay dry',
			activities: ['🏠 Stay home', '🎮 Gaming', '🍳 Cook at home', '📺 Netflix night'],
			tip: 'Best to stay indoors. Dangerous driving conditions — reschedule outdoor plans.'
		};
	}

	if (cond.includes('rain')) {
		return {
			icon: '🌧️',
			clothes: 'Waterproof jacket, closed shoes, umbrella',
			activities: ['☕ Coffee shop', '🎬 Cinema', '📚 Read indoors', '🛍️ Mall day'],
			tip: 'Tuck your gadgets in a waterproof bag. Great day for a warm drink and a book.'
		};
	}

	if (cond.includes('drizzle')) {
		return {
			icon: '🌦️',
			clothes: 'Light jacket, bring a small foldable umbrella',
			activities: ['☕ Café hopping', '🖼️ Museum', '🛍️ Mall', '🎨 Creative work'],
			tip: 'Drizzle can surprise you — toss a small umbrella in your bag just in case.'
		};
	}

	if (cond.includes('snow')) {
		return {
			icon: '❄️',
			clothes: 'Heavy coat, scarf, gloves, waterproof boots',
			activities: ['⛷️ Snow activities', '🏠 Cozy indoors', '🍵 Hot drinks', '📸 Snow photos'],
			tip: 'Layer up! Keep extremities covered — frostbite risk if windchill is severe.'
		};
	}

	// Temperature-based
	const effectiveTemp = feelsLike;

	if (effectiveTemp >= 37) {
		return {
			icon: '🥵',
			clothes: 'Lightest cotton you own, hat, SPF 50+ sunscreen',
			activities: ['🏊 Pool or beach', '🛍️ Air-conditioned mall', '🧋 Drinks run', '🏠 Stay cool inside'],
			tip: 'Drink water every 20–30 minutes. Avoid going out 11AM–3PM — peak heat danger zone.'
		};
	}

	if (effectiveTemp >= 33) {
		return {
			icon: '☀️',
			clothes: 'Breathable shirt, shorts or linen pants, sunglasses',
			activities: ['🌊 Beach day', '🚴 Morning ride', '🧃 Outdoor café', '📸 Photography'],
			tip: 'Go out early morning or after 4PM for the best outdoor experience. Stay hydrated!'
		};
	}

	if (effectiveTemp >= 27) {
		return {
			icon: '🌤️',
			clothes: 'Comfortable casual wear — no heavy layers needed',
			activities: ['🏃 Jogging', '🌳 Park walk', '🥗 Picnic', '🚶 City exploring'],
			tip: 'Perfect weather for being outside. Light moisturizer with SPF is enough today.'
		};
	}

	if (effectiveTemp >= 20) {
		return {
			icon: '🧥',
			clothes: 'Light long-sleeve or a shirt with a jacket handy',
			activities: ['☕ Café work session', '🧘 Outdoor yoga', '🎨 Art visit', '🚶 Walking tour'],
			tip: 'Dress in layers — it may feel cooler in the shade or as the evening approaches.'
		};
	}

	if (effectiveTemp >= 13) {
		return {
			icon: '🧣',
			clothes: 'Sweater or hoodie, long pants, light scarf',
			activities: ['📖 Bookshop browsing', '🍲 Hot meal out', '🎭 Indoor events', '🎬 Movie night'],
			tip: 'Comfortable but keep something warm for the evening — temps will drop further.'
		};
	}

	return {
		icon: '🥶',
		clothes: 'Winter coat, thermal underlayer, hat and gloves',
		activities: ['🏠 Indoor activities', '🍜 Warm restaurants', '☕ Hot drinks', '🎶 Indoor music'],
		tip: 'Bundle up before heading out. Wind chill can make it feel significantly colder.'
	};
}

function renderOutfitPanel(weatherData) {
	const panel = document.getElementById('outfit-content');
	if (!panel || !weatherData) return;

	const outfit = getOutfitSuggestion(weatherData);
	const temp   = toDisplay(weatherData.main.temp);
	const feels  = toDisplay(weatherData.main.feels_like);

	panel.innerHTML = `
		<div class="outfit-hero">
			<div class="outfit-icon-large">${outfit.icon}</div>
			<div>
				<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">
					${temp}${unitLabel()} · Feels like ${feels}${unitLabel()}
				</div>
				<div class="outfit-clothes-text">${outfit.clothes}</div>
			</div>
		</div>
		<div class="outfit-activities">
			<div class="outfit-activities-label">🎯 Best Activities Today</div>
			<div class="activity-chips">
				${outfit.activities.map(a => `<span class="activity-chip">${a}</span>`).join('')}
			</div>
		</div>
		<div class="outfit-tip-bar">
			<span class="tip-icon">💡</span>
			<span>${outfit.tip}</span>
		</div>
	`;
}

// ============================================================
//  FEATURE: SHARE AS IMAGE CARD
// ============================================================

function shareWeatherCard() {
	if (!currentWeatherData) {
		showNavToast('⚠️ Load weather data first');
		return;
	}

	const d      = currentWeatherData;
	const canvas = document.createElement('canvas');
	const W = 600, H = 340;
	canvas.width  = W * 2; // retina
	canvas.height = H * 2;
	canvas.style.width  = W + 'px';
	canvas.style.height = H + 'px';
	const ctx = canvas.getContext('2d');
	ctx.scale(2, 2);

	// Background gradient
	const grad = ctx.createLinearGradient(0, 0, W, H);
	grad.addColorStop(0, '#1e3a8a');
	grad.addColorStop(0.55, '#0f172a');
	grad.addColorStop(1, '#1a1f35');
	ctx.fillStyle = grad;
	ctx.roundRect(0, 0, W, H, 20);
	ctx.fill();

	// Subtle dot grid
	ctx.fillStyle = 'rgba(255,255,255,0.025)';
	for (let x = 20; x < W; x += 22) {
		for (let y = 20; y < H; y += 22) {
			ctx.beginPath();
			ctx.arc(x, y, 1.2, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	// Mood accent strip (left edge)
	const palette = getMoodPalette(d);
	const stripGrad = ctx.createLinearGradient(0, 0, 0, H);
	palette.swatches.forEach((c, i) => stripGrad.addColorStop(i / (palette.swatches.length - 1), c + 'aa'));
	ctx.fillStyle = stripGrad;
	ctx.fillRect(0, 0, 5, H);

	// Right decorative circle
	const circleGrad = ctx.createRadialGradient(W - 60, 60, 10, W - 60, 60, 120);
	circleGrad.addColorStop(0, 'rgba(110,231,183,0.12)');
	circleGrad.addColorStop(1, 'rgba(110,231,183,0)');
	ctx.fillStyle = circleGrad;
	ctx.fillRect(0, 0, W, H);

	// Large weather emoji
	ctx.font = '72px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", serif';
	ctx.textAlign = 'left';
	ctx.fillText(getWeatherEmoji(d.weather[0].main), 28, 110);

	// Temperature
	ctx.fillStyle = '#ffffff';
	ctx.font = 'bold 80px -apple-system, BlinkMacSystemFont, sans-serif';
	ctx.fillText(formatTemp(d.main.temp), 28, 205);

	// City
	ctx.fillStyle = 'rgba(255,255,255,0.85)';
	ctx.font = '500 20px -apple-system, BlinkMacSystemFont, sans-serif';
	ctx.fillText(`${d.name}, ${d.sys.country}`, 28, 237);

	// Condition
	ctx.fillStyle = '#6ee7b7';
	ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
	ctx.fillText(d.weather[0].description.replace(/\b\w/g, c => c.toUpperCase()), 28, 263);

	// Right column stats
	const outfit = getOutfitSuggestion(d);
	ctx.textAlign = 'right';

	// Feels like
	ctx.fillStyle = 'rgba(255,255,255,0.5)';
	ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
	ctx.fillText('Feels like', W - 30, 120);
	ctx.fillStyle = 'rgba(255,255,255,0.9)';
	ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, sans-serif';
	ctx.fillText(formatTemp(d.main.feels_like), W - 30, 146);

	// Humidity + wind
	ctx.fillStyle = 'rgba(255,255,255,0.5)';
	ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
	ctx.fillText(`💧 ${d.main.humidity}%   💨 ${Math.round(d.wind.speed)} m/s`, W - 30, 185);

	// Outfit tip (truncated)
	const tipText = outfit.clothes.length > 38 ? outfit.clothes.slice(0, 38) + '…' : outfit.clothes;
	ctx.fillStyle = 'rgba(255,255,255,0.4)';
	ctx.font = 'italic 12px -apple-system, BlinkMacSystemFont, sans-serif';
	ctx.fillText(`👕 ${tipText}`, W - 30, 210);

	// Vibe label
	ctx.fillStyle = 'rgba(110,231,183,0.6)';
	ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
	ctx.fillText(palette.vibe, W - 30, 240);

	// Divider line
	ctx.strokeStyle = 'rgba(255,255,255,0.1)';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(28, 285);
	ctx.lineTo(W - 28, 285);
	ctx.stroke();

	// Bottom: date (left) + branding (right)
	const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
	ctx.textAlign = 'left';
	ctx.fillStyle = 'rgba(255,255,255,0.35)';
	ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
	ctx.fillText(dateStr, 28, 315);

	ctx.textAlign = 'right';
	ctx.fillStyle = 'rgba(110,231,183,0.5)';
	ctx.font = '600 12px -apple-system, BlinkMacSystemFont, sans-serif';
	ctx.fillText('Weather Dashboard', W - 28, 315);

	// Trigger download
	const link = document.createElement('a');
	link.download = `weather-${d.name.toLowerCase().replace(/\s+/g,'-')}.png`;
	link.href = canvas.toDataURL('image/png');
	link.click();

	showNavToast('📸 Weather card saved!');
}

// Share button listener
document.getElementById('share-btn')?.addEventListener('click', shareWeatherCard);

// ============================================================
//  FEATURE 5: FEEL LIKE TIMELINE CHART
// ============================================================

function renderFeelLikeChart(list) {
	const panel = document.getElementById('panel-feellike');
	if (!panel) return;

	// Always re-inject legend
	const existingLegend = document.getElementById('feellike-legend');
	if (existingLegend) existingLegend.remove();
	const legend = document.createElement('div');
	legend.id = 'feellike-legend';
	legend.className = 'feellike-legend';
	legend.innerHTML = `
		<div class="legend-item"><div class="legend-dot" style="background:#6ee7b7"></div> Actual Temp</div>
		<div class="legend-item"><div class="legend-dot" style="background:#f97316"></div> Feels Like</div>
		<div class="legend-item"><div class="legend-dot" style="background:#60a5fa;border-radius:2px;height:3px;margin-top:4px;"></div> Humidity %</div>
	`;
	panel.insertBefore(legend, panel.firstChild);

	const canvas = document.getElementById('feellike-canvas');
	const container = document.getElementById('feellike-chart');
	if (!canvas || !container) return;

	// If the panel is hidden, defer rendering until it becomes active
	if (!panel.classList.contains('active')) {
		panel._needsRender = list;
		return;
	}
	panel._needsRender = null;

	const entries = list.slice(0, 8);
	const ctx = canvas.getContext('2d');
	const dpr = window.devicePixelRatio || 1;

	// Reset to 0 BEFORE measuring so the canvas never inflates the container rect
	canvas.width = 0;
	canvas.height = 0;

	const W = container.offsetWidth;
	const H = container.offsetHeight;
	if (W === 0 || H === 0) return;

	canvas.width = W * dpr;
	canvas.height = H * dpr;
	ctx.scale(dpr, dpr);
	ctx.clearRect(0, 0, W, H);

	if (entries.length === 0) return;

	const temps     = entries.map(e => e.main.temp);
	const feelsLike = entries.map(e => e.main.feels_like);
	const humidity  = entries.map(e => e.main.humidity);
	const labels    = entries.map(e => formatTime(e.dt));

	const allTemps = [...temps, ...feelsLike];
	const minT = Math.min(...allTemps) - 3;
	const maxT = Math.max(...allTemps) + 3;

	const padL = 50, padR = 52, padT = 28, padB = 38;
	const plotW = W - padL - padR;
	const plotH = H - padT - padB;

	function xPos(i) { return padL + (i / (entries.length - 1)) * plotW; }
	function yPos(t) { return padT + (1 - (t - minT) / (maxT - minT)) * plotH; }

	// Grid lines
	ctx.strokeStyle = 'rgba(255,255,255,0.07)';
	ctx.lineWidth = 1;
	for (let i = 0; i <= 4; i++) {
		const t = minT + (maxT - minT) * (i / 4);
		const y = yPos(t);
		ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
		ctx.fillStyle = 'rgba(255,255,255,0.45)';
		ctx.font = '10px Inter, sans-serif';
		ctx.textAlign = 'right';
		ctx.fillText(`${Math.round(t)}°`, padL - 6, y + 4);
	}

	// Humidity bars (background, right axis)
	const barW = Math.max(6, plotW / entries.length - 4);
	humidity.forEach((h, i) => {
		const barH = (h / 100) * plotH;
		const x = xPos(i) - barW / 2;
		const y = padT + plotH - barH;
		ctx.fillStyle = 'rgba(96,165,250,0.13)';
		ctx.beginPath();
		ctx.roundRect(x, y, barW, barH, 3);
		ctx.fill();
	});
	// Humidity axis labels (right)
	ctx.fillStyle = 'rgba(96,165,250,0.55)';
	ctx.font = '9px Inter, sans-serif';
	ctx.textAlign = 'left';
	ctx.fillText('100%', W - padR + 5, padT + 4);
	ctx.fillText('0%',   W - padR + 5, padT + plotH + 4);

	// Helper to draw a smooth line with gradient fill
	function drawLine(dataArr, color, fillColor) {
		const grad = ctx.createLinearGradient(0, padT, 0, H - padB);
		grad.addColorStop(0, fillColor + '44');
		grad.addColorStop(1, fillColor + '05');

		ctx.beginPath();
		ctx.moveTo(xPos(0), yPos(dataArr[0]));
		for (let i = 1; i < dataArr.length; i++) {
			const cx = (xPos(i-1) + xPos(i)) / 2;
			ctx.bezierCurveTo(cx, yPos(dataArr[i-1]), cx, yPos(dataArr[i]), xPos(i), yPos(dataArr[i]));
		}
		ctx.lineTo(xPos(dataArr.length - 1), H - padB);
		ctx.lineTo(xPos(0), H - padB);
		ctx.closePath();
		ctx.fillStyle = grad;
		ctx.fill();

		ctx.beginPath();
		ctx.moveTo(xPos(0), yPos(dataArr[0]));
		for (let i = 1; i < dataArr.length; i++) {
			const cx = (xPos(i-1) + xPos(i)) / 2;
			ctx.bezierCurveTo(cx, yPos(dataArr[i-1]), cx, yPos(dataArr[i]), xPos(i), yPos(dataArr[i]));
		}
		ctx.strokeStyle = color;
		ctx.lineWidth = 2.5;
		ctx.stroke();

		dataArr.forEach((t, i) => {
			ctx.beginPath();
			ctx.arc(xPos(i), yPos(t), 4, 0, Math.PI * 2);
			ctx.fillStyle = color;
			ctx.fill();
			ctx.strokeStyle = '#0f172a';
			ctx.lineWidth = 2;
			ctx.stroke();
		});
	}

	drawLine(feelsLike, '#f97316', '#f97316');
	drawLine(temps,     '#6ee7b7', '#6ee7b7');

	// Delta annotation between the two lines
	entries.forEach((e, i) => {
		const diff = Math.round(feelsLike[i] - temps[i]);
		if (diff !== 0) {
			const midY = (yPos(temps[i]) + yPos(feelsLike[i])) / 2;
			ctx.fillStyle = diff > 0 ? 'rgba(249,115,22,0.7)' : 'rgba(96,165,250,0.7)';
			ctx.font = 'bold 9px Inter, sans-serif';
			ctx.textAlign = 'center';
			ctx.fillText(`${diff > 0 ? '+' : ''}${diff}°`, xPos(i) + 10, midY);
		}
	});

	// X-axis labels
	ctx.fillStyle = 'rgba(255,255,255,0.45)';
	ctx.font = '10px Inter, sans-serif';
	ctx.textAlign = 'center';
	labels.forEach((lbl, i) => ctx.fillText(lbl, xPos(i), H - padB + 16));

	// Chart title
	ctx.fillStyle = 'rgba(255,255,255,0.35)';
	ctx.font = '11px Inter, sans-serif';
	ctx.textAlign = 'left';
	ctx.fillText('Actual vs Feels Like · next 24h', padL, padT - 10);
}

// ============================================================
//  FEATURE 7: WEATHER ALERTS IN PLAIN LANGUAGE
// ============================================================

// ============================================================
//  ALERT SYSTEM  — session-aware, signature-gated, per-city
// ============================================================

// Dismissal storage: keys are `${city}::${alertKey}` in sessionStorage
// Signature tracks what's currently rendered so we skip silent re-renders
const DISMISSED_ALERTS_KEY = 'weather_dismissed_alerts_v2';
let   _currentAlertSignature = '';   // city::key1,key2,… of what's in the DOM right now

// Emergency alerts always re-show on refresh even if previously dismissed.
// Non-emergency alerts stick dismissed for the whole session.
const EMERGENCY_ALERT_KEYS = new Set([
	'thunderstorm', 'heavy-rain', 'strong-wind', 'extreme-heat', 'very-low-vis'
]);

function _getDismissed() {
	try { return new Set(JSON.parse(sessionStorage.getItem(DISMISSED_ALERTS_KEY) || '[]')); }
	catch { return new Set(); }
}

function _saveDismissed(set) {
	sessionStorage.setItem(DISMISSED_ALERTS_KEY, JSON.stringify([...set]));
}

function _dismissKey(city, alertKey) { return `${city}::${alertKey}`; }

function _isDismissed(city, alertKey) {
	// Emergency alerts are never permanently dismissed — always re-show
	if (EMERGENCY_ALERT_KEYS.has(alertKey)) return false;
	return _getDismissed().has(_dismissKey(city, alertKey));
}

function _rememberDismissed(city, alertKey) {
	if (EMERGENCY_ALERT_KEYS.has(alertKey)) return; // don't persist emergency dismissals
	const d = _getDismissed();
	d.add(_dismissKey(city, alertKey));
	_saveDismissed(d);
}

function _dismissAllForCity(city, keys) {
	const d = _getDismissed();
	keys.filter(k => !EMERGENCY_ALERT_KEYS.has(k)).forEach(k => d.add(_dismissKey(city, k)));
	_saveDismissed(d);
}

// ── Build alert list from weather data ───────────────────────────────────────
function generatePlainAlerts(weatherData, forecastList) {
	const city    = weatherData.name;
	const cond    = weatherData.weather[0].main.toLowerCase();
	const desc    = weatherData.weather[0].description.toLowerCase();
	const feelsLk = weatherData.main.feels_like;
	const wind    = weatherData.wind.speed;
	const humidity = weatherData.main.humidity;
	const vis     = weatherData.visibility / 1000;

	// Build ALL candidate alerts for current conditions
	const candidates = [];

	if (cond.includes('thunder') || cond.includes('storm')) {
		candidates.push({ key: 'thunderstorm', severity: 'danger', icon: '⛈️',
			title: 'Thunderstorm Warning',
			text: 'Active thunderstorm — avoid open spaces and trees. Dangerous for driving. Stay indoors until conditions improve.' });
	}
	if (cond.includes('rain') && (desc.includes('heavy') || desc.includes('extreme'))) {
		candidates.push({ key: 'heavy-rain', severity: 'danger', icon: '🌧️',
			title: 'Heavy Rain Advisory',
			text: 'Heavy rain — expect flooded streets and reduced visibility. Waterproof your bag, wear rubber shoes, allow extra travel time.' });
	}
	if (cond.includes('drizzle') || (cond.includes('rain') && desc.includes('light'))) {
		candidates.push({ key: 'light-rain', severity: 'info', icon: '☂️',
			title: 'Light Rain — Bring an Umbrella',
			text: "Patchy drizzle through the day. Toss a foldable umbrella in your bag — it'll save you more than once today." });
	}
	if (wind > 14) {
		candidates.push({ key: 'strong-wind', severity: 'danger', icon: '💨',
			title: 'Strong Wind Warning',
			text: `Winds at ${Math.round(wind)} m/s — secure loose items outside. Avoid parking under trees or old structures.` });
	} else if (wind > 9) {
		candidates.push({ key: 'breezy', severity: 'warning', icon: '🌬️',
			title: 'Breezy Conditions',
			text: `Gusts up to ${Math.round(wind)} m/s. Umbrella users beware — yours might flip. Hold on to lightweight items.` });
	}
	if (feelsLk >= 40) {
		candidates.push({ key: 'extreme-heat', severity: 'danger', icon: '🥵',
			title: 'Extreme Heat Advisory',
			text: `Feels like ${formatTemp(feelsLk)} — dangerous heat index. Avoid going out 10AM–4PM. Drink water every 20 minutes.` });
	} else if (feelsLk >= 35) {
		candidates.push({ key: 'hot-day', severity: 'warning', icon: '☀️',
			title: 'Hot Day Ahead',
			text: `Feels like ${formatTemp(feelsLk)} — light clothing, SPF 30+, stay hydrated. Limit midday outdoor activity.` });
	}
	if (humidity >= 88 && !cond.includes('rain') && !cond.includes('storm')) {
		candidates.push({ key: 'high-humidity', severity: 'warning', icon: '💦',
			title: 'High Humidity Alert',
			text: `Humidity at ${humidity}% — mild activity will feel exhausting. Moisture-wicking fabrics; take AC breaks.` });
	}
	if (vis < 1) {
		candidates.push({ key: 'very-low-vis', severity: 'danger', icon: '🌫️',
			title: 'Very Low Visibility',
			text: `Visibility only ${vis.toFixed(1)} km — hazardous driving. Use fog lights, slow down, avoid highways.` });
	} else if (vis < 3) {
		candidates.push({ key: 'low-vis', severity: 'warning', icon: '👁️',
			title: 'Reduced Visibility',
			text: `~${vis.toFixed(1)} km visibility due to ${desc}. Extra following distance; headlights on even daytime.` });
	}
	if (!cond.includes('rain') && !cond.includes('storm') && forecastList.length > 0) {
		const rainSoon = forecastList.slice(0, 4).find(i => i.weather[0].main.toLowerCase().includes('rain'));
		if (rainSoon) {
			candidates.push({ key: 'rain-later', severity: 'info', icon: '🌦️',
				title: 'Rain Expected Later',
				text: `Currently dry but rain is forecast around ${formatTime(rainSoon.dt)}. Bring an umbrella — you'll thank yourself on the way back.` });
		}
	}

	// ── Signature check: skip re-render if exact same set is already showing ──
	const allKeys  = candidates.map(a => a.key).sort().join(',');
	const signature = `${city}::${allKeys}`;
	if (signature === _currentAlertSignature) return; // nothing changed — leave DOM alone

	// ── Filter out session-dismissed non-emergency alerts ────────────────────
	const visible = candidates.filter(a => !_isDismissed(city, a.key));

	// ── Decide whether to animate (new city or new alert types) ─────────────
	const prevCity = _currentAlertSignature.split('::')[0];
	const quiet    = (prevCity === city); // same city → quiet update, no slide-in

	_currentAlertSignature = signature;
	renderAlertsBanner(visible, city, quiet);
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderAlertsBanner(alerts, city, quiet = false) {
	const banner = document.getElementById('alerts-banner');
	if (!banner) return;

	if (alerts.length === 0) {
		banner.style.display = 'none';
		banner.innerHTML = '';
		return;
	}

	banner.style.display = 'flex';

	// Build rows (no animation-delay when quiet)
	const rows = alerts.map((a, i) => `
		<div class="alert-item severity-${a.severity}${quiet ? ' alert-no-anim' : ''}"
		     ${quiet ? '' : `style="animation-delay:${i * 0.07}s"`}
		     data-alert-key="${a.key}">
			<span class="alert-icon">${a.icon}</span>
			<div class="alert-body">
				<div class="alert-title">${a.title}</div>
				<div class="alert-text">${a.text}</div>
			</div>
			<button type="button" class="alert-dismiss" title="Dismiss" aria-label="Dismiss alert">✕</button>
		</div>
	`).join('');

	// "Dismiss all" toolbar when 2+ alerts
	const toolbar = alerts.length >= 2
		? `<div class="alert-toolbar">
			<button type="button" class="alerts-dismiss-all" data-dismiss-all>
				Dismiss all for ${city}
			</button>
		   </div>`
		: '';

	banner.innerHTML = toolbar + rows;

	// Per-alert dismiss
	banner.querySelectorAll('.alert-dismiss').forEach(btn => {
		btn.addEventListener('click', () => {
			const item = btn.closest('.alert-item');
			const key  = item?.dataset.alertKey;
			if (key && city) _rememberDismissed(city, key);
			item?.remove();
			if (!banner.querySelector('.alert-item')) {
				banner.style.display = 'none';
				banner.innerHTML     = '';
			}
			// Remove toolbar if only 1 left
			if (banner.querySelectorAll('.alert-item').length < 2) {
				banner.querySelector('.alert-toolbar')?.remove();
			}
		});
	});

	// Dismiss all
	banner.querySelector('[data-dismiss-all]')?.addEventListener('click', () => {
		const keys = [...banner.querySelectorAll('.alert-item')].map(el => el.dataset.alertKey).filter(Boolean);
		_dismissAllForCity(city, keys);
		banner.style.display = 'none';
		banner.innerHTML     = '';
	});
}

async function getWeatherByCity(city) {
	if (!ensureApiKey()) return;
	setLoading();
	_currentAlertSignature = ''; // reset so new city always evaluates alerts fresh
	try {
		const curUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${API_KEY}`;
		const cur = await fetchJSON(curUrl);
		const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&units=metric&appid=${API_KEY}`;
		const f = await fetchJSON(forecastUrl);
		currentWeatherData = cur;
		forecastList = f.list;
		hourlyData = f.list.slice(0, 8);
		renderCurrent(cur);
		renderForecast7Days(f.list, activeForecastDays);
		renderSummaryChart(f.list);
		renderHourlyList(f.list);
		renderMoreDetails(cur, f.list);
		renderFeelLikeChart(f.list);
		updateMap(cur.coord.lat, cur.coord.lon);
		generateAISummary(cur, f.list);
		updatePopularCities();
		fetchUVIndex(cur.coord.lat, cur.coord.lon).then(renderUVIndex);
	} catch (err) {
		alert('Error: ' + err.message);
		elements.temp.textContent = '--';
		elements.desc.textContent = '--';
		setAISummary('AI summary unavailable.', false);
	} finally {
		clearLoading();
	}
}

async function getWeatherByCoords(lat, lon) {
	if (!ensureApiKey()) return;
	setLoading();
	_currentAlertSignature = ''; // reset so location change always re-evaluates alerts
	try {
		const curUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`;
		const cur = await fetchJSON(curUrl);
		const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`;
		const f = await fetchJSON(forecastUrl);
		currentWeatherData = cur;
		forecastList = f.list;
		hourlyData = f.list.slice(0, 8);
		renderCurrent(cur);
		renderForecast7Days(f.list, activeForecastDays);
		renderSummaryChart(f.list);
		renderHourlyList(f.list);
		renderMoreDetails(cur, f.list);
		renderFeelLikeChart(f.list);
		updateMap(lat, lon);
		generateAISummary(cur, f.list);
		updatePopularCities();
		fetchUVIndex(lat, lon).then(renderUVIndex);
	} catch (err) {
		alert('Error: ' + err.message);
		setAISummary('AI summary unavailable.', false);
	} finally {
		clearLoading();
	}
}

let pinnedCities = [];

const compareModal   = document.getElementById('compare-modal');
const compareOverlay = document.getElementById('compare-overlay');
const compareClose   = document.getElementById('compare-close');
const compareAddBtn  = document.getElementById('compare-add-btn');
const compareCityInput = document.getElementById('compare-city-input');
const compareGrid    = document.getElementById('compare-grid');

document.getElementById('compare-btn')?.addEventListener('click', openCompareModal);
compareOverlay?.addEventListener('click', closeCompareModal);
compareClose?.addEventListener('click', closeCompareModal);
compareAddBtn?.addEventListener('click', addCompareCity);
compareCityInput?.addEventListener('keydown', e => { if (e.key === 'Enter') addCompareCity(); });

function openCompareModal() {
	compareModal.style.display = 'flex';
	document.body.style.overflow = 'hidden';
	compareCityInput.focus();
	renderCompareGrid();
}

function closeCompareModal() {
	compareModal.style.display = 'none';
	document.body.style.overflow = '';
}

async function addCompareCity() {
	const city = compareCityInput.value.trim();
	if (!city) return;
	if (pinnedCities.length >= 3) {
		showNavToast('⚖️ Max 3 cities — remove one first');
		return;
	}
	const already = pinnedCities.find(c => c.name?.toLowerCase() === city.toLowerCase());
	if (already) { showNavToast('📍 City already pinned'); return; }

	compareCityInput.value = '';
	compareAddBtn.disabled = true;

	// Add a loading placeholder card
	const tempId = 'loading-' + Date.now();
	const tempDiv = document.createElement('div');
	tempDiv.className = 'compare-card';
	tempDiv.id = tempId;
	tempDiv.innerHTML = `<div class="compare-card-loading">Loading ${city}…</div>`;
	if (compareGrid.querySelector('.compare-empty')) compareGrid.innerHTML = '';
	compareGrid.appendChild(tempDiv);

	try {
		const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${API_KEY}`;
		const data = await fetchJSON(url);
		pinnedCities.push(data);
		document.getElementById(tempId)?.remove();
		renderCompareGrid();
	} catch (err) {
		document.getElementById(tempId)?.remove();
		showNavToast(`❌ "${city}" not found`);
	} finally {
		compareAddBtn.disabled = false;
	}
}

function removeCompareCity(index) {
	pinnedCities.splice(index, 1);
	renderCompareGrid();
}

function calcOutdoorScore(data){
	// Score 0–100: higher = better outdoor conditions
	const temp    = data.main.feels_like;
	const humid   = data.main.humidity;
	const wind    = data.wind.speed;
	const vis     = data.visibility / 1000;
	const cond    = data.weather[0].main.toLowerCase();

	// Temp score: ideal 22-30°C
	const tempScore = temp < 10 ? 10 : temp > 38 ? 5 :
		temp >= 22 && temp <= 30 ? 100 :
		temp < 22 ? 50 + (temp - 10) * 4 :
		100 - (temp - 30) * 10;

	// Humidity score: ideal <65%
	const humidScore = humid < 65 ? 100 : humid < 80 ? 70 : humid < 90 ? 40 : 15;

	// Wind score: ideal <7 m/s
	const windScore = wind < 7 ? 100 : wind < 12 ? 60 : wind < 18 ? 25 : 5;

	// Condition penalty
	const condPenalty = (cond.includes('thunder') || cond.includes('storm')) ? 0.05 :
		cond.includes('rain') ? 0.35 :
		cond.includes('drizzle') ? 0.6 :
		cond.includes('snow') ? 0.5 : 1;

	// Visibility score
	const visScore = vis >= 5 ? 100 : vis >= 2 ? 60 : 20;

	const raw = (tempScore * 0.35 + humidScore * 0.25 + windScore * 0.2 + visScore * 0.2) * condPenalty;
	return Math.round(Math.max(0, Math.min(100, raw)));
}

function scoreLabel(score){
	if(score >= 80) return { text:'Great day out 🌟', color:'#22c55e' };
	if(score >= 60) return { text:'Good outdoors 👍', color:'#84cc16' };
	if(score >= 40) return { text:'Tolerable 😐',     color:'#eab308' };
	if(score >= 20) return { text:'Stay covered ☂️',  color:'#f97316' };
	return              { text:'Stay indoors 🏠',     color:'#ef4444' };
}

function renderCompareGrid() {
	if (!compareGrid) return;
	if (pinnedCities.length === 0) {
		compareGrid.innerHTML = '<div class="compare-empty">Add cities above to start comparing</div>';
		return;
	}

	// Find best/worst values for highlights
	const highestTemp  = Math.max(...pinnedCities.map(c => c.main.temp));
	const lowestTemp   = Math.min(...pinnedCities.map(c => c.main.temp));
	const lowestWind   = Math.min(...pinnedCities.map(c => c.wind.speed));

	compareGrid.innerHTML = '';
	pinnedCities.forEach((data, i) => {
		const palette = getMoodPalette(data);
		const emoji   = getWeatherEmoji(data.weather[0].main);
		const temp    = formatTemp(data.main.temp);
		const feels   = formatTemp(data.main.feels_like);
		const isBest  = data.main.temp === highestTemp && pinnedCities.length > 1;
		const isCool  = data.main.temp === lowestTemp  && pinnedCities.length > 1;
		const score   = calcOutdoorScore(data);
		const { text: scoreText, color: scoreColor } = scoreLabel(score);

		const card = document.createElement('div');
		card.className = 'compare-card';
		card.style.animationDelay = `${i * 0.08}s`;

		if (isBest) card.style.borderColor = 'rgba(249,115,22,0.35)';
		if (isCool) card.style.borderColor = 'rgba(96,165,250,0.35)';

		card.innerHTML = `
			<button class="compare-card-remove" onclick="removeCompareCity(${i})" title="Remove">✕</button>
			<div class="compare-card-top">
				<div>
					<div class="compare-card-city">${data.name}</div>
					<div class="compare-card-country">${data.sys.country}</div>
				</div>
				<div class="compare-card-emoji">${emoji}</div>
			</div>
			<div class="compare-card-temp">${temp}</div>
			<div class="compare-card-desc">${data.weather[0].description}</div>
			<div class="compare-card-stats">
				<div class="compare-stat">
					<div class="compare-stat-label">🌡️ Feels Like</div>
					<div class="compare-stat-value">${feels}</div>
				</div>
				<div class="compare-stat">
					<div class="compare-stat-label">💧 Humidity</div>
					<div class="compare-stat-value">${data.main.humidity}%</div>
				</div>
				<div class="compare-stat">
					<div class="compare-stat-label">💨 Wind</div>
					<div class="compare-stat-value">${Math.round(data.wind.speed)} m/s</div>
				</div>
				<div class="compare-stat">
					<div class="compare-stat-label">👁️ Visibility</div>
					<div class="compare-stat-value">${(data.visibility/1000).toFixed(1)} km</div>
				</div>
			</div>
			<div class="compare-outdoor-score">
				<div class="outdoor-score-bar-track">
					<div class="outdoor-score-bar-fill" style="width:${score}%;background:${scoreColor}"></div>
				</div>
				<div class="outdoor-score-label" style="color:${scoreColor}">${scoreText} <span class="outdoor-score-num">${score}/100</span></div>
			</div>
			<div class="compare-mood-strip">
				${palette.swatches.map(c => `<div class="compare-mood-dot" style="background:${c}"></div>`).join('')}
				<span class="compare-mood-vibe">${palette.vibe}</span>
			</div>
			${isBest ? '<div style="font-size:10px;color:#f97316;margin-top:8px;font-weight:700;">🔥 Hottest</div>' : ''}
			${isCool ? '<div style="font-size:10px;color:#60a5fa;margin-top:8px;font-weight:700;">❄️ Coolest</div>' : ''}
		`;
		compareGrid.appendChild(card);
	});
}

// ── UNIT TOGGLE HANDLER ───────────────────────────────────────────────────────
document.getElementById('unit-toggle')?.addEventListener('click', () => {
	tempUnit = tempUnit === 'C' ? 'F' : 'C';
	const btn = document.getElementById('unit-toggle');
	btn.textContent = tempUnit === 'C' ? '°C / °F' : '°F / °C';
	btn.classList.toggle('active', tempUnit === 'F');
	// Re-render all temperature displays without a new API call
	updateTempUnitDisplay();
	if (currentWeatherData) {
		elements.temp.textContent = `${toDisplay(currentWeatherData.main.temp)}`;
		renderForecast7Days(forecastList, activeForecastDays);
		renderHourlyList(forecastList);
		renderMoreDetails(currentWeatherData, forecastList);
		renderOutfitPanel(currentWeatherData);
		// NOTE: alerts intentionally NOT re-generated here — unit change must not re-show dismissed alerts
		updatePopularCities();
		if (pinnedCities.length > 0) renderCompareGrid();
		const activePanel = document.querySelector('.summary-panel.active');
		if (activePanel?.id === 'panel-summary') renderSummaryChart(forecastList);
		if (activePanel?.id === 'panel-feellike') renderFeelLikeChart(forecastList);
	}
	refreshCitiesModalTemps();
});

function refreshCitiesModalTemps() {
	if (!citiesModalOpen) return;
	document.querySelectorAll('.cities-modal-item[data-cache-key]').forEach(btn => {
		const data = citiesWeatherCache[btn.dataset.cacheKey];
		if (data) btn.innerHTML = buildCityCardHTML(data);
	});
}
// ─────────────────────────────────────────────────────────────────────────────

// Load a default city on startup
renderQuickAccess();

// ============================================================
//  SUNPATH ARC  (Sunrise / Sunset visual)
// ============================================================
function renderSunpathArc(cur, sunriseStr, sunsetStr) {
	const canvas = document.getElementById('sunpath-canvas');
	if (!canvas) return;

	const container = canvas.parentElement;
	const dpr = window.devicePixelRatio || 1;
	const W   = container.offsetWidth || 280;
	const H   = 110;

	canvas.width  = W * dpr;
	canvas.height = H * dpr;
	canvas.style.width  = W + 'px';
	canvas.style.height = H + 'px';

	const ctx = canvas.getContext('2d');
	ctx.scale(dpr, dpr);
	ctx.clearRect(0, 0, W, H);

	const cx = W / 2, cy = H - 14;
	const rx = W * 0.42, ry = H * 0.78;

	// Now vs sunrise/sunset positions
	const tz = cur.timezone || 0;
	const now = Math.floor(Date.now() / 1000);
	const rise = cur.sys.sunrise || (now - 21600);
	const set  = cur.sys.sunset  || (now + 21600);
	const dayLen = set - rise;
	const progress = Math.max(0, Math.min(1, (now - rise) / dayLen));

	// Arc background (dashed)
	ctx.beginPath();
	ctx.setLineDash([4, 5]);
	ctx.arc(cx, cy, (rx + ry) / 2, Math.PI, 0, false);
	ctx.strokeStyle = 'rgba(255,255,255,0.12)';
	ctx.lineWidth = 1.5;
	ctx.stroke();
	ctx.setLineDash([]);

	// Filled arc up to current sun position
	const startAngle = Math.PI;
	const endAngle   = Math.PI + progress * Math.PI;

	const grad = ctx.createLinearGradient(cx - rx, cy, cx + rx, cy);
	grad.addColorStop(0, 'rgba(251,191,36,0.15)');
	grad.addColorStop(0.5, 'rgba(251,191,36,0.35)');
	grad.addColorStop(1, 'rgba(251,146,60,0.15)');

	ctx.beginPath();
	ctx.ellipse(cx, cy, rx, ry, 0, startAngle, endAngle, false);
	ctx.strokeStyle = grad;
	ctx.lineWidth = 3;
	ctx.lineCap = 'round';
	ctx.stroke();

	// Sun dot position
	const sunAngle = startAngle + progress * Math.PI;
	const sunX = cx + rx * Math.cos(sunAngle);
	const sunY = cy + ry * Math.sin(sunAngle);

	// Glow
	const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 16);
	glow.addColorStop(0, 'rgba(253,186,16,0.55)');
	glow.addColorStop(1, 'rgba(253,186,16,0)');
	ctx.beginPath();
	ctx.arc(sunX, sunY, 16, 0, Math.PI * 2);
	ctx.fillStyle = glow;
	ctx.fill();

	// Sun core
	ctx.beginPath();
	ctx.arc(sunX, sunY, 6, 0, Math.PI * 2);
	ctx.fillStyle = '#fbbf24';
	ctx.fill();
	ctx.strokeStyle = '#fef3c7';
	ctx.lineWidth = 1.5;
	ctx.stroke();

	// Horizon line
	ctx.beginPath();
	ctx.moveTo(cx - rx - 10, cy);
	ctx.lineTo(cx + rx + 10, cy);
	ctx.strokeStyle = 'rgba(255,255,255,0.15)';
	ctx.lineWidth = 1;
	ctx.stroke();

	// Sunrise label (left)
	ctx.fillStyle = 'rgba(253,186,16,0.75)';
	ctx.font = 'bold 11px Inter, sans-serif';
	ctx.textAlign = 'left';
	ctx.fillText('🌅 ' + sunriseStr, cx - rx - 8, cy + 16);

	// Sunset label (right)
	ctx.textAlign = 'right';
	ctx.fillText(sunsetStr + ' 🌇', cx + rx + 8, cy + 16);

	// Center: progress % of day
	const pctDay = Math.round(progress * 100);
	ctx.fillStyle = 'rgba(255,255,255,0.5)';
	ctx.font = '10px Inter, sans-serif';
	ctx.textAlign = 'center';
	ctx.fillText(pctDay < 100 ? `${pctDay}% of daylight passed` : 'Sun has set', cx, cy + 16);
}

// ============================================================
//  PULL-TO-REFRESH  (mobile)
// ============================================================
(function initPullToRefresh() {
	let startY = 0;
	let pulling = false;
	const THRESHOLD = 72;

	const indicator = document.createElement('div');
	indicator.className = 'ptr-indicator';
	indicator.innerHTML = '<span class="ptr-icon">↓</span><span class="ptr-text">Pull to refresh</span>';
	document.body.appendChild(indicator);

	document.addEventListener('touchstart', e => {
		if(window.scrollY > 0) return;
		startY = e.touches[0].clientY;
		pulling = true;
	}, { passive: true });

	document.addEventListener('touchmove', e => {
		if(!pulling) return;
		const dy = e.touches[0].clientY - startY;
		if(dy <= 0) return;
		const pct = Math.min(dy / THRESHOLD, 1);
		indicator.style.transform = `translateY(${Math.min(dy * 0.45, THRESHOLD * 0.55)}px)`;
		indicator.style.opacity = pct.toString();
		indicator.querySelector('.ptr-text').textContent = pct >= 1 ? 'Release to refresh' : 'Pull to refresh';
		indicator.querySelector('.ptr-icon').style.transform = `rotate(${pct * 180}deg)`;
	}, { passive: true });

	document.addEventListener('touchend', e => {
		if(!pulling) return;
		pulling = false;
		const dy = e.changedTouches[0].clientY - startY;
		indicator.style.transform = '';
		indicator.style.opacity = '0';
		if(dy >= THRESHOLD && currentWeatherData) {
			showNavToast('🔄 Refreshing…');
			getWeatherByCity(`${currentWeatherData.name},${currentWeatherData.sys.country}`);
		}
	});
})();

getWeatherByCity('Manila');

// ============================================================
//  MORE CITIES MODAL
// ============================================================

const CITIES_BY_REGION = {
  '🏙️ Metro Manila': [
    'Manila','Quezon City','Makati','Taguig','Pasig',
    'Mandaluyong','Marikina','Parañaque','Las Piñas','Muntinlupa',
    'Caloocan','Malabon','Navotas','Valenzuela','Pasay','Pateros'
  ],
  '🌄 Luzon': [
    'Baguio','San Fernando','Angeles','Olongapo','Dagupan',
    'Laoag','Vigan','Tuguegarao','Ilagan','Cabanatuan',
    'Malolos','Meycauayan','San Jose del Monte','Lucena','Batangas',
    'Lipa','Taal','Cavite','Tagaytay','Antipolo',
    'Naga','Legazpi','Sorsogon','Masbate','Romblon'
  ],
  '🏝️ Visayas': [
    'Cebu','Mandaue','Lapu-Lapu','Talisay','Danao',
    'Iloilo','Bacolod','Dumaguete','Tagbilaran','Tacloban',
    'Ormoc','Borongan','Maasin','Catbalogan','Calbayog',
    'Roxas','Kalibo','San Jose','Calapan','Puerto Princesa'
  ],
  '🌿 Mindanao': [
    'Davao','Cagayan de Oro','Zamboanga','General Santos','Butuan',
    'Iligan','Cotabato','Pagadian','Dipolog','Dapitan',
    'Surigao','Bislig','Malaybalay','Marawi','Ozamiz',
    'Valencia','Koronadal','Kidapawan','Mati','Panabo'
  ]
};

// citiesWeatherCache is declared at the top of the file (shared with autocomplete)
let citiesModalOpen = false;

const citiesModal        = document.getElementById('cities-modal');
const citiesModalOverlay = document.getElementById('cities-modal-overlay');
const citiesModalClose   = document.getElementById('cities-modal-close');
const citiesModalSearch  = document.getElementById('cities-modal-search');
const citiesModalRegions = document.getElementById('cities-modal-regions');
const citiesModalCount   = document.getElementById('cities-modal-count');

document.getElementById('view-more-btn')?.addEventListener('click', openCitiesModal);
citiesModalOverlay?.addEventListener('click', closeCitiesModal);
citiesModalClose?.addEventListener('click', closeCitiesModal);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && citiesModalOpen) closeCitiesModal();
});

citiesModalSearch?.addEventListener('input', () => {
  filterCitiesModal(citiesModalSearch.value.trim().toLowerCase());
});

function openCitiesModal() {
  citiesModal.style.display = 'flex';
  citiesModalOpen = true;
  document.body.style.overflow = 'hidden';
  citiesModalSearch.value = '';
  buildCitiesModalDOM();
  citiesModalSearch.focus();
}

function closeCitiesModal() {
  citiesModal.style.display = 'none';
  citiesModalOpen = false;
  document.body.style.overflow = '';
}

function buildCitiesModalDOM() {
  citiesModalRegions.innerHTML = '';

  const allCities = Object.values(CITIES_BY_REGION).flat();
  citiesModalCount.textContent = `${allCities.length} cities`;

  Object.entries(CITIES_BY_REGION).forEach(([region, cities]) => {
    const block = document.createElement('div');
    block.className = 'cities-region-block';
    block.dataset.region = region;

    block.innerHTML = `<div class="cities-region-label">${region}</div>`;

    const grid = document.createElement('div');
    grid.className = 'cities-modal-grid';

    cities.forEach(city => {
      const btn = document.createElement('button');
      btn.className = 'cities-modal-item';
      btn.dataset.city = city.toLowerCase();
      btn.dataset.cacheKey = city;

      const cached = citiesWeatherCache[city];
      if (cached) {
        btn.innerHTML = buildCityCardHTML(cached);
      } else {
        btn.innerHTML = `
          <span class="city-modal-emoji">🌐</span>
          <div class="city-modal-info">
            <div class="city-modal-name">${city}</div>
            <div class="city-modal-meta">Loading…</div>
          </div>
          <span class="city-modal-temp loading-temp">…</span>
        `;
        fetchCityWeather(city, btn);
      }

      btn.addEventListener('click', () => {
        elements.cityInput.value = city;
        getWeatherByCity(`${city},PH`);
        closeCitiesModal();
      });

      grid.appendChild(btn);
    });

    block.appendChild(grid);
    citiesModalRegions.appendChild(block);
  });
}

function buildCityCardHTML(data) {
  const emoji = getWeatherEmoji(data.weather[0].main);
  const temp  = formatTemp(data.main.temp);
  const desc  = data.weather[0].description.replace(/\b\w/g, c => c.toUpperCase());
  return `
    <span class="city-modal-emoji">${emoji}</span>
    <div class="city-modal-info">
      <div class="city-modal-name">${data.name}</div>
      <div class="city-modal-meta">${desc}</div>
    </div>
    <span class="city-modal-temp">${temp}</span>
  `;
}

async function fetchCityWeather(city, btnEl) {
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(`${city},PH`)}&units=metric&appid=${API_KEY}`;
    const data = await fetchJSON(url);
    citiesWeatherCache[city] = data;
    // Update the button if still in the DOM
    if (btnEl && btnEl.isConnected) {
      btnEl.innerHTML = buildCityCardHTML(data);
    }
  } catch {
    if (btnEl && btnEl.isConnected) {
      btnEl.querySelector('.city-modal-meta').textContent = 'Unavailable';
      btnEl.querySelector('.city-modal-temp').textContent = '--';
      btnEl.querySelector('.city-modal-temp').classList.remove('loading-temp');
    }
  }
}

function filterCitiesModal(query) {
  let visibleTotal = 0;

  document.querySelectorAll('.cities-region-block').forEach(block => {
    let visibleInBlock = 0;
    block.querySelectorAll('.cities-modal-item').forEach(btn => {
      const name = btn.dataset.city || '';
      const match = !query || name.includes(query);
      btn.classList.toggle('hidden', !match);
      if (match) visibleInBlock++;
    });
    block.style.display = visibleInBlock === 0 ? 'none' : 'flex';
    visibleTotal += visibleInBlock;
  });

  citiesModalCount.textContent = `${visibleTotal} ${query ? 'results' : 'cities'}`;

  // Show "no results" message
  let noResults = citiesModalRegions.querySelector('.cities-modal-no-results');
  if (visibleTotal === 0) {
    if (!noResults) {
      noResults = document.createElement('div');
      noResults.className = 'cities-modal-no-results';
      citiesModalRegions.appendChild(noResults);
    }
    noResults.textContent = `No cities match "${query}"`;
  } else if (noResults) {
    noResults.remove();
  }
}