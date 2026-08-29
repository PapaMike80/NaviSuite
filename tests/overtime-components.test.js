#!/usr/bin/env node
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const context={window:{}};
vm.runInNewContext(fs.readFileSync('assets/js/overtime-components.js','utf8'),context);
const overtime=context.window.NaviOvertimeComponents;
const day={delay:0,changeMinutes:0,serviceMinutes:13*60};

overtime.setOrdinary(day,30,day.serviceMinutes);
overtime.setChanges(day,120,day.serviceMinutes);
overtime.setSentineMinutes(day,60,day.serviceMinutes);
assert.equal(overtime.ordinary(day),30);
assert.equal(overtime.changes(day),120);
assert.equal(overtime.sentine(day),60);
assert.equal(overtime.total(day),210);
assert.equal(day.delay,210);
assert.equal(day.workedMinutes,13*60+210);

overtime.setChanges(day,0,day.serviceMinutes);
assert.equal(overtime.total(day),90);
assert.equal(day.workedMinutes,13*60+90);

overtime.setWorked(day,17*60,day.serviceMinutes);
assert.equal(overtime.ordinary(day),180);
assert.equal(overtime.total(day),240);

console.log('Overtime component regression test passed');
