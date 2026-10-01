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
  c.hass = { states:{'vacuum.robot':{state:'docked'}, 'select.robot_cleaning_mode':{state:'Sweeping and mopping',attributes:{options:['Sweeping','Mopping','Sweeping and mopping']}}}, callService };
  return c;
}
test('sends selected numeric segments and clears on success', async () => {
  const calls = []; const c = card(async (...args) => calls.push(args));
  c.selected.add(7); c.selected.add(1); await c.run('clean');
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [['select','select_option',{entity_id:'select.robot_cleaning_mode',option:'Sweeping'}], ['dreame_vacuum','vacuum_clean_segment',{entity_id:'vacuum.robot',segments:[7,1]}]]);
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
  const c = card(() => { calls++; return calls === 1 ? new Promise(resolve => { done = resolve; }) : Promise.resolve(); });
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
test('discovers camera room names and IDs without manual setup', () => {
  const c = card(); c.setConfig({entity:'vacuum.robot'});
  c.hass = { ...c._hass, states:{...c._hass.states, 'camera.robot_map':{attributes:{rooms:{'Keuken':{room_id:9,name:'Keuken'},'Hal':{room_id:12,name:'Hal'}}}}} };
  assert.equal(c.rooms[0].id, 9); assert.equal(c.rooms[0].name, 'Keuken'); assert.equal(c.rooms[1].id, 12);
});
test('reads selected floor and clears selection when floor changes', () => {
  const c = card(); c.setConfig({entity:'vacuum.robot'});
  const states = { ...c._hass.states, 'vacuum.robot':{state:'docked',attributes:{selected_map:'Beneden',rooms:{Beneden:[{id:1,name:'Keuken'}],Boven:[{id:1,name:'Slaapkamer'}]}}} };
  c.hass = {...c._hass,states}; assert.equal(c.rooms[0].name, 'Keuken'); c.selected.add(1);
  states['vacuum.robot'].attributes.selected_map = 'Boven'; c.hass = {...c._hass,states};
  assert.equal(c.rooms[0].name, 'Slaapkamer'); assert.equal(c.selected.size, 0);
});
test('does not discover a map belonging to another robot', () => {
  const c = card(); c.setConfig({entity:'vacuum.robot'});
  c.hass = {...c._hass,states:{...c._hass.states,'camera.other_map':{attributes:{rooms:{A:{room_id:1,name:'Andere robot'}}}}}};
  assert.equal(c.rooms.length, 0);
});
test('mopping selects combined mode and resets after starting', async () => {
  const calls = []; const c = card(async (...args) => calls.push(args)); c.mop = true; c.selected.add(1);
  await c.run('clean'); assert.equal(calls[0][2].option, 'Sweeping and mopping'); assert.equal(calls[1][1], 'vacuum_clean_segment'); assert.equal(c.mop, false);
});
test('missing cleaning mode blocks cleaning instead of using previous mode', async () => {
  const calls = []; const c = card(async (...args) => calls.push(args)); delete c._hass.states['select.robot_cleaning_mode']; c.selected.add(1);
  await c.run('clean'); assert.equal(calls.length, 0); assert.equal(c.selected.size, 1); assert.match(c.message,/reinigingsmodus/);
});
test('disables per-room custom cleaning before forcing vacuum-only', async () => {
  const calls = []; const c = card(async (...args) => calls.push(args)); c._hass.states['switch.robot_customized_cleaning'] = {state:'on'}; c.selected.add(1);
  await c.run('clean'); assert.equal(calls[0][1], 'turn_off'); assert.equal(calls[1][2].option, 'Sweeping'); assert.equal(calls[2][1], 'vacuum_clean_segment');
});
test('explicit map and cleaning-mode entities support renamed entities', async () => {
  const calls = []; const c = card(async (...args) => calls.push(args));
  c.setConfig({entity:'vacuum.robot',map_entity:'camera.floor',cleaning_mode_entity:'select.mode'});
  c.hass = {...c._hass,states:{...c._hass.states,'camera.floor':{attributes:{rooms:[{room_id:4,name:'Entree'}]}},'select.mode':c._hass.states['select.robot_cleaning_mode']}};
  c.selected.add(4); await c.run('clean'); assert.equal(calls[0][2].entity_id, 'select.mode'); assert.equal(calls[1][2].segments[0], 4);
});
