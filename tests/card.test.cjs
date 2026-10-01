const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
let Card;
let Editor;
const context = {
  HTMLElement: class { attachShadow() { this.shadowRoot = {}; } },
  customElements: { get() {}, define(name, value) { if (name.endsWith('-editor')) Editor = value; else Card = value; } },
  CustomEvent: class { constructor(type, options) { this.type = type; Object.assign(this, options); } },
  document: { createElement: tag => ({ tag }) },
  window: {},
};
vm.runInNewContext(fs.readFileSync('dreame-compact-card.js', 'utf8'), context);
function card(callService = async () => {}) {
  const c = new Card();
  c.render = () => {}; c.update = () => {};
  c.setConfig({ entity:'vacuum.robot', rooms:[{id:1,name:'Keuken'},{id:7,name:'Hal'}] });
  c.hass = { states:{'vacuum.robot':{state:'docked'}}, callService };
  return c;
}
test('sends selected numeric segments and clears on success', async () => {
  const calls = []; const c = card(async (...args) => calls.push(args));
  c.selected.add(7); c.selected.add(1); await c.run('clean');
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [['dreame_vacuum','vacuum_clean_segment',{entity_id:'vacuum.robot',segments:[7,1]}]]);
  assert.equal(c.selected.size, 0);
});
test('empty or unavailable cannot start', async () => {
  let calls = 0; const c = card(async () => calls++);
  await c.run('clean'); c.selected.add(1); c._hass.states['vacuum.robot'].state = 'unavailable';
  await c.run('clean'); assert.equal(calls, 0);
});
test('failed request preserves selection and displays error', async () => {
  const c = card(async () => { throw new Error('Geen verbinding'); });
  c.selected.add(1); await c.run('clean');
  assert.equal(c.selected.size, 1); assert.match(c.message, /Geen verbinding/); assert.equal(c.pending, false);
});
test('blocks duplicate requests while awaiting response', async () => {
  let done; let calls = 0;
  const c = card(() => { calls++; return new Promise(resolve => { done = resolve; }); });
  c.selected.add(1); const first = c.run('clean'); await c.run('clean');
  assert.equal(calls, 1); done(); await first;
});
test('standard vacuum controls use vacuum domain', async () => {
  const calls = []; const c = card(async (...args) => calls.push(args));
  await c.run('return_to_base');
  assert.equal(calls[0][0], 'vacuum'); assert.equal(calls[0][1], 'return_to_base');
});
test('rejects duplicate IDs and invalid height', () => {
  const c = card();
  assert.throws(() => c.setConfig({entity:'vacuum.robot',rooms:[{id:1,name:'A'},{id:1,name:'B'}]}));
  assert.throws(() => c.setConfig({entity:'vacuum.robot',rooms:[{id:1,name:'A'}],height:10}));
});
test('card picker creates safe empty setup and exposes visual editor', () => {
  const config = Card.getStubConfig({ states: { 'light.a': {}, 'vacuum.robot': {} } });
  assert.equal(config.entity, 'vacuum.robot');
  assert.equal(config.rooms.length, 0);
  assert.equal(Card.getConfigElement().tag, 'dreame-compact-card-editor');
  const c = card(); c.setConfig(config); assert.equal(c.selected.size, 0);
});
test('editor emits isolated config with bubbling composed event', () => {
  const editor = new Editor(); editor.render = () => {};
  const original = { type:'custom:dreame-compact-card', entity:'vacuum.robot', rooms:[{id:7,name:'Hal'}] };
  editor.setConfig(original);
  editor.config.rooms[0].name = 'Entree';
  editor.shadowRoot.querySelectorAll = () => [];
  let event; editor.dispatchEvent = value => { event = value; };
  editor.emit();
  assert.equal(event.type, 'config-changed'); assert.equal(event.bubbles, true); assert.equal(event.composed, true);
  assert.equal(event.detail.config.rooms[0].name, 'Entree');
  assert.equal(original.rooms[0].name, 'Hal');
  event.detail.config.rooms[0].name = 'Extern'; assert.equal(editor.config.rooms[0].name, 'Entree');
});
test('editor refuses duplicate room IDs until corrected', () => {
  const editor = new Editor(); editor.render = () => {}; editor.setConfig({rooms:[]});
  const inputs = [7,7].map(value => ({ value, error:'', setCustomValidity(message) { this.error = message; }, checkValidity() { return !this.error; }, reportValidity() {} }));
  editor.shadowRoot.querySelectorAll = () => inputs;
  let calls = 0; editor.dispatchEvent = () => calls++;
  editor.emit(); assert.equal(calls, 0); assert.match(inputs[1].error, /al gebruikt/);
  inputs[1].value = 8; editor.emit(); assert.equal(calls, 1);
});
