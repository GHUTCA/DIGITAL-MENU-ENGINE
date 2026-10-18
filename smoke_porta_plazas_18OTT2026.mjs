#!/usr/bin/env node
/* SMOKE · menu_admin v3.3.1 · LA PORTA DELLE PLAZAS VERSO IL GAS · 📖 MENU BKS V30 · 18-ott-2026
   (🎛 CONTROLLER V30 · bacheca `ARQ LA PORTA DI MENU_ADMIN CHIUSA PRIMA DI DOMATTINA`)
   NON È IL BANCO (quello è di ⚙️ ARQ). Estrae le funzioni VERE (vm) — turnoPortaGasChiusa, avisoPlazasEnAppJl, openAsignar,
   confirmAsignar, doRepetirSemana — con un /salud e un GAS finti. Dice:
   leva "1"/"TRUE"/CSV col locale E turno_pg_on "1" → nessun asignarPlaza / repetirSemana al GAS, avviso e (se il JL accetta) app del JL ·
   leva "0"/""/"FALSE"/CSV senza il locale/campo assente, o turno_pg_on diversa da "1" (lo stato di stasera) → il GAS si chiama come prima · /salud morto o lento → porta CHIUSA ·
   la leva accesa a vista aperta la chiude anche alla conferma.
   Uso: node smoke_porta_plazas_18OTT2026.mjs [menu_admin.html]   (uscita 0 = verde) */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const FILE = process.argv[2] || new URL('./menu_admin.html', import.meta.url);
const html = readFileSync(FILE, 'utf8').replace(/\r/g, '');
let n = 0, rossi = 0;
const ok = (c, nome, extra) => { n++; if (c) console.log('  ✅ ' + nome); else { rossi++; console.log('  🔴 ' + nome + (extra ? '  → ' + extra : '')); } };
function estrai(nome, asincrona) {
  const re = new RegExp('^' + (asincrona ? 'async ' : '') + 'function ' + nome + '\\(', 'm');
  const m = re.exec(html); if (!m) throw new Error('manca ' + nome);
  let i = html.indexOf('{', m.index), d = 0, k = i;
  for (; k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}') { d--; if (d === 0) break; } }
  return html.slice(m.index, k + 1);
}
const riga = (p) => { const a = html.indexOf(p); if (a < 0) throw new Error('manca ' + p); return html.slice(a, html.indexOf('\n', a)); };
const codice = [
  riga("const BORDE_86 = "), riga("const APP_JL_URL = "),
  estrai('turnoEscribeCopre'), estrai('turnoPortaGasChiusa', true), estrai('avisoPlazasEnAppJl'),
  estrai('openAsignar', true), estrai('confirmAsignar', true), estrai('doRepetirSemana', true),
].join('\n');

function mondo(o) {
  o = o || {};
  const log = { gas: [], salud: 0, confirm: [], href: null, toast: [], vista: [] };
  const el = () => ({ textContent: '', value: '', innerHTML: '', disabled: false, style: { display: 'none' } });
  const DOM = { asignarSub: el(), asignarFranja: el(), franjaChips: el(), asignarMeseroSel: el(), asignarMesero: el(), asignarBtn: el() };
  DOM.asignarFranja.value = 'PM'; DOM.asignarMesero.value = 'Ana';
  const ctx = {
    JSON, Date, String, Object, Array, Error, RegExp, Math, Promise, AbortController,
    setTimeout: (f, ms) => setTimeout(f, Math.min(ms, 30)), clearTimeout,
    CFG: { LOCAL: o.local || 'BKS' },
    STATE: { asignarCtx: o.ctx || null },
    STAFF_CACHE: null, FRANJA_DEFAULT: 'PM', FRANJAS_SUGERIDAS: ['AM', 'PM'], lastSavedPin: '0000',
    document: { getElementById: (id) => DOM[id] || el() },
    window: { confirm: (m) => { log.confirm.push(m); return o.acepta !== false; } },
    location: { set href(v) { log.href = v; }, get href() { return log.href; } },
    fetch: async (url, opt) => {
      log.salud++;
      if (!/\/salud$/.test(url)) throw new Error('fetch inatteso ' + url);
      if (o.salud === 'muerto') throw new Error('net');
      if (o.salud === 'lento') return new Promise((res, rej) => { opt.signal.addEventListener('abort', () => rej(new Error('abort'))); });
      if (o.salud === 'html') return { json: async () => { throw new Error('json'); } };
      const leve = typeof o.leva === 'undefined' ? {} : { turno_escribe_pg_on: o.leva };
      if (o.pg !== null) leve.turno_pg_on = typeof o.pg === 'undefined' ? '1' : o.pg;
      if (typeof o.levaDopo !== 'undefined' && log.salud > 1) { leve.turno_escribe_pg_on = o.levaDopo; leve.turno_pg_on = '1'; }
      return { json: async () => ({ ok: true, version: 'v0.200.0', leve }) };
    },
    gasPost: async (accion, p) => { log.gas.push(accion); return { ok: true, copiadas: 0, mesero: p.mesero }; },
    withRetry: (f) => f(),
    showToast: (t, m) => log.toast.push(t + ':' + m),
    showView: (v) => log.vista.push(v), backToTurno: () => log.vista.push('turno'),
    renderMeseroControl: () => {}, loadStaff: async () => {}, loadTurno: async () => {}, renderTurno: () => {},
  };
  vm.createContext(ctx);
  vm.runInContext(codice, ctx);
  return { ctx, log };
}

const C = (o) => mondo(o);
async function apri(o) { const w = C(o); await w.ctx.openAsignar('MAIN', 'PM', 'Ana'); return w; }
async function conferma(o) { const w = C(Object.assign({ ctx: { plaza: 'MAIN' } }, o)); await w.ctx.confirmAsignar(); return w; }
async function ripeti(o) { const w = C(o); await w.ctx.doRepetirSemana(); return w; }

console.log('— leva accesa: la porta del GAS è chiusa');
for (const leva of ['1', 'TRUE', 'true', ' 1 ', 'BKS', 'RSC,BKS', 'rsc, bks ']) {
  const a = await apri({ leva }); ok(a.log.gas.length === 0 && a.log.vista.indexOf('viewAsignar') < 0 && a.log.confirm.length === 1, `openAsignar leva=${JSON.stringify(leva)} → niente vista, avviso`);
  const c = await conferma({ leva }); ok(c.log.gas.length === 0 && c.log.confirm.length === 1, `confirmAsignar leva=${JSON.stringify(leva)} → nessun asignarPlaza`, c.log.gas.join());
  const r = await ripeti({ leva }); ok(r.log.gas.length === 0 && r.log.confirm.length === 1, `doRepetirSemana leva=${JSON.stringify(leva)} → nessun repetirSemana`, r.log.gas.join());
}
{ const a = await apri({ leva: '1' }); ok(a.log.href === 'https://sistema.pinsita.cl/app_jl.html', 'il JL accetta → va all\'app del JL', a.log.href);
  ok(/Las plazas se asignan en la app JL/.test(a.log.confirm[0]) && !/No pude/.test(a.log.confirm[0]), 'il testo è quello del 🎛, senza «No pude» quando /salud risponde'); }
{ const a = await apri({ leva: '1', acepta: false }); ok(a.log.href === null && a.log.gas.length === 0, 'il JL rifiuta → resta qui, e il GAS non si chiama lo stesso'); }

console.log('— leva spenta o non per questo locale: tutto come prima');
for (const leva of ['0', '', 'FALSE', 'false', 'RSC', 'RSC,CDL', undefined]) {
  const a = await apri({ leva }); ok(a.log.vista.indexOf('viewAsignar') >= 0 && a.log.confirm.length === 0, `openAsignar leva=${JSON.stringify(leva)} → apre la vista`);
  const c = await conferma({ leva }); ok(c.log.gas.join() === 'asignarPlaza' && c.log.confirm.length === 0, `confirmAsignar leva=${JSON.stringify(leva)} → asignarPlaza al GAS`, c.log.gas.join());
  const r = await ripeti({ leva }); ok(r.log.gas.join() === 'repetirSemana', `doRepetirSemana leva=${JSON.stringify(leva)} → repetirSemana al GAS`, r.log.gas.join());
}
{ const a = await apri({ leva: 'BKSX' }); ok(a.log.vista.indexOf('viewAsignar') >= 0, 'CSV «BKSX» non è BKS (uguaglianza, non sottostringa)'); }
{ const a = await apri({ leva: 'BKS', local: 'RSC' }); ok(a.log.vista.indexOf('viewAsignar') >= 0, 'leva «BKS» con ?local=RSC → aperta per RSC'); }

console.log('— la strada del bordo deve essere aperta davvero: anche turno_pg_on "1" (⚙️ ARQ, 18-ott 15:43)');
for (const [leva, pg, nome] of [['1', '0', 'stasera: ESCRIBE "1" + PG_ON "0"'], ['1', null, 'turno_pg_on assente'], ['1', '', 'turno_pg_on vuota'], ['1', 'TRUE', 'turno_pg_on "TRUE" (il bordo vuole "1" e basta)'], ['1', ' 1', 'turno_pg_on " 1" (stretta come il bordo)'], ['1', 'BKS', 'turno_pg_on "BKS" (non è CSV)'], ['0', '1', 'ESCRIBE "0" + PG_ON "1"']]) {
  const a = await apri({ leva, pg }); ok(a.log.vista.indexOf('viewAsignar') >= 0 && a.log.confirm.length === 0, nome + ' → porta APERTA');
  const c = await conferma({ leva, pg }); ok(c.log.gas.join() === 'asignarPlaza', nome + ' → asignarPlaza al GAS', c.log.gas.join());
  const r = await ripeti({ leva, pg }); ok(r.log.gas.join() === 'repetirSemana', nome + ' → repetirSemana al GAS', r.log.gas.join());
}
{ const w = C({ leva: '1', pg: '0', levaDopo: '1', ctx: null });
  await w.ctx.openAsignar('MAIN', 'PM', 'Ana'); ok(w.log.vista.indexOf('viewAsignar') >= 0, 'aperta con PG_ON "0"');
  await w.ctx.confirmAsignar(); ok(w.log.gas.length === 0 && w.log.confirm.length === 1, 'PG_ON acceso a scheda aperta → la conferma non parte', w.log.gas.join()); }

console.log('— senza /salud la porta resta CHIUSA (fail-closed)');
for (const salud of ['muerto', 'lento', 'html']) {
  const a = await apri({ salud }); ok(a.log.gas.length === 0 && a.log.vista.indexOf('viewAsignar') < 0 && /No pude verificar/.test(a.log.confirm[0] || ''), `/salud ${salud} → chiusa e lo dice`);
  const c = await conferma({ salud }); ok(c.log.gas.length === 0, `/salud ${salud} → nessun asignarPlaza`);
  const r = await ripeti({ salud }); ok(r.log.gas.length === 0, `/salud ${salud} → nessun repetirSemana`);
}

console.log('— la leva si accende a vista aperta');
{ const w = C({ leva: '0', levaDopo: '1', ctx: null });
  await w.ctx.openAsignar('MAIN', 'PM', 'Ana'); ok(w.log.vista.indexOf('viewAsignar') >= 0, 'aperta con leva 0');
  await w.ctx.confirmAsignar(); ok(w.log.gas.length === 0 && w.log.confirm.length === 1, 'alla conferma la leva è 1 → nessun asignarPlaza', w.log.gas.join()); }

console.log('— il pannello non tocca altro');
ok((html.match(/gasPost\('asignarPlaza'/g) || []).length === 1, 'un solo asignarPlaza nel file (è quello guardato)');
ok((html.match(/gasPost\('repetirSemana'/g) || []).length === 1, 'un solo repetirSemana nel file (è quello guardato)');
ok(/id="ver">menu_admin v3\.3\.1</.test(html), 'id="ver" = menu_admin v3.3.1');

console.log(`\n${rossi ? '🔴' : '🟢'} ${n - rossi}/${n}`);
process.exit(rossi ? 1 : 0);
