// Runs with Node built-in test/assert after compiling engine via global/local tsc.
// No npm dependencies needed; the full Vitest suite is in src/tests.
import assert from 'node:assert/strict';
import { DESTINATIONS } from '../.engine-dist/data/destinations.js';
import { evaluateFeasibility, formatIST, parseIST } from '../.engine-dist/engine/scheduler.js';

const d = id => DESTINATIONS.find(x => x.id === id);
const base = {departureDateTime:'2026-10-24T08:30',returnDeadlineDateTime:'2026-10-25T20:30',
  pace:'balanced',perPersonBudgetINR:6000,partySize:2,drivingAdjustmentMinutes:45,
  simulateDelayMinutes:0,disabledActivityIds:[]};
const cases = [];
function test(name, callback) {callback(); cases.push(name);}

test('IST parses and handles midnight',()=>{
  assert.equal(formatIST(parseIST('2026-10-24T23:45')+30*60_000),'2026-10-25T00:15');
});
test('invalid date rejected',()=>assert.throws(()=>parseIST('2026-02-30T08:00')));
test('one-way +45 adjustment and buffer',()=>{
  const r=evaluateFeasibility(d('mysuru'),base);
  assert.equal(r.outboundDriveMinutes,288);
});
test('Abbey Falls rolls over to day 2',()=>{
  const r=evaluateFeasibility(d('coorg-madikeri'),base);
  assert.equal(r.activityOutcomes.find(o=>o.activityId==='coorg-abbey').status,'day2');
});
test('all four scenarios produce complete output',()=>{
  for(const dest of DESTINATIONS){
    const r=evaluateFeasibility(dest,base);
    assert.ok(Number.isFinite(r.destinationSlackMinutes));
    assert.ok(Number.isFinite(r.returnDeadlineMarginMinutes));
    assert.ok(r.timeline.length>0);
  }
});
test('required activities remain inside full operating window',()=>{
  for(const dest of DESTINATIONS){
    const r=evaluateFeasibility(dest,base);
    for(const t of r.timeline.filter(x=>x.category==='ACTIVITY')){
      const a=dest.activities.find(x=>x.id===t.activityId);
      assert.ok(t.startTime.slice(11)>=a.openTime && t.endTime.slice(11)<=a.closeTime);
    }
  }
});
test('one hour delay recalculates',()=>{
  const a=evaluateFeasibility(d('mysuru'),base);
  const b=evaluateFeasibility(d('mysuru'),{...base,simulateDelayMinutes:60});
  assert.equal(b.outboundDriveMinutes-a.outboundDriveMinutes,60);
});
test('removing optional activity increases slack and lowers cost',()=>{
  const a=evaluateFeasibility(d('coorg-madikeri'),base);
  const b=evaluateFeasibility(d('coorg-madikeri'),{...base,disabledActivityIds:['coorg-raja']});
  assert.ok(b.destinationSlackMinutes>a.destinationSlackMinutes);
  assert.ok(b.estimatedTripTotalINR<a.estimatedTripTotalINR);
});
test('missed return deadline gives Not Recommended',()=>{
  const a=evaluateFeasibility(d('ooty'),{...base,returnDeadlineDateTime:'2026-10-25T14:00'});
  assert.equal(a.rating,'Not Recommended');
});
test('budget is warning only',()=>{
  const a=evaluateFeasibility(d('ooty'),{...base,perPersonBudgetINR:3000});
  assert.equal(a.violations.find(v=>v.type==='BUDGET_OVERRUN').severity,'WARNING');
});
test('late Bandipur checkpoint is advisory not blocker',()=>{
  const a=evaluateFeasibility(d('ooty'),{...base,departureDateTime:'2026-10-24T17:00',returnDeadlineDateTime:'2026-10-25T23:00'});
  assert.equal(a.violations.find(v=>v.type==='POTENTIAL_NIGHT_CURFEW')?.severity,'ADVISORY');
});
console.log(`PASS: ${cases.length} offline engine smoke tests.`);
for(const c of cases) console.log(' ✓',c);
