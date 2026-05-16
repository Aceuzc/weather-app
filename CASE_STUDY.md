# Case study — Weather Dashboard PH

## Problem

Generic weather sites show data but rarely help people **decide** what to do—especially in the Philippines, where users jump between many cities (travel, family, work) and deal with heat, humidity, and sudden rain.

## Solution

A single-page dashboard that combines:

- Live OpenWeatherMap data with geolocation and search
- A **regional browser** for 80+ Philippine cities
- **Side-by-side comparison** for up to three cities
- Practical layers: outfit tips, mood palette, plain-language alerts, and shareable summary cards

## Key decisions

| Decision | Why |
|----------|-----|
| Vanilla JS (no framework) | Keeps the project readable for portfolio reviewers and proves core web fundamentals |
| Vercel `/api/weather` proxy | Hides the OpenWeatherMap key in production; falls back to user key only when proxy isn’t available |
| Session dismiss for alerts | Alerts are useful once; re-showing on every refresh felt noisy |
| `localStorage` for favorites/recent | No backend needed; fast return visits |

## Tradeoffs

- **Client-side AI key** (optional Gemini/OpenRouter) is still visible if enabled—acceptable for demo; production would use a server route.
- **Single `script.js` file** keeps deployment simple; modules/tests live in `lib/` for maintainability without a bundler.

## What I’d build next

1. PWA service worker for offline last-viewed city  
2. UV / air quality from OpenWeather pollution endpoints  
3. Link or embed PAGASA advisories for typhoon season  
4. Server-side AI proxy matching the weather API pattern  

## What I learned

- Canvas charts need careful resize handling when tabs change visibility  
- Hover states must target **rounded** elements, not square wrappers, to avoid visual glitches  
- Portfolio value comes as much from **deployment + README + case study** as from feature count  
