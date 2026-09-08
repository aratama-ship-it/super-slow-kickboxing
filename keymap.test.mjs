import test from 'node:test';
import assert from 'node:assert/strict';
import {KEY_BINDINGS,DEFAULT_KEYMAP,normalizeKeymap,assignKey,keyLabel,isAssignableKey} from './keymap.mjs';

test('Default key assignments are complete, unique and readable',()=>{
  assert.equal(Object.keys(DEFAULT_KEYMAP).length,KEY_BINDINGS.length);
  assert.equal(KEY_BINDINGS.length,19);
  assert.equal(new Set(Object.values(DEFAULT_KEYMAP)).size,KEY_BINDINGS.length);
  assert.deepEqual(DEFAULT_KEYMAP,{
    'target.toggle':'ShiftLeft',
    'attack.jab':'KeyJ','attack.cross':'KeyK','attack.hookL':'KeyU','attack.hookR':'KeyI','attack.upperL':'KeyM','attack.upperR':'Comma',
    'defense.L.parry':'KeyH','defense.R.parry':'KeyL','defense.L.block':'KeyY','defense.R.block':'KeyO','defense.L.body':'KeyN','defense.R.body':'Period',
    'step.in':'KeyW','step.out':'KeyS','slip.L':'KeyA','slip.R':'KeyD',feint:'KeyF',pause:'Space'
  });
  assert.equal(keyLabel(DEFAULT_KEYMAP['target.toggle']),'左Shift');
  assert.equal(keyLabel(DEFAULT_KEYMAP['attack.upperR']),',');
  assert.equal(keyLabel(DEFAULT_KEYMAP['defense.R.body']),'.');
});

test('Malformed or duplicate saved assignments safely restore the defaults',()=>{
  assert.deepEqual(normalizeKeymap('{broken'),DEFAULT_KEYMAP);
  assert.deepEqual(normalizeKeymap({'attack.jab':'KeyK','attack.cross':'KeyK'}),DEFAULT_KEYMAP);
  assert.equal(isAssignableKey('Escape'),false);
  assert.equal(isAssignableKey('ShiftLeft'),true);
  assert.equal(isAssignableKey('ControlLeft'),false);
  assert.equal(isAssignableKey('KeyQ'),true);
});

test('A saved map from before target switching keeps its custom keys and gains the Shift default',()=>{
  const legacy={...DEFAULT_KEYMAP};
  delete legacy['target.toggle'];
  legacy['attack.jab']='KeyQ';
  const normalized=normalizeKeymap(legacy);
  assert.equal(normalized['target.toggle'],'ShiftLeft');
  assert.equal(normalized['attack.jab'],'KeyQ');
});

test('Assigning a used key swaps the two actions instead of creating a conflict',()=>{
  const result=assignKey(DEFAULT_KEYMAP,'attack.jab','KeyK');
  assert.equal(result.changed,true);
  assert.equal(result.swappedActionId,'attack.cross');
  assert.equal(result.map['attack.jab'],'KeyK');
  assert.equal(result.map['attack.cross'],'KeyJ');
  assert.equal(new Set(Object.values(result.map)).size,KEY_BINDINGS.length);
});
