let API_KEY = 'b0ef91c4e8f2d2a068cddea77ee82b92';
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


    function generateFallbackSummary(cur){
	    return `${cur.name} is currently ${Math.round(cur.main.temp)}°C with ${cur.weather[0].description}. Stay hydrated and prepare for changing conditions today.`;
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
	    if(err.message.includes('429')){
	        setAISummary('AI is busy right now. Retrying shortly...', false);
        }else{
	        setAISummary('AI summary unavailable.', false);
        }
    }
}

async function getWeatherByCity(city){
	if(!API_KEY || API_KEY === 'YOUR_OPENWEATHERMAP_API_KEY'){
		const key = prompt('Enter your OpenWeatherMap API key');
		if(!key) return alert('API key required');
		API_KEY = key;
	}
	setLoading();
	try{
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
		updateMap(cur.coord.lat, cur.coord.lon);
		generateAISummary(cur, f.list);
		updatePopularCities();
	}catch(err){
		alert('Error: ' + err.message);
		elements.temp.textContent = '--';
		elements.desc.textContent = '--';
		setAISummary('AI summary unavailable.', false);
	}
}

async function getWeatherByCoords(lat, lon){
	if(!API_KEY || API_KEY === 'YOUR_OPENWEATHERMAP_API_KEY'){
		const key = prompt('Enter your OpenWeatherMap API key');
		if(!key) return alert('API key required');
		API_KEY = key;
	}
	setLoading();
	try{
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
		updateMap(lat, lon);
		generateAISummary(cur, f.list);
		updatePopularCities();
	}catch(err){
		alert('Error: ' + err.message);
		setAISummary('AI summary unavailable.', false);
	}
}

function renderCurrent(d){
	elements.cityName.textContent = `${d.name}, ${d.sys.country}`;
	elements.temp.textContent = `${Math.round(d.main.temp)}`;
	elements.desc.textContent = d.weather[0].description.replace(/\b\w/g, c => c.toUpperCase());
	elements.weatherIcon.textContent = getWeatherEmoji(d.weather[0].main);
	elements.statHumidity.textContent = `${d.main.humidity}%`;
	elements.statWind.textContent = `${Math.round(d.wind.speed)} m/s`;
	elements.statPressure.textContent = `${d.main.pressure} hPa`;
	elements.statVisibility.textContent = `${(d.visibility/1000).toFixed(1)} km`;

	// New feature calls
	updateWeatherBackground(d);
	renderMoodBoard(d);
	renderOutfitPanel(d);
}

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
				dt: item.dt
			};
		}
		dailyMap[dateKey].temps.push(item.main.temp);
		dailyMap[dateKey].conditions.push(item.weather[0].main);
	});

	const dailyArr = Object.values(dailyMap);
	const days = dailyArr.slice(0, maxDays || 6);

	days.forEach((day, index) => {
		const el = document.createElement('div');
		el.className = 'forecast-item';
		el.style.animationDelay = `${index * 0.05}s`;
		const maxTemp = Math.round(Math.max(...day.temps));
		const minTemp = Math.round(Math.min(...day.temps));
		const condCount = {};
		day.conditions.forEach(c => condCount[c] = (condCount[c]||0) + 1);
		const mainCond = Object.keys(condCount).sort((a,b) => condCount[b] - condCount[a])[0];
		const emoji = getWeatherEmoji(mainCond);
		const dayName = formatDay(day.dt);
		const dateStr = formatDate(day.dt);

		el.innerHTML = `
			<div class="time">${dayName}</div>
			<div class="date">${dateStr}</div>
			<div class="icon">${emoji}</div>
			<div class="ftemp">${maxTemp}°</div>
			<div class="ftemp-low">${minTemp}°</div>
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

	// Re-render chart if switching to summary (canvas needs size recalc)
	if(viewName === 'summary' && hourlyData.length > 0){
		setTimeout(() => renderSummaryChart(forecastList), 50);
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
		const temp = Math.round(item.main.temp);
		const time = formatTime(item.dt);
		const desc = item.weather[0].description.replace(/\b\w/g, c => c.toUpperCase());
		const wind = `${Math.round(item.wind.speed)} m/s`;

		div.innerHTML = `
			<span class="hourly-time">${time}</span>
			<span class="hourly-icon">${emoji}</span>
			<span class="hourly-desc">${desc}</span>
			<span class="hourly-temp">${temp}°C</span>
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
	const maxTemp = Math.round(Math.max(...next24.map(i => i.main.temp_max)));
	const minTemp = Math.round(Math.min(...next24.map(i => i.main.temp_min)));
	const avgClouds = Math.round(next24.reduce((s,i) => s + i.clouds.all, 0) / next24.length);

	const sunrise = cur.sys.sunrise ? formatTime(cur.sys.sunrise) : '--';
	const sunset = cur.sys.sunset ? formatTime(cur.sys.sunset) : '--';

	const details = [
		{ icon: '🌡️', label: 'Feels Like', value: `${Math.round(cur.main.feels_like)}°C`, sub: 'Current sensation' },
		{ icon: '💧', label: 'Avg Humidity', value: `${avgHumidity}%`, sub: 'Next 24h average' },
		{ icon: '💨', label: 'Max Wind', value: `${maxWind} m/s`, sub: 'Next 24h peak' },
		{ icon: '🌡️', label: 'Pressure', value: `${avgPressure} hPa`, sub: 'Avg atmospheric' },
		{ icon: '🔺', label: 'High Temp', value: `${maxTemp}°C`, sub: 'Next 24h maximum' },
		{ icon: '🔻', label: 'Low Temp', value: `${minTemp}°C`, sub: 'Next 24h minimum' },
		{ icon: '🌅', label: 'Sunrise', value: sunrise, sub: 'Today' },
		{ icon: '🌇', label: 'Sunset', value: sunset, sub: 'Today' },
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
	const cities = ['Manila', 'Taguig', 'Pasig', 'Makati', 'Quezon City'];
	const listEl = document.getElementById('cities-list');

	try {
		const promises = cities.map(city => {
			const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${API_KEY}`;
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
				const temp = Math.round(data.main.temp);
				const desc = data.weather[0].description.replace(/\b\w/g, c => c.toUpperCase());
				div.innerHTML = `
					<span class="city-name">${emoji} ${data.name}</span>
					<span class="city-temp">${temp}°C</span>
					<span class="city-condition">${desc}</span>
				`;
				div.addEventListener('click', () => {
					elements.cityInput.value = data.name;
					getWeatherByCity(data.name);
				});
			} else {
				div.innerHTML = `
					<span class="city-name">${cities[i]}</span>
					<span class="city-condition">Unavailable</span>
				`;
			}
			listEl.appendChild(div);
		});
	} catch(e) {
		// Silently fail, keep static cities
	}
}

// ===== EVENT LISTENERS =====
elements.form.addEventListener('submit', e => {
	e.preventDefault();
	const q = elements.cityInput.value.trim();
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
	if(hourlyData.length > 0){
		const summaryPanel = document.getElementById('panel-summary');
		if(summaryPanel && summaryPanel.classList.contains('active')){
			renderSummaryChart(forecastList);
		}
	}
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
	const temp   = Math.round(weatherData.main.temp);
	const feels  = Math.round(weatherData.main.feels_like);

	panel.innerHTML = `
		<div class="outfit-hero">
			<div class="outfit-icon-large">${outfit.icon}</div>
			<div>
				<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">
					${temp}°C · Feels like ${feels}°C
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
	ctx.fillText(`${Math.round(d.main.temp)}°C`, 28, 205);

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
	ctx.fillText(`${Math.round(d.main.feels_like)}°C`, W - 30, 146);

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

	// Inject legend if not already there
	if (!document.getElementById('feellike-legend')) {
		const legend = document.createElement('div');
		legend.id = 'feellike-legend';
		legend.className = 'feellike-legend';
		legend.innerHTML = `
			<div class="legend-item"><div class="legend-dot" style="background:#6ee7b7"></div> Actual Temp</div>
			<div class="legend-item"><div class="legend-dot" style="background:#f97316"></div> Feels Like</div>
			<div class="legend-item"><div class="legend-dot" style="background:#60a5fa;border-radius:2px;height:3px;margin-top:4px;"></div> Humidity %</div>
		`;
		panel.insertBefore(legend, panel.firstChild);
	}

	const canvas = document.getElementById('feellike-canvas');
	const container = document.getElementById('feellike-chart');
	if (!canvas || !container) return;

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

function generatePlainAlerts(weatherData, forecastList) {
	const alerts = [];
	const cond     = weatherData.weather[0].main.toLowerCase();
	const desc     = weatherData.weather[0].description.toLowerCase();
	const temp     = weatherData.main.temp;
	const feelsLk  = weatherData.main.feels_like;
	const wind     = weatherData.wind.speed;
	const humidity = weatherData.main.humidity;
	const vis      = weatherData.visibility / 1000;

	// Storm / Thunderstorm
	if (cond.includes('thunder') || cond.includes('storm')) {
		alerts.push({
			severity: 'danger',
			icon: '⛈️',
			title: 'Thunderstorm Warning',
			text: 'Active thunderstorm in your area — avoid open spaces and stay away from trees. Dangerous for driving. Best to stay indoors until conditions improve.'
		});
	}

	// Heavy rain
	if (cond.includes('rain') && (desc.includes('heavy') || desc.includes('extreme'))) {
		alerts.push({
			severity: 'danger',
			icon: '🌧️',
			title: 'Heavy Rain Advisory',
			text: 'Heavy rain expected — expect flooded streets and reduced visibility. Waterproof your bag, wear rubber shoes, and allow extra travel time.'
		});
	}

	// Drizzle / light rain
	if (cond.includes('drizzle') || (cond.includes('rain') && desc.includes('light'))) {
		alerts.push({
			severity: 'info',
			icon: '☂️',
			title: 'Light Rain — Bring an Umbrella',
			text: 'Patchy drizzle throughout the day. Toss a foldable umbrella in your bag — it\'ll save you more than once today.'
		});
	}

	// High wind
	if (wind > 14) {
		alerts.push({
			severity: 'danger',
			icon: '💨',
			title: 'Strong Wind Warning',
			text: `Winds at ${Math.round(wind)} m/s — secure loose items outside your house (plant pots, chairs, signage). Avoid parking under trees or old structures.`
		});
	} else if (wind > 9) {
		alerts.push({
			severity: 'warning',
			icon: '🌬️',
			title: 'Breezy Conditions',
			text: `Wind gusts up to ${Math.round(wind)} m/s. Umbrella users beware — yours might flip inside out. Hold on to lightweight items.`
		});
	}

	// Extreme heat
	if (feelsLk >= 40) {
		alerts.push({
			severity: 'danger',
			icon: '🥵',
			title: 'Extreme Heat Advisory',
			text: `Feels like ${Math.round(feelsLk)}°C outside — dangerous heat index. Avoid going out between 10AM–4PM. Drink water every 20 minutes even if you're not thirsty.`
		});
	} else if (feelsLk >= 35) {
		alerts.push({
			severity: 'warning',
			icon: '☀️',
			title: 'Hot Day Ahead',
			text: `Feels like ${Math.round(feelsLk)}°C — wear light breathable clothing, apply sunscreen SPF 30+, and stay hydrated. Limit outdoor activity during midday.`
		});
	}

	// High humidity (without rain)
	if (humidity >= 88 && !cond.includes('rain') && !cond.includes('storm')) {
		alerts.push({
			severity: 'warning',
			icon: '💦',
			title: 'High Humidity Alert',
			text: `Humidity at ${humidity}% — even mild activity will feel exhausting. Wear moisture-wicking fabrics and take breaks in air-conditioned spaces.`
		});
	}

	// Low visibility
	if (vis < 1) {
		alerts.push({
			severity: 'danger',
			icon: '🌫️',
			title: 'Very Low Visibility',
			text: `Visibility is only ${vis.toFixed(1)} km — extremely hazardous for driving. Turn on fog lights and slow down significantly. Avoid highways if possible.`
		});
	} else if (vis < 3) {
		alerts.push({
			severity: 'warning',
			icon: '👁️',
			title: 'Reduced Visibility',
			text: `Visibility around ${vis.toFixed(1)} km due to ${desc}. Drive carefully, keep extra distance from the vehicle ahead, and use headlights even in daytime.`
		});
	}

	// Check forecast for upcoming rain in next 12h
	if (!cond.includes('rain') && !cond.includes('storm') && forecastList.length > 0) {
		const upcoming = forecastList.slice(0, 4);
		const rainSoon = upcoming.find(item => item.weather[0].main.toLowerCase().includes('rain'));
		if (rainSoon) {
			const rainTime = formatTime(rainSoon.dt);
			alerts.push({
				severity: 'info',
				icon: '🌦️',
				title: 'Rain Expected Later',
				text: `Currently dry but rain is forecast around ${rainTime}. Bring an umbrella if you\'re heading out — you\'ll thank yourself on the way back.`
			});
		}
	}

	renderAlertsBanner(alerts);
}

function renderAlertsBanner(alerts) {
	const banner = document.getElementById('alerts-banner');
	if (!banner) return;

	if (alerts.length === 0) {
		banner.style.display = 'none';
		banner.innerHTML = '';
		return;
	}

	banner.style.display = 'flex';
	banner.innerHTML = alerts.map((a, i) => `
		<div class="alert-item severity-${a.severity}" style="animation-delay:${i * 0.07}s">
			<span class="alert-icon">${a.icon}</span>
			<div class="alert-body">
				<div class="alert-title">${a.title}</div>
				<div class="alert-text">${a.text}</div>
			</div>
			<button class="alert-dismiss" onclick="this.closest('.alert-item').remove(); if(!document.querySelector('.alert-item')) document.getElementById('alerts-banner').style.display='none';" title="Dismiss">✕</button>
		</div>
	`).join('');
}

// ============================================================
//  FEATURE 6: LOCATION COMPARISON MODAL
// ============================================================

// Override getWeatherByCity to hook in new features
async function getWeatherByCity(city) {
	if (!API_KEY || API_KEY === 'YOUR_OPENWEATHERMAP_API_KEY') {
		const key = prompt('Enter your OpenWeatherMap API key');
		if (!key) return alert('API key required');
		API_KEY = key;
	}
	setLoading();
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
		generatePlainAlerts(cur, f.list);
		updatePopularCities();
	} catch (err) {
		alert('Error: ' + err.message);
		elements.temp.textContent = '--';
		elements.desc.textContent = '--';
		setAISummary('AI summary unavailable.', false);
	}
}

async function getWeatherByCoords(lat, lon) {
	if (!API_KEY || API_KEY === 'YOUR_OPENWEATHERMAP_API_KEY') {
		const key = prompt('Enter your OpenWeatherMap API key');
		if (!key) return alert('API key required');
		API_KEY = key;
	}
	setLoading();
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
		generatePlainAlerts(cur, f.list);
		updatePopularCities();
	} catch (err) {
		alert('Error: ' + err.message);
		setAISummary('AI summary unavailable.', false);
	}
}

// Hook feel-like into summary tab switch
function switchSummaryPanel(viewName) {
	document.querySelectorAll('.summary-panel').forEach(p => p.classList.remove('active'));
	const target = document.getElementById(`panel-${viewName}`);
	if (target) target.classList.add('active');
	if (viewName === 'summary' && hourlyData.length > 0) {
		setTimeout(() => renderSummaryChart(forecastList), 50);
	}
	if (viewName === 'feellike' && forecastList.length > 0) {
		setTimeout(() => renderFeelLikeChart(forecastList), 50);
	}
}

// ============================================================
//  FEATURE 6: LOCATION COMPARISON MODAL
// ============================================================

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
		const temp    = Math.round(data.main.temp);
		const feels   = Math.round(data.main.feels_like);
		const isBest  = data.main.temp === highestTemp && pinnedCities.length > 1;
		const isCool  = data.main.temp === lowestTemp  && pinnedCities.length > 1;

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
			<div class="compare-card-temp">${temp}°C</div>
			<div class="compare-card-desc">${data.weather[0].description}</div>
			<div class="compare-card-stats">
				<div class="compare-stat">
					<div class="compare-stat-label">🌡️ Feels Like</div>
					<div class="compare-stat-value">${feels}°C</div>
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

// ============================================================
//  RESIZE HANDLER — include feel-like chart
// ============================================================
window.addEventListener('resize', () => {
	if (hourlyData.length > 0) {
		const summaryPanel = document.getElementById('panel-summary');
		if (summaryPanel?.classList.contains('active')) renderSummaryChart(forecastList);
		const feelPanel = document.getElementById('panel-feellike');
		if (feelPanel?.classList.contains('active')) renderFeelLikeChart(forecastList);
	}
});

// Load a default city on startup
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

// Cache so we don't refetch on reopen
const citiesWeatherCache = {};
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
        getWeatherByCity(city);
        closeCitiesModal();
        showNavToast(`📍 Loading ${city}…`);
      });

      grid.appendChild(btn);
    });

    block.appendChild(grid);
    citiesModalRegions.appendChild(block);
  });
}

function buildCityCardHTML(data) {
  const emoji = getWeatherEmoji(data.weather[0].main);
  const temp  = Math.round(data.main.temp);
  const desc  = data.weather[0].description.replace(/\b\w/g, c => c.toUpperCase());
  return `
    <span class="city-modal-emoji">${emoji}</span>
    <div class="city-modal-info">
      <div class="city-modal-name">${data.name}</div>
      <div class="city-modal-meta">${desc}</div>
    </div>
    <span class="city-modal-temp">${temp}°C</span>
  `;
}

async function fetchCityWeather(city, btnEl) {
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${API_KEY}`;
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