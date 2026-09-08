import test from 'node:test';
import assert from 'node:assert/strict';
import {LAB_CASES,runLabToCompletion} from './scenario-lab.mjs';

test('The lab presents jab defenses as separate ordered cases',()=>{
  assert.equal(LAB_CASES.length,2);
  assert.deepEqual(LAB_CASES.map(item=>item.id),['jab-right-parry','jab-right-block']);
  assert.deepEqual(LAB_CASES.map(item=>item.number),['01','02']);
});

test('Case 01 proves a small downward right parry redirects the jab at about 70% travel',()=>{
  const run=runLabToCompletion(0);
  assert.equal(run.status,'complete');
  assert.equal(run.impact.event.defense,'parry');
  assert.ok(run.impact.event.punchProgress>=.675&&run.impact.event.punchProgress<=.725);
  assert.equal(run.impact.attackerLeftDeflection>3.8,true);
  assert.equal(run.impact.defenderRightDeflection,0);
  assert.equal(run.impact.defenderRightParry,'tap');
  assert.ok(run.tapStart[1]-run.impact.defenderRightGlove[1]>=.08);
  assert.ok(run.rebound.forward>=.20);
  assert.ok(run.rebound.downward>=.26);
  assert.equal(run.checks.length,5);
  assert.equal(run.checks.every(check=>check.pass),true);
});

test('Case 02 proves a right block absorbs the jab without deflecting either arm',()=>{
  const run=runLabToCompletion(1);
  assert.equal(run.status,'complete');
  assert.equal(run.impact.event.defense,'block');
  assert.equal(run.impact.event.damage,1);
  assert.equal(run.impact.attackerLeftDeflection,0);
  assert.equal(run.impact.defenderRightDeflection,0);
  assert.equal(run.checks.length,5);
  assert.equal(run.checks.every(check=>check.pass),true);
});
