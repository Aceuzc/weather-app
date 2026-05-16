/** Pure helpers — tested via `npm test` */

export function toDisplay(celsius, unit = 'C') {
	return unit === 'F' ? Math.round(celsius * 9 / 5 + 32) : Math.round(celsius);
}

export function unitLabel(unit = 'C') {
	return `°${unit}`;
}

export function formatTemp(celsius, unit = 'C') {
	return `${toDisplay(celsius, unit)}${unitLabel(unit)}`;
}

export function getWeatherEmoji(condition) {
	const cond = String(condition).toLowerCase();
	if (cond.includes('thunder')) return '⛈️';
	if (cond.includes('drizzle')) return '🌦️';
	if (cond.includes('rain')) return '🌧️';
	if (cond.includes('snow')) return '❄️';
	if (cond.includes('cloud') && cond.includes('scatter')) return '⛅';
	if (cond.includes('cloud')) return '☁️';
	if (cond.includes('clear')) return '☀️';
	if (cond.includes('sunny')) return '🌞';
	if (cond.includes('mist') || cond.includes('fog') || cond.includes('haze')) return '🌫️';
	if (cond.includes('wind')) return '💨';
	return '🌤️';
}

export function normalizeCityQuery(city) {
	return String(city).trim();
}

export function buildAlertSignature(city, alertKeys) {
	return `${city}:${[...alertKeys].sort().join(',')}`;
}
