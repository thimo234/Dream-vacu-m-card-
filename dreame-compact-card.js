/* Dreame Compact Card v0.3.1 — no external dependencies. */
const MODE_OPTIONS = {
  vacuum: ['Sweeping', 'Vacuuming', 'Vacuum', 'Stofzuigen', 'Zuigen', 'Alleen stofzuigen', 'Alleen zuigen'],
  mop: ['Sweeping and mopping', 'Vacuum and mop', 'Stofzuigen en dweilen', 'Zuigen en dweilen', 'Stofzuigen + dweilen', 'Zuigen + dweilen'],
  off: ['Off', 'Uit', 'Disabled', 'Uitgeschakeld'],
};
function findOption(state, aliases, explicit) {
  return state?.attributes?.options?.find(value => typeof value === 'string' && (explicit ? value === explicit : aliases.some(name => name.toLowerCase() === value.toLowerCase())));
}
function eligibleEntities(hass, config, kind) {
  const states = hass?.states || {};
  const registry = hass?.entities || {};
  const device = registry[config.entity]?.device_id;
  return Object.keys(states).filter(id => {
    const state = states[id];
    const entry = registry[id];
    if (kind !== 'vacuum' && device && entry?.device_id && entry.device_id !== device) return false;
    if (entry?.platform && entry.platform !== 'dreame_vacuum') return false;
    if (kind === 'vacuum') return id.startsWith('vacuum.');
    if (kind === 'map') return id.startsWith('camera.') && (state.attributes?.rooms != null || (entry?.platform === 'dreame_vacuum' && /_map$/.test(id)));
    if (!id.startsWith('select.')) return false;
    const identity = `${id} ${entry?.unique_id || ''} ${state.attributes?.friendly_name || ''}`;
    if (kind === 'mode') return /cleaning_mode/i.test(identity) || Boolean(findOption(state, MODE_OPTIONS.vacuum));
    if (kind === 'genius') return /cleangenius|clean genius/i.test(identity);
    return false;
  });
}
function relatedEntity(hass, vacuum, domain, suffix, explicit) {
  if (explicit) return explicit;
  const states = hass?.states || {};
  const conventional = `${domain}.${vacuum?.split('.')[1]}_${suffix}`;
  if (states[conventional]) return conventional;
  const device = hass?.entities?.[vacuum]?.device_id;
  const matches = Object.keys(states).filter(id => id.startsWith(`${domain}.`) && id.endsWith(`_${suffix}`) && device && hass.entities?.[id]?.device_id === device);
  return matches.length === 1 ? matches[0] : undefined;
}

function parseDreameRooms(data) {
  if (!data || typeof data !== 'object') return [];
  const rooms = new Map();
  for (const [key, value] of Object.entries(data)) {
    const id = Number(value?.room_id ?? value?.id ?? key);
    if (!Number.isInteger(id) || id < 1 || !value || typeof value !== 'object') continue;
    rooms.set(id, { id, name: typeof value.name === 'string' && value.name.trim() ? value.name : `Ruimte ${id}`, icon: typeof value.icon === 'string' && value.icon.startsWith('mdi:') ? value.icon : 'mdi:floor-plan' });
  }
  return [...rooms.values()];
}

function discoverRooms(hass, config) {
  const attrs = hass?.states?.[config.entity]?.attributes || {};
  const map = relatedEntity(hass, config.entity, 'camera', 'map', config.map_entity);
  const cameraRooms = parseDreameRooms(hass?.states?.[map]?.attributes?.rooms);
  const vacuumRooms = parseDreameRooms(attrs.rooms?.[attrs.selected_map] ?? (Array.isArray(attrs.rooms) ? attrs.rooms : undefined));
  return { rooms: cameraRooms.length ? cameraRooms : vacuumRooms, context: JSON.stringify([config.entity, map, attrs.selected_map, hass?.states?.[map]?.attributes?.map_id]) };
}

class DreameCompactCard extends HTMLElement {
  static getConfigElement() { return document.createElement('dreame-compact-card-editor'); }
  static getStubConfig(hass) {
    return { entity: Object.keys(hass?.states || {}).find(id => id.startsWith('vacuum.')) || '', title: 'Dreame', height: 360, auto_rooms: true, rooms: [] };
  }
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.selected = new Set();
    this.pending = false;
    this.mop = false;
  }

  setConfig(config) {
    if (config.entity && !config.entity.startsWith('vacuum.')) throw new Error('Vul een vacuum-entiteit in.');
    config = { ...config, rooms: config.rooms ?? [] };
    if (!Array.isArray(config.rooms)) throw new Error('Voeg rooms toe met id en name.');
    const ids = new Set();
    for (const room of config.rooms) {
      if (!Number.isInteger(room.id) || room.id < 1 || typeof room.name !== 'string' || !room.name.trim() || ids.has(room.id)) {
        throw new Error('Elke kamer heeft een uniek positief numeriek id en een naam nodig.');
      }
      ids.add(room.id);
    }
    const height = config.height ?? 360;
    if (!Number.isInteger(height) || height < 260 || height > 1200) throw new Error('height moet tussen 260 en 1200 liggen.');
    this.config = { ...config, height, rooms: config.rooms.map(room => ({ ...room })) };
    this.mop = false;
    this.selected.clear();
    this.message = '';
    this.syncRooms();
    this.render();
  }

  syncRooms() {
    if (!this.config) return false;
    const discovery = discoverRooms(this._hass, this.config);
    const automatic = this.config.auto_rooms !== false;
    const rooms = automatic && discovery.rooms.length ? discovery.rooms : this.config.rooms;
    const signature = JSON.stringify([discovery.context, rooms]);
    if (signature === this._roomSignature) return false;
    if (this._roomContext !== discovery.context) this.selected.clear();
    const ids = new Set(rooms.map(room => room.id));
    for (const id of this.selected) if (!ids.has(id)) this.selected.delete(id);
    this.rooms = rooms;
    this._roomContext = discovery.context;
    this._roomSignature = signature;
    return true;
  }
  set hass(value) { this._hass = value; if (this.syncRooms()) this.render(); else this.update(); }
  getCardSize() { return Math.ceil((this.config?.height ?? 360) / 50); }
  getGridOptions() { return { columns: 12, min_columns: 6, rows: Math.ceil((this.config?.height ?? 360) / 56) }; }

  render() {
    if (!this.config) return;
    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; --accent:var(--primary-color,#238879); }
        * { box-sizing:border-box; }
        ha-card { height:${this.config.height}px; display:flex; flex-direction:column; gap:8px; padding:12px; overflow:hidden; color:var(--primary-text-color,#203631); background:var(--ha-card-background,var(--card-background-color,#fff)); }
        header { display:flex; align-items:center; gap:10px; min-height:40px; flex-shrink:0; }
        .robot { display:inline-flex; width:40px; height:40px; align-items:center; justify-content:center; flex-shrink:0; background:var(--secondary-background-color,#edf4f1); border-radius:14px; padding:8px; color:var(--accent); }
        .heading { flex:1; min-width:0; } h2 { margin:0; font-size:18px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .status, .battery { font-size:12px; color:var(--secondary-text-color,#61736c); }
        .toolbar { display:flex; justify-content:space-between; align-items:center; min-height:32px; flex-shrink:0; font-size:13px; }
        button { font:inherit; cursor:pointer; border:0; touch-action:manipulation; color:inherit; }
        button:focus-visible { outline:3px solid var(--accent); outline-offset:-3px; }
        button:disabled { opacity:.45; cursor:default; }
        .clear { background:transparent; min-height:32px; padding:0 8px; color:var(--accent); }
        .rooms { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); grid-auto-rows:minmax(48px,1fr); align-content:start; gap:8px; overflow:auto; flex:1; min-height:0; }
        .room { display:flex; align-items:center; gap:8px; text-align:left; padding:8px; min-width:0; border:2px solid transparent; border-radius:13px; background:var(--secondary-background-color,#eff3f1); }
        .room span { overflow-wrap:anywhere; font-size:14px; flex:1; }
        .room[aria-pressed=true] { border-color:var(--accent); background:var(--primary-background-color,#e5f3ee); }
        .check { font-size:17px; color:var(--accent); }
        footer { display:grid; grid-template-columns:minmax(0,1fr) 46px 46px; gap:8px; flex-shrink:0; }
        footer button { min-height:46px; border-radius:12px; background:var(--secondary-background-color,#eff3f1); }
        .start { background:var(--accent); color:var(--text-primary-color,#fff); font-weight:600; padding:8px; }
        .message { margin:0; font-size:12px; max-height:44px; overflow:auto; } .message:empty { display:none; }
        .modes { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; flex-shrink:0; }
        .modes button { min-height:44px; padding:6px; font-size:13px; border:2px solid transparent; border-radius:12px; background:var(--secondary-background-color,#eff3f1); }
        .modes button[aria-pressed=true] { border-color:var(--accent); color:var(--accent); font-weight:600; }
      </style>
      <ha-card>
        <header><ha-icon class="robot" icon="mdi:robot-vacuum"></ha-icon><div class="heading"><h2></h2><span class="status"></span></div><span class="battery"></span></header>
        <div class="toolbar"><span class="count"></span><button class="clear">Wis selectie</button></div>
        <div class="rooms" role="group" aria-label="Ruimtes selecteren"></div>
        <div class="modes" role="group" aria-label="Reinigingsmodus"><button class="vacuum-mode" aria-pressed="true">Alleen zuigen</button><button class="mop-mode" aria-pressed="false">Zuigen + dweilen</button></div>
        <p class="message" role="status" aria-live="polite"></p>
        <footer><button class="start"></button><button class="pause" aria-label="Pauzeren" title="Pauzeren"><ha-icon icon="mdi:pause"></ha-icon></button><button class="dock" aria-label="Naar laadstation" title="Naar laadstation"><ha-icon icon="mdi:home-import-outline"></ha-icon></button></footer>
      </ha-card>`;
    this.shadowRoot.querySelector('h2').textContent = this.config.title || 'Dreame';
    const container = this.shadowRoot.querySelector('.rooms');
    for (const room of this.rooms || []) {
      const button = document.createElement('button');
      button.className = 'room';
      button.dataset.id = room.id;
      const icon = document.createElement('ha-icon');
      icon.setAttribute('icon', room.icon || 'mdi:floor-plan');
      const label = document.createElement('span');
      label.textContent = room.name;
      const check = document.createElement('b');
      check.className = 'check';
      check.setAttribute('aria-hidden', 'true');
      button.append(icon, label, check);
      button.onclick = () => {
        if (this.pending) return;
        this.selected.has(room.id) ? this.selected.delete(room.id) : this.selected.add(room.id);
        this.message = ''; this.update();
      };
      container.append(button);
    }
    this.shadowRoot.querySelector('.clear').onclick = () => { this.selected.clear(); this.update(); };
    this.shadowRoot.querySelector('.start').onclick = () => this.run('clean');
    this.shadowRoot.querySelector('.pause').onclick = () => this.run('pause');
    this.shadowRoot.querySelector('.dock').onclick = () => this.run('return_to_base');
    this.shadowRoot.querySelector('.vacuum-mode').onclick = () => { if (!this.pending) { this.mop = false; this.update(); } };
    this.shadowRoot.querySelector('.mop-mode').onclick = () => { if (!this.pending) { this.mop = true; this.update(); } };
    this.update();
  }

  update() {
    if (!this.config || !this.shadowRoot.querySelector('ha-card')) return;
    const state = this._hass?.states[this.config.entity];
    const offline = !state || ['unavailable', 'unknown'].includes(state.state);
    const labels = { docked:'Op het laadstation', cleaning:'Bezig met schoonmaken', returning:'Onderweg naar laadstation', paused:'Gepauzeerd', idle:'Gereed', error:'Storing', unavailable:'Niet beschikbaar', unknown:'Onbekend' };
    const q = selector => this.shadowRoot.querySelector(selector);
    q('.status').textContent = state ? (labels[state.state] || state.state) : 'Entiteit niet beschikbaar';
    const battery = state?.attributes?.battery_level;
    q('.battery').textContent = typeof battery === 'number' ? `${battery}%` : '';
    q('.count').textContent = `${this.selected.size} geselecteerd`;
    for (const button of this.shadowRoot.querySelectorAll('.room')) {
      const active = this.selected.has(Number(button.dataset.id));
      button.setAttribute('aria-pressed', String(active));
      button.querySelector('.check').textContent = active ? '✓' : '';
      button.disabled = this.pending;
    }
    q('.start').textContent = this.pending ? 'Even wachten…' : `Start${this.selected.size ? ` · ${this.selected.size} ${this.selected.size === 1 ? 'ruimte' : 'ruimtes'}` : ' schoonmaken'}`;
    q('.start').disabled = offline || this.pending || !this.selected.size || ['cleaning', 'returning', 'error'].includes(state?.state);
    q('.pause').disabled = offline || this.pending || state?.state !== 'cleaning';
    q('.dock').disabled = offline || this.pending || ['docked', 'returning'].includes(state?.state);
    q('.clear').disabled = this.pending || !this.selected.size;
    q('.vacuum-mode').setAttribute('aria-pressed', String(!this.mop));
    q('.mop-mode').setAttribute('aria-pressed', String(this.mop));
    q('.vacuum-mode').disabled = this.pending;
    q('.mop-mode').disabled = this.pending;
    q('.message').textContent = this.message || (!this.rooms?.length ? 'Geen kamers gevonden. Kies de kaartcamera in de editor of voeg kamers handmatig toe.' : '');
  }

  async prepareMode(hass, config, mop) {
    const modeEntity = relatedEntity(hass, config.entity, 'select', 'cleaning_mode', config.cleaning_mode_entity);
    const mode = hass.states[modeEntity];
    if (!mode || ['unavailable', 'unknown'].includes(mode.state)) throw new Error('Kies een beschikbare reinigingsmodus-entiteit in de kaarteditor.');
    const option = findOption(mode, mop ? MODE_OPTIONS.mop : MODE_OPTIONS.vacuum, mop ? config.mop_option : config.vacuum_option);
    if (!option) throw new Error(mop ? 'Deze stofzuiger biedt geen stofzuigen met dweilen aan.' : 'De optie alleen stofzuigen is niet beschikbaar.');
    const genius = relatedEntity(hass, config.entity, 'select', 'cleangenius', config.cleangenius_entity);
    const geniusState = hass.states[genius];
    if (config.cleangenius_entity && (!geniusState || ['unavailable', 'unknown'].includes(geniusState.state))) throw new Error('De gekozen CleanGenius-entiteit is niet beschikbaar.');
    if (geniusState) {
      const off = findOption(geniusState, MODE_OPTIONS.off, config.cleangenius_off_option);
      if (!off) throw new Error('Kies de uit-optie voor CleanGenius in de kaarteditor.');
      // Always send this first: the robot may still be using its intelligent routine.
      await hass.callService('select', 'select_option', { entity_id:genius, option:off });
    }
    const custom = relatedEntity(hass, config.entity, 'switch', 'customized_cleaning');
    if (hass.states[custom]?.state === 'on') await hass.callService('switch', 'turn_off', { entity_id:custom });
    await hass.callService('select', 'select_option', { entity_id:modeEntity, option });
  }

  async run(action) {
    const state = this._hass?.states[this.config.entity];
    if (this.pending || !state || ['unknown', 'unavailable'].includes(state.state)) return;
    if (action === 'clean' && (!this.selected.size || ['cleaning', 'returning', 'error'].includes(state.state))) return;
    this.pending = true; this.message = ''; this.update();
    const hass = this._hass;
    const config = this.config;
    const context = this._roomContext;
    const segments = [...this.selected];
    const mop = this.mop;
    try {
      if (action === 'clean') {
        await this.prepareMode(hass, config, mop);
        if (this.config !== config || context !== this._roomContext) throw new Error('De kaart of verdieping is gewijzigd. Selecteer de kamers opnieuw.');
        await hass.callService('dreame_vacuum', 'vacuum_clean_segment', { entity_id:config.entity, segments });
        this.selected.clear();
        this.mop = false;
      } else {
        await this._hass.callService('vacuum', action, { entity_id:this.config.entity });
      }
      this.message = 'Opdracht verstuurd.';
    } catch (error) {
      this.message = `Opdracht mislukt: ${error?.message || String(error)}`;
    } finally { this.pending = false; this.update(); }
  }
}
class DreameCompactCardEditor extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: 'open' }); }
  setConfig(config) {
    this.config = { ...config, rooms: (config.rooms || []).map(room => ({ ...room })) };
    this.render();
  }
  set hass(value) {
    this._hass = value;
    const signature = JSON.stringify(Object.entries(value?.states || {}).filter(([id]) => /^(vacuum|camera|select)\./.test(id)).map(([id, state]) => [id, state.attributes?.friendly_name, state.attributes?.rooms, state.attributes?.selected_map, state.attributes?.options, value.entities?.[id]?.device_id, value.entities?.[id]?.platform]));
    if (signature !== this._entities) { this._entities = signature; this.render(); }
    else for (const picker of this.shadowRoot.querySelectorAll('ha-entity-picker')) picker.hass = value;
  }
  emit() {
    const inputs = [...this.shadowRoot.querySelectorAll('input')];
    for (const input of inputs) input.setCustomValidity('');
    const ids = new Set();
    for (const input of this.shadowRoot.querySelectorAll('[data-room-id]')) {
      const id = Number(input.value);
      if (ids.has(id)) input.setCustomValidity('Dit kamer-ID is al gebruikt.');
      ids.add(id);
    }
    const invalid = inputs.find(input => !input.checkValidity());
    if (invalid) { invalid.reportValidity(); return; }
    this.dispatchEvent(new CustomEvent('config-changed', {
      bubbles: true, composed: true,
      detail: { config: { ...this.config, rooms: this.config.rooms.map(room => ({ ...room })) } },
    }));
  }
  render() {
    if (!this.config) return;
    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; color:var(--primary-text-color); }
        * { box-sizing:border-box; } .fields { display:grid; gap:14px; }
        label { display:grid; gap:6px; font-size:14px; }
        input, select, button { font:inherit; color:var(--primary-text-color); background:var(--card-background-color,#fff); border:1px solid var(--divider-color,#aaa); border-radius:8px; padding:10px; min-height:44px; width:100%; }
        button { cursor:pointer; } input:focus, select:focus, button:focus-visible { outline:2px solid var(--primary-color); }
        fieldset { min-width:0; border:1px solid var(--divider-color,#ccc); border-radius:10px; padding:12px; margin:0; display:grid; gap:10px; }
        .room-fields { display:grid; grid-template-columns:90px minmax(0,1fr); gap:10px; }
        p { font-size:13px; color:var(--secondary-text-color); } .rooms { display:grid; gap:12px; }
      </style>
      <div class="fields">
        <ha-entity-picker class="entity"></ha-entity-picker>
        <label>Titel<input class="title" type="text" placeholder="Dreame"></label>
        <label>Hoogte in pixels<input class="height" type="number" min="260" max="1200" step="1" required></label>
        <label>Kamers<select class="auto"><option value="true">Automatisch uit de robotkaart</option><option value="false">Handmatig ingevulde kamers</option></select></label>
        <ha-entity-picker class="map"></ha-entity-picker>
        <ha-entity-picker class="mode"></ha-entity-picker>
        <ha-entity-picker class="genius"></ha-entity-picker>
        <label>Optie voor CleanGenius uit<select class="off-option"><option value="">Automatisch herkennen</option></select></label>
        <label>Optie voor alleen zuigen<select class="vacuum-option"><option value="">Automatisch herkennen</option></select></label>
        <label>Optie voor zuigen + dweilen<select class="mop-option"><option value="">Automatisch herkennen</option></select></label>
        <p class="detected"></p>
        <p>Standaard is ‘Alleen zuigen’ geselecteerd. Kies ‘Zuigen + dweilen’ voor beide. Selecteer kamers en druk op Start. Handmatige kamers worden gebruikt als automatisch geen kamers gevonden worden.</p>
        <div class="rooms"></div>
        <button class="add" type="button">Kamer toevoegen</button>
      </div>`;
    const q = selector => this.shadowRoot.querySelector(selector);
    q('.auto').value = String(this.config.auto_rooms !== false);
    q('.auto').onchange = event => { this.config.auto_rooms = event.target.value === 'true'; this.emit(); };
    for (const [selector, key, kind, domain, label] of [
      ['.entity', 'entity', 'vacuum', 'vacuum', 'Stofzuiger'],
      ['.map', 'map_entity', 'map', 'camera', 'Kaartcamera'],
      ['.mode', 'cleaning_mode_entity', 'mode', 'select', 'Reinigingsmodus-entiteit'],
      ['.genius', 'cleangenius_entity', 'genius', 'select', 'CleanGenius-entiteit'],
    ]) {
      const picker = q(selector);
      const candidates = eligibleEntities(this._hass, this.config, kind);
      picker.hass = this._hass;
      picker.label = label;
      picker.placeholder = kind === 'vacuum' ? 'Zoek een stofzuiger' : 'Automatisch herkennen';
      picker.helper = 'Zoek op naam of entiteits-ID. Alleen geschikte entiteiten worden getoond.';
      picker.includeDomains = [domain];
      picker.includeEntities = candidates;
      picker.entityFilter = state => candidates.includes(state.entity_id);
      picker.allowCustomEntity = false;
      picker.showEntityId = true;
      picker.required = kind === 'vacuum';
      picker.value = this.config[key] || undefined;
      picker.addEventListener('value-changed', event => {
        event.stopPropagation();
        const value = event.detail.value || '';
        if (value && !candidates.includes(value)) return;
        this.config[key] = value;
        this.emit();
      });
    }
    const modeId = relatedEntity(this._hass, this.config.entity, 'select', 'cleaning_mode', this.config.cleaning_mode_entity);
    const geniusId = relatedEntity(this._hass, this.config.entity, 'select', 'cleangenius', this.config.cleangenius_entity);
    for (const [selector, key, entityId] of [['.off-option', 'cleangenius_off_option', geniusId], ['.vacuum-option', 'vacuum_option', modeId], ['.mop-option', 'mop_option', modeId]]) {
      const picker = q(selector);
      const options = [...(this._hass?.states?.[entityId]?.attributes?.options || [])];
      if (this.config[key] && !options.includes(this.config[key])) options.push(this.config[key]);
      for (const value of options) {
        const option = document.createElement('option'); option.value = value; option.textContent = value; picker.append(option);
      }
      picker.value = this.config[key] || '';
      picker.onchange = () => { this.config[key] = picker.value; this.emit(); };
    }
    const discovered = discoverRooms(this._hass, this.config).rooms;
    q('.detected').textContent = discovered.length ? `Gevonden kamers: ${discovered.map(room => room.name).join(', ')}` : 'Nog geen kamers gevonden. Kies zo nodig de kaartcamera van je Dreame.';
    q('.title').value = this.config.title ?? 'Dreame';
    q('.title').onchange = event => { this.config.title = event.target.value; this.emit(); };
    q('.height').value = this.config.height ?? 360;
    q('.height').onchange = event => { this.config.height = Number(event.target.value); this.emit(); };
    this.config.rooms.forEach((room, index) => {
      const fieldset = document.createElement('fieldset');
      fieldset.innerHTML = `<legend></legend><div class="room-fields"><label>Kamer-ID<input data-room-id type="number" min="1" step="1" required></label><label>Naam<input class="name" type="text" required pattern=".*\\S.*"></label></div><label>Icoon<input class="icon" type="text" placeholder="mdi:floor-plan"></label><button type="button">Kamer verwijderen</button>`;
      fieldset.querySelector('legend').textContent = `Kamer ${index + 1}`;
      for (const [selector, key] of [['[data-room-id]', 'id'], ['.name', 'name'], ['.icon', 'icon']]) {
        const input = fieldset.querySelector(selector); input.value = room[key] ?? '';
        input.onchange = () => { this.config.rooms[index][key] = key === 'id' ? Number(input.value) : input.value; this.emit(); };
      }
      fieldset.querySelector('button').onclick = () => {
        this.config.rooms.splice(index, 1); this.render(); this.emit();
      };
      q('.rooms').append(fieldset);
    });
    q('.add').onclick = () => {
      // Never guess a real room ID: user must enter it before the config is emitted.
      this.config.rooms.push({ id: '', name: '', icon: 'mdi:floor-plan' });
      this.render();
      this.shadowRoot.querySelectorAll('[data-room-id]')[this.config.rooms.length - 1].focus();
    };
  }
}
if (!customElements.get('dreame-compact-card-editor')) customElements.define('dreame-compact-card-editor', DreameCompactCardEditor);
if (!customElements.get('dreame-compact-card')) customElements.define('dreame-compact-card', DreameCompactCard);
window.customCards = window.customCards || [];
window.customCards.push({ type:'dreame-compact-card', name:'Dreame Compact Card', description:'Compacte kamerselectie voor je Dreame met visuele configuratie.' });
