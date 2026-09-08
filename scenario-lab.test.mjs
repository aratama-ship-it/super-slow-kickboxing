import test from 'node:test';
import assert from 'node:assert/strict';
import {LAB_CASES,runLabToCompletion} from './scenario-lab.mjs';

test('The lab presents jab defenses as separate ordered cases',()=>{
  assert.equal(LAB_CASES.length,2);
  assert.deepEqual(LAB_CASES.map(item=>item.id),['jab-right-parry','jab-right-block']);
  assert.deepEqual(LAB_CASES.map(item=>item.number),['01','02']);
});

test('Case 01 proves a right parry deflects only the attacking left arm and both sides recover',()=>{
  const run=runLabToCompletion(0);
  assert.equal(run.status,'complete');
  assert.equal(run.impact.event.defense,'parry');
  assert.equal(run.impact.attackerLeftDeflection>3.8,true);
  assert.equal(run.impact.defenderRightDeflection,0);
  assert.equal(run.impact.defenderRightParry,'sweep');
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
