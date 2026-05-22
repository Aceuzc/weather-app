import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	toDisplay,
	unitLabel,
	formatTemp,
	getWeatherIconName,
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

test('getWeatherIconName maps conditions', () => {
	assert.equal(getWeatherIconName('Thunderstorm'), 'storm');
	assert.equal(getWeatherIconName('Clear'), 'sun');
	assert.equal(getWeatherIconName('unknown'), 'cloudSun');
});

test('buildAlertSignature is stable', () => {
	assert.equal(
		buildAlertSignature('Manila', ['hot-day', 'rain-later']),
		'Manila:hot-day,rain-later'
	);
});
