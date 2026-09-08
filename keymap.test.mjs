import test from 'node:test';
import assert from 'node:assert/strict';
import {KEY_BINDINGS,DEFAULT_KEYMAP,normalizeKeymap,assignKey,keyLabel,isAssignableKey} from './keymap.mjs';

test('Default key assignments are complete, unique and readable',()=>{
  assert.equal(Object.keys(DEFAULT_KEYMAP).length,KEY_BINDINGS.length);
  assert.equal(new Set(Object.values(DEFAULT_KEYMAP)).size,KEY_BINDINGS.length);
  assert.equal(keyLabel(DEFAULT_KEYMAP['attack.jab']),'J');
  assert.equal(keyLabel(DEFAULT_KEYMAP.pause),'Space');
});

test('Malformed or duplicate saved assignments safely restore the defaults',()=>{
  assert.deepEqual(normalizeKeymap('{broken'),DEFAULT_KEYMAP);
  assert.deepEqual(normalizeKeymap({'attack.jab':'KeyK','attack.cross':'KeyK'}),DEFAULT_KEYMAP);
  assert.equal(isAssignableKey('Escape'),false);
  assert.equal(isAssignableKey('KeyQ'),true);
});

test('Assigning a used key swaps the two actions instead of creating a conflict',()=>{
  const result=assignKey(DEFAULT_KEYMAP,'attack.jab','KeyK');
  assert.equal(result.changed,true);
  assert.equal(result.swappedActionId,'attack.cross');
  assert.equal(result.map['attack.jab'],'KeyK');
  assert.equal(result.map['attack.cross'],'KeyJ');
  assert.equal(new Set(Object.values(result.map)).size,KEY_BINDINGS.length);
});
