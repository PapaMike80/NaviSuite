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

const shortenedDay={shift:'DT',serviceMinutes:9*60+25,delay:0,changeMinutes:0};
overtime.setWorked(shortenedDay,8*60,shortenedDay.serviceMinutes);
assert.equal(shortenedDay.workedMinutes,8*60);
assert.equal(shortenedDay.overtimeMeta.workedMode,'manual');
assert.equal(overtime.total(shortenedDay),0);
overtime.sync(shortenedDay,shortenedDay.serviceMinutes);
assert.equal(shortenedDay.workedMinutes,8*60);
overtime.setChanges(shortenedDay,60,shortenedDay.serviceMinutes);
assert.equal(shortenedDay.workedMinutes,8*60);
assert.equal(overtime.total(shortenedDay),60);

const changedService={shift:'PonD',serviceMinutes:565,delay:0,changeMinutes:0,bank:30,mealUsed:true,allowanceRate:24,embark:true,overnight40:true};
overtime.setOrdinary(changedService,15,changedService.serviceMinutes);
overtime.setChanges(changedService,60,changedService.serviceMinutes);
overtime.setSentineMinutes(changedService,30,changedService.serviceMinutes);
changedService.shift='DT';
changedService.serviceMinutes=480;
overtime.sync(changedService,changedService.serviceMinutes);
assert.equal(overtime.total(changedService),105);
assert.equal(changedService.workedMinutes,585);
assert.equal(changedService.bank,30);
assert.equal(changedService.mealUsed,true);
assert.equal(changedService.allowanceRate,24);
assert.equal(changedService.embark,true);
assert.equal(changedService.overnight40,true);

console.log('Overtime component regression test passed');
