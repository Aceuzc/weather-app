import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	toDisplay,
	unitLabel,
	formatTemp,
	getWeatherEmoji,
	buildAlertSignature
} from '../lib/weather-utils.mjs';

test('toDisplay celsius', () => {
	assert.equal(toDisplay(24, 'C'), 24);
	assert.equal(toDisplay(0, 'C'), 0);
});

test('toDisplay fahrenheit', () => {
	assert.equal(toDisplay(0, 'F'), 32);
	assert.equal(toDisplay(100, 'F'), 212);
});

test('formatTemp includes unit', () => {
	assert.equal(formatTemp(20, 'C'), '20°C');
	assert.equal(formatTemp(20, 'F'), '68°F');
});

test('getWeatherEmoji maps conditions', () => {
	assert.equal(getWeatherEmoji('Thunderstorm'), '⛈️');
	assert.equal(getWeatherEmoji('Clear'), '☀️');
	assert.equal(getWeatherEmoji('unknown'), '🌤️');
});

test('buildAlertSignature is stable', () => {
	assert.equal(
		buildAlertSignature('Manila', ['hot-day', 'rain-later']),
		'Manila:hot-day,rain-later'
	);
});
