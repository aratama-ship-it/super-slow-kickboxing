export const KEY_BINDINGS=Object.freeze([
  Object.freeze({id:'attack.jab',label:'左ジャブ',group:'パンチ',defaultCode:'KeyJ',selector:'[data-attack="jab"]',kind:'attack',value:'jab'}),
  Object.freeze({id:'attack.cross',label:'右ストレート',group:'パンチ',defaultCode:'KeyK',selector:'[data-attack="cross"]',kind:'attack',value:'cross'}),
  Object.freeze({id:'attack.hookL',label:'左フック',group:'パンチ',defaultCode:'KeyU',selector:'[data-attack="hookL"]',kind:'attack',value:'hookL'}),
  Object.freeze({id:'attack.hookR',label:'右フック',group:'パンチ',defaultCode:'KeyI',selector:'[data-attack="hookR"]',kind:'attack',value:'hookR'}),
  Object.freeze({id:'attack.upperL',label:'左アッパー',group:'パンチ',defaultCode:'KeyN',selector:'[data-attack="upperL"]',kind:'attack',value:'upperL'}),
  Object.freeze({id:'attack.upperR',label:'右アッパー',group:'パンチ',defaultCode:'KeyM',selector:'[data-attack="upperR"]',kind:'attack',value:'upperR'}),
  Object.freeze({id:'defense.L.parry',label:'左手パーリング',group:'守り',defaultCode:'Digit1',selector:'[data-defense-side="L"][data-defense="parry"]',kind:'defense',side:'L',value:'parry'}),
  Object.freeze({id:'defense.R.parry',label:'右手パーリング',group:'守り',defaultCode:'Digit2',selector:'[data-defense-side="R"][data-defense="parry"]',kind:'defense',side:'R',value:'parry'}),
  Object.freeze({id:'defense.L.block',label:'左手ブロッキング',group:'守り',defaultCode:'Digit3',selector:'[data-defense-side="L"][data-defense="block"]',kind:'defense',side:'L',value:'block'}),
  Object.freeze({id:'defense.R.block',label:'右手ブロッキング',group:'守り',defaultCode:'Digit4',selector:'[data-defense-side="R"][data-defense="block"]',kind:'defense',side:'R',value:'block'}),
  Object.freeze({id:'defense.L.body',label:'左手お腹ブロッキング',group:'守り',defaultCode:'Digit5',selector:'[data-defense-side="L"][data-defense="body"]',kind:'defense',side:'L',value:'body'}),
  Object.freeze({id:'defense.R.body',label:'右手お腹ブロッキング',group:'守り',defaultCode:'Digit6',selector:'[data-defense-side="R"][data-defense="body"]',kind:'defense',side:'R',value:'body'}),
  Object.freeze({id:'step.in',label:'半歩近づく',group:'位置・その他',defaultCode:'KeyW',selector:'[data-step="in"]',kind:'step',value:'in'}),
  Object.freeze({id:'step.out',label:'半歩離れる',group:'位置・その他',defaultCode:'KeyS',selector:'[data-step="out"]',kind:'step',value:'out'}),
  Object.freeze({id:'slip.L',label:'左へ頭をずらす',group:'位置・その他',defaultCode:'KeyA',selector:'[data-slip="L"]',kind:'slip',value:'L'}),
  Object.freeze({id:'slip.R',label:'右へ頭をずらす',group:'位置・その他',defaultCode:'KeyD',selector:'[data-slip="R"]',kind:'slip',value:'R'}),
  Object.freeze({id:'feint',label:'引く・フェイント',group:'位置・その他',defaultCode:'KeyF',selector:'#feint',kind:'feint'}),
  Object.freeze({id:'pause',label:'一時停止・再開',group:'位置・その他',defaultCode:'Space',selector:'#pause',kind:'pause'}),
]);

export const DEFAULT_KEYMAP=Object.freeze(Object.fromEntries(KEY_BINDINGS.map(action=>[action.id,action.defaultCode])));
const ACTION_IDS=new Set(KEY_BINDINGS.map(action=>action.id));
const RESERVED_CODES=new Set(['Escape','Tab','ShiftLeft','ShiftRight','ControlLeft','ControlRight','AltLeft','AltRight','MetaLeft','MetaRight','CapsLock','ContextMenu','PrintScreen','BrowserBack','BrowserForward','BrowserRefresh']);
const LABELS={Space:'Space',Enter:'Enter',Backspace:'Backspace',Delete:'Delete',ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',Comma:',',Period:'.',Slash:'/',Semicolon:';',Quote:"'",BracketLeft:'[',BracketRight:']',Backslash:'\\',Minus:'-',Equal:'=',Backquote:'`',IntlYen:'¥',IntlRo:'ろ',IntlBackslash:'\\'};

export function isAssignableKey(code){
  return typeof code==='string'&&code.length>0&&!RESERVED_CODES.has(code)&&!/^F\d{1,2}$/.test(code);
}

export function keyLabel(code){
  if(LABELS[code])return LABELS[code];
  if(/^Key[A-Z]$/.test(code))return code.slice(3);
  if(/^Digit[0-9]$/.test(code))return code.slice(5);
  if(/^Numpad[0-9]$/.test(code))return 'Num '+code.slice(6);
  return code;
}

export function normalizeKeymap(source){
  let parsed=source;
  if(typeof source==='string'){
    try{parsed=JSON.parse(source);}catch{return {...DEFAULT_KEYMAP};}
  }
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return {...DEFAULT_KEYMAP};
  const next={},used=new Set();
  for(const action of KEY_BINDINGS){
    const code=parsed[action.id]??action.defaultCode;
    if(!isAssignableKey(code)||used.has(code))return {...DEFAULT_KEYMAP};
    next[action.id]=code;used.add(code);
  }
  return next;
}

export function assignKey(source,actionId,code){
  const map=normalizeKeymap(source);
  if(!ACTION_IDS.has(actionId)||!isAssignableKey(code))return {map,changed:false,swappedActionId:null,previousCode:null};
  const previousCode=map[actionId];
  if(previousCode===code)return {map,changed:false,swappedActionId:null,previousCode};
  const swappedActionId=Object.keys(map).find(id=>id!==actionId&&map[id]===code)||null;
  map[actionId]=code;
  if(swappedActionId)map[swappedActionId]=previousCode;
  return {map,changed:true,swappedActionId,previousCode};
}
