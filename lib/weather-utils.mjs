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

export function getWeatherIconName(condition) {
	const cond = String(condition).toLowerCase();
	if (cond.includes('thunder') || cond.includes('storm')) return 'storm';
	if (cond.includes('drizzle')) return 'drizzle';
	if (cond.includes('rain')) return 'rain';
	if (cond.includes('snow')) return 'snow';
	if (cond.includes('cloud') || cond.includes('overcast')) return 'cloud';
	if (cond.includes('clear') || cond.includes('sunny')) return 'sun';
	if (cond.includes('mist') || cond.includes('fog') || cond.includes('haze') || cond.includes('smoke')) return 'mist';
	if (cond.includes('wind')) return 'wind';
	return 'cloudSun';
}

export function normalizeCityQuery(city) {
	return String(city).trim();
}

export function buildAlertSignature(city, alertKeys) {
	return `${city}:${[...alertKeys].sort().join(',')}`;
}
