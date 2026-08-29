#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'assets/js/app.js'), 'utf8');
const start = source.indexOf('function isoDateValue');
const end = source.indexOf('function currentMonth', start);
const factory = new Function('window', `${source.slice(start, end)}; return competencePeriod;`);
const competencePeriod = factory({});

const august = competencePeriod('2026-08');
assert.equal(august.startIso, '2026-07-27');
assert.equal(august.endIso, '2026-08-30');
assert.equal(august.dates.length, 35);
assert.ok(august.dates.some(date => date.toISOString().slice(0, 10) === '2026-07-31'));
assert.ok(!august.dates.some(date => date.toISOString().slice(0, 10) === '2026-08-31'));

const september = competencePeriod('2026-09');
assert.equal(september.startIso, '2026-08-31');
assert.equal(september.endIso, '2026-09-27');

console.log('Month competence regression test passed');
