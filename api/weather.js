/**
 * Vercel serverless proxy for OpenWeatherMap.
 * Set OPENWEATHERMAP_API_KEY in Vercel project environment variables.
 */
export default async function handler(request, response) {
	if (request.method === 'OPTIONS') {
		response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
		response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
		return response.status(204).end();
	}

	if (request.method !== 'GET') {
		return response.status(405).json({ error: 'Method not allowed' });
	}

	const { endpoint, ...query } = request.query || {};
	const allowed = new Set(['weather', 'forecast']);

	if (!endpoint || !allowed.has(String(endpoint))) {
		return response.status(400).json({ error: 'Invalid or missing endpoint' });
	}

	const apiKey = process.env.OPENWEATHERMAP_API_KEY;
	if (!apiKey) {
		return response.status(500).json({
			error: 'Server misconfigured: OPENWEATHERMAP_API_KEY is not set'
		});
	}

	const url = new URL(`https://api.openweathermap.org/data/2.5/${endpoint}`);
	for (const [key, value] of Object.entries(query)) {
		if (value != null && value !== '') {
			url.searchParams.set(key, Array.isArray(value) ? value[0] : value);
		}
	}
	url.searchParams.set('appid', apiKey);
	if (!url.searchParams.has('units')) {
		url.searchParams.set('units', 'metric');
	}

	try {
		const upstream = await fetch(url.toString(), {
			headers: { Accept: 'application/json' }
		});
		const data = await upstream.json();
		response.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
		return response.status(upstream.status).json(data);
	} catch (err) {
		return response.status(502).json({ error: 'Upstream weather service unavailable' });
	}
}
