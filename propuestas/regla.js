/* ═══ strumenti.js · 5.2-PE · LA REGOLA DEGLI STRUMENTI AL BORDO · 🎛 BKP V32 · mer 4-nov-2026 ════════════════════════════════════════════
   §2-§3 di `4_CANTIERE_MENU/TABELLE_E_PANNELLO_STRUMENTI_5_2_PE_04NOV2026.md` (📖 MENU BKS, D-433), sulle tabelle della DDL `abda59afc1`
   di 🚚 (`strumento_vigente` · `strumento_parte_vigente` · `strumento_gesto_vigente`). UNA risposta per il cliente, la comandera e la
   guardia del pedido: chi si vede adesso, a che prezzo, in che ordine, e chi vince lo stesso posto.
   PURO: niente rete, niente storage. L'orologio è un argomento (`now`). Il chiamante porta le righe e la carta già giudicata.
   Nasce spento: nessuno lo chiama finché la leva `STRUMENTI_PG_ON` e il cablaggio non esistono (vivo lun 9-nov, con AUT).

   Le scelte dichiarate (dove il disegno non dice, si sceglie il verso chiuso e si scrive qui):
     · il GIORNO di una finestra è quello OPERATIVO (taglio 06:00): Botellas 22:00–03:00 del venerdì è ancora «venerdì» alle 02:00.
       `dias` e `fecha_desde/fecha_hasta` si leggono sul giorno operativo. Una finestra che attraversa le 06:00 non è prevista.
     · la finestra è [desde, hasta), come `timeInRange` del GAS; `hasta < desde` passa la mezzanotte. Senza desde/hasta: sempre.
     · il PUSH del JL (`strumento_gesto` `push`, `valor.hasta`) sposta la FINE, anticipa o prolunga, dentro (desde, hasta_tope]: `hasta` è
       la fine normale, `hasta_tope` il tetto (null ⇒ tetto = hasta, solo accorciare). Per una parte: (parte.desde, hasta_tope dello strumento].
       Fuori si ignora e si dice (`push_fuori_finestra`). Vale l'ultimo push del giorno operativo. (📖, «IL PUSH HA UN TETTO SUO», 4-nov)
     · la LEVA del prezzo: l'ultimo `leva_precio` del giorno, se `a` è fra i `precios` dello strumento; se no `precio_default`; se no il primo.
     · il GRUPPO (la madre «noche») è UNO STRUMENTO con lo stesso nome: acceso ⇔ lo strumento vigente `id_strumento = upper(grupo)` è
       activo ∧ oggi ∧ dentro la finestra adesso (col suo push). Un gruppo senza quello strumento è SPENTO (chiuso). Un livello solo:
       il `grupo` dello strumento-gruppo stesso non si segue. (📖, «IL GRUPPO È UNO STRUMENTO», 4-nov)
     · il MENÚ: si vede se il contenitore si vende E, per ogni `rol` presente fra le parti, almeno una parte di quel rol si vende.
       Il contenitore prende il prezzo dello strumento; le parti restano al listino (sono opzioni, non prezzi).
     · due strumenti di PREZZO sullo stesso prodotto: vince come lo stesso posto (§3) — finestra più stretta adesso, poi prioridad, poi
       ts_registro più recente. Il RECARGO si applica sopra, a parte, arrotondato al peso.
     · una parte incoerente (precio su un tipo che non lo vuole, rol fuori dal menú, ora fuori dalla finestra) non rompe niente: il suo
       campo si ignora o la parte esce, e il motivo è nella risposta (il pannello la mostra in rosso). */
/* DEMO del pannello «Propuestas» (📖 MENU BKS, 4-nov): COPIA ESATTA di pinsita-borde src/strumenti.js (blob 96f090fe, vivo 9a8c1bd),
   con i due aiuti dell'orologio di src/menu51.js scritti qui al posto dell'import. Nel vero il pannello chiede l'anteprima AL BORDO: questa copia vive solo in demo/. */
const _fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Santiago', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
export const GIORNO_DA_JS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
export function parteSantiago(ms) { const o = {}; for (const p of _fmt.formatToParts(new Date(ms))) if (p.type !== 'literal') o[p.type] = parseInt(p.value, 10); const dow = new Date(Date.UTC(o.year, o.month - 1, o.day)).getUTCDay(); return { y: o.year, m: o.month, d: o.day, hh: o.hour % 24, mm: o.minute, ss: o.second, dow: dow }; }

export const STRUMENTI_VERSION = 'strumenti 0.1.0';
const TIPI = ['menu', 'botellas', 'multiplo', 'precio_fijo', 'recargo', 'evento', 'escena', 'destacados', 'fondo'];
const SENZA_PARTI = ['evento', 'escena', 'fondo'];        // si vedono senza una parte che si vende
const PREZZO_IN_PARTE = ['botellas', 'precio_fijo'];      // gli unici tipi in cui la parte porta il suo prezzo
const ROLI = ['entrada', 'bebida', 'fondo', 'postre'];
const tx = (v) => (v == null ? '' : String(v)).trim();

/** «HH:MM» o «HH:MM:SS» → minuti dalla mezzanotte; null se non è un'ora. */
export function minDa(v) {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(tx(v));
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  return h < 24 && mi < 60 ? h * 60 + mi : null;
}
/** minuti dall'inizio del giorno operativo (06:00 = 0). */
const op = (min) => (min - 360 + 1440) % 1440;
/** la finestra [d, h) in minuti di orologio, letta sul giorno operativo; d === h non è una finestra. */
function dentro(minOra, d, h) {
  if (d == null && h == null) return true;
  if (d == null || h == null || d === h) return false;
  const n = op(minOra), a = op(d), b = op(h);
  return a < b ? (n >= a && n < b) : (n >= a || n < b);
}
/** quanti minuti restano fino alla fine della finestra (per «la più stretta adesso»); Infinity senza finestra. */
function restano(minOra, d, h) {
  if (d == null || h == null) return Infinity;
  return (op(h) - op(minOra) + 1440) % 1440 || 1440;
}
/** la finestra [pd, ph) sta dentro [d, h)? (letta sul giorno operativo) */
function contenuta(pd, ph, d, h) {
  if (d == null && h == null) return true;
  if (pd == null || ph == null) return false;
  const A = op(d), B = op(h) || 1440, a = op(pd), b = op(ph) || 1440;
  return A < B && a < b && a >= A && b <= B;
}

/** il giorno operativo di `now`: data «YYYY-MM-DD» e lettera del giorno (L…D), col taglio delle 06:00. */
export function giornoOperativo(now) {
  const p = parteSantiago(now - 6 * 3600 * 1000);
  return { fecha: p.y + '-' + String(p.m).padStart(2, '0') + '-' + String(p.d).padStart(2, '0'), dia: GIORNO_DA_JS[p.dow] };
}

/** §3: chi vince lo stesso posto. Finestra più stretta adesso, poi prioridad (1 = più alta, null in fondo), poi il ts_registro più recente.
    MAI l'ordine delle righe: a parità piena decide l'id (stabile, non la posizione). */
export function vinceSlot(cands) {
  return (cands || []).slice().sort(function (x, y) {
    if (x._restano !== y._restano) return x._restano - y._restano;
    const px = x.prioridad == null ? Infinity : +x.prioridad, py = y.prioridad == null ? Infinity : +y.prioridad;
    if (px !== py) return px - py;
    const tx2 = Date.parse(x.ts_registro || 0) || 0, ty = Date.parse(y.ts_registro || 0) || 0;
    if (tx2 !== ty) return ty - tx2;
    return tx(x.id) < tx(y.id) ? -1 : tx(x.id) > tx(y.id) ? 1 : 0;
  })[0] || null;
}

/** l'ordine di una lista: `orden` (null in fondo), poi l'alfabeto del nome, poi l'id. */
function perOrden(a, b) {
  const oa = a.orden == null ? Infinity : +a.orden, ob = b.orden == null ? Infinity : +b.orden;
  if (oa !== ob) return oa - ob;
  const na = tx(a.nombre).toLowerCase(), nb = tx(b.nombre).toLowerCase();
  if (na !== nb) return na < nb ? -1 : 1;
  return tx(a.id) < tx(b.id) ? -1 : tx(a.id) > tx(b.id) ? 1 : 0;
}

/** l'ultimo gesto di quel giorno operativo per (strumento, prodotto|null, azione). */
function ultimoGesto(gesti, fecha, idS, idP, accion) {
  let best = null;
  for (const g of gesti || []) {
    if (!g || tx(g.id_strumento) !== idS || tx(g.accion) !== accion || tx(g.fecha_op).slice(0, 10) !== fecha) continue;
    if ((idP == null ? tx(g.id_producto) !== '' : tx(g.id_producto) !== idP)) continue;
    const t = Date.parse(g.ts || g.ts_registro || 0) || 0;
    if (!best || t >= best.t) best = { g: g, t: t };
  }
  return best ? best.g : null;
}
const valore = (g) => { const v = g && g.valor; if (v && typeof v === 'object') return v; try { return JSON.parse(v); } catch (e) { return null; } };
const arr = (v) => { if (Array.isArray(v)) return v; try { const j = JSON.parse(v); return Array.isArray(j) ? j : null; } catch (e) { return null; } };
const obj = (v) => { if (v && typeof v === 'object' && !Array.isArray(v)) return v; try { const j = JSON.parse(v); return j && typeof j === 'object' && !Array.isArray(j) ? j : null; } catch (e) { return null; } };

/**
 * @param {object} a
 *   strumenti: righe di `strumento_vigente` · parti: righe di `strumento_parte_vigente` · gesti: righe di `strumento_gesto_vigente`
 *   carta: { [id_producto]: { precio, vende, nombre } } — `vende` già giudicato dal chiamante (stazione o Hasta proprio, attivo, finestra
 *          del prodotto); qui si toglie solo l'86 · ago86: array di id_producto · local · now (ms)
 * @returns { ok, version, ahora, strumenti[], prodotti{}, contenitori{}, slot(tipo) }
 */
export function strumentiAdesso(a) {
  const A = a || {};
  const now = Number(A.now);
  if (!Number.isFinite(now)) return { ok: false, perche: 'sin_reloj' };
  const local = tx(A.local).toUpperCase();
  const p = parteSantiago(now);
  const minOra = p.hh * 60 + p.mm;
  const go = giornoOperativo(now);
  const carta = A.carta && typeof A.carta === 'object' ? A.carta : {};
  const ago = {}; for (const id of A.ago86 || []) ago[tx(id)] = true;
  const vende = (id) => { const c = carta[id]; return !!(c && c.vende === true && !ago[id]); };
  const listino = (id) => { const c = carta[id]; const n = c ? Math.round(Number(c.precio)) : NaN; return Number.isFinite(n) && n > 0 ? n : null; };

  /* il gruppo: lo strumento con lo stesso nome, visibile adesso (activo · oggi · data · finestra col suo push). Solo cancelli: niente parti. */
  const perId = {}; for (const s of A.strumenti || []) if (s && s.borrado !== true && (!local || tx(s.local).toUpperCase() === local)) perId[tx(s.id_strumento).toUpperCase()] = s;
  const _gruppi = {};
  function gruppoAcceso(nome) {
    if (nome in _gruppi) return _gruppi[nome];
    const g = perId[nome];
    let on = false;
    if (g && g.activo === true && TIPI.indexOf(tx(g.tipo)) >= 0) {
      const gd = g.desde == null || g.desde === '' ? null : minDa(g.desde), gh = g.hasta == null || g.hasta === '' ? null : minDa(g.hasta);
      const gt = g.hasta_tope == null || g.hasta_tope === '' ? gh : minDa(g.hasta_tope);
      let ghE = gh;
      const pu = valore(ultimoGesto(A.gesti, go.fecha, tx(g.id_strumento), null, 'push'));
      if (pu && gd != null) { const ph = minDa(pu.hasta); if (ph != null && ph !== gd && gt != null && contenuta(gd, ph, gd, gt)) ghE = ph; }
      const dias = arr(g.dias) || [];
      on = (gd == null) === (gh == null) && (!dias.length || dias.map(tx).indexOf(go.dia) >= 0)
        && !(g.fecha_desde && go.fecha < tx(g.fecha_desde).slice(0, 10)) && !(g.fecha_hasta && go.fecha > tx(g.fecha_hasta).slice(0, 10))
        && dentro(minOra, gd, ghE);
    }
    return (_gruppi[nome] = on);
  }

  const partiPer = {};
  for (const r of A.parti || []) {
    if (!r || r.borrado === true || (local && tx(r.local).toUpperCase() !== local)) continue;
    const k = tx(r.id_strumento); (partiPer[k] || (partiPer[k] = [])).push(r);
  }

  const out = [];
  for (const s of A.strumenti || []) {
    if (!s || s.borrado === true || (local && tx(s.local).toUpperCase() !== local)) continue;
    const id = tx(s.id_strumento), tipo = tx(s.tipo);
    const o = { id: id, tipo: tipo, nombre: tx(s.nombre_visible), orden: s.orden == null ? null : +s.orden, prioridad: s.prioridad == null ? null : +s.prioridad,
      ts_registro: s.ts_registro || null, badge: tx(s.badge) || null, id_contenitore: tx(s.id_contenitore) || null, visible: false, perche: '', parti: [] };
    out.push(o);
    if (TIPI.indexOf(tipo) < 0) { o.perche = 'tipo_sconosciuto'; continue; }
    const d = s.desde == null || s.desde === '' ? null : minDa(s.desde), h = s.hasta == null || s.hasta === '' ? null : minDa(s.hasta);
    const tope = s.hasta_tope == null || s.hasta_tope === '' ? h : minDa(s.hasta_tope);
    if (s.hasta_tope != null && s.hasta_tope !== '' && (tope == null || h == null || !contenuta(d, h, d, tope))) { o.perche = 'hasta_tope_invalida'; continue; }
    if ((s.desde != null && s.desde !== '' && d == null) || (s.hasta != null && s.hasta !== '' && h == null) || ((d == null) !== (h == null))) { o.perche = 'finestra_invalida'; continue; }
    // il prezzo: leva del giorno, o default, o il primo
    const precios = arr(s.precios) || [];
    let prezzo = null;
    if (precios.length) {
      const ok = precios.filter(function (x) { return x && tx(x.id) && Number.isInteger(+x.precio) && +x.precio > 0; });
      if (ok.length !== precios.length) { o.perche = 'precios_invalidi'; continue; }
      const lv = valore(ultimoGesto(A.gesti, go.fecha, id, null, 'leva_precio'));
      const pick = (lv && ok.find(function (x) { return tx(x.id) === tx(lv.a); })) || ok.find(function (x) { return tx(x.id) === tx(s.precio_default); }) || ok[0];
      prezzo = { id: tx(pick.id), precio: +pick.precio, da_leva: !!(lv && tx(pick.id) === tx(lv.a)) };
    }
    o.precio = prezzo;
    if (tipo === 'multiplo') { const m = obj(s.multiplo); o.multiplo = m && +m.paga > 0 && +m.lleva > +m.paga ? { paga: +m.paga, lleva: +m.lleva } : null; if (!o.multiplo) { o.perche = 'multiplo_invalido'; continue; } }
    if (tipo === 'recargo') { const f = Number(s.factor); o.factor = f > 1 && f <= 2 ? f : null; if (!o.factor) { o.perche = 'factor_invalido'; continue; } }
    if (tipo === 'menu' && !prezzo) { o.perche = 'sin_precio'; continue; }   // botellas e precio_fijo possono avere il prezzo nella parte
    // il push dello strumento: la fine nuova, dentro la finestra
    let hEff = h;
    const pu = valore(ultimoGesto(A.gesti, go.fecha, id, null, 'push'));
    if (pu && d != null) {
      const ph = minDa(pu.hasta);
      if (ph != null && ph !== d && contenuta(d, ph, d, tope)) { hEff = ph; o.push = pu.hasta; } else o.push_ignorato = 'push_fuori_finestra';
    }
    o.finestra = d == null ? null : { desde: tx(s.desde).slice(0, 5), hasta: tx(s.hasta).slice(0, 5), hasta_tope: tope == null ? null : String(Math.floor(tope / 60)).padStart(2, '0') + ':' + String(tope % 60).padStart(2, '0'), hasta_oggi: hEff == null ? null : String(Math.floor(hEff / 60)).padStart(2, '0') + ':' + String(hEff % 60).padStart(2, '0') };
    o._restano = restano(minOra, d, hEff);
    // i cancelli dello strumento
    if (s.activo !== true) { o.perche = 'spento'; continue; }
    if (tx(s.grupo) && !gruppoAcceso(tx(s.grupo).toUpperCase())) { o.perche = 'grupo_spento'; continue; }
    const dias = arr(s.dias) || [];
    if (dias.length && dias.map(tx).indexOf(go.dia) < 0) { o.perche = 'non_oggi'; continue; }
    if ((s.fecha_desde && go.fecha < tx(s.fecha_desde).slice(0, 10)) || (s.fecha_hasta && go.fecha > tx(s.fecha_hasta).slice(0, 10))) { o.perche = 'fuori_data'; continue; }
    if (!dentro(minOra, d, hEff)) { o.perche = 'fuori_orario'; continue; }
    // le parti
    for (const r of (partiPer[id] || []).slice().sort(function (x, y) { return perOrden({ orden: x.orden, nombre: x.id_producto, id: x.id_producto }, { orden: y.orden, nombre: y.id_producto, id: y.id_producto }); })) {
      const ip = tx(r.id_producto);
      const pa = { id_producto: ip, orden: r.orden == null ? null : +r.orden, rol: null, vende: false, perche: '', avvisi: [] };
      o.parti.push(pa);
      if (r.rol != null && tx(r.rol) !== '') { if (tipo === 'menu' && ROLI.indexOf(tx(r.rol)) >= 0) pa.rol = tx(r.rol); else pa.avvisi.push('rol_ignorato'); }
      let prezzoP = null;
      if (r.precio != null && r.precio !== '') {
        if (PREZZO_IN_PARTE.indexOf(tipo) >= 0 && Number.isInteger(+r.precio) && +r.precio > 0) prezzoP = +r.precio; else pa.avvisi.push('precio_ignorato');
      }
      const pd = r.desde == null || r.desde === '' ? null : minDa(r.desde), ph0 = r.hasta == null || r.hasta === '' ? null : minDa(r.hasta);
      if ((pd == null) !== (ph0 == null)) { pa.perche = 'finestra_parte_invalida'; continue; }
      let pdE = pd == null ? d : pd, phE = ph0 == null ? hEff : ph0;
      if (pd != null && !contenuta(pd, ph0, d, h)) { pa.perche = 'parte_fuori_finestra'; continue; }
      const puP = valore(ultimoGesto(A.gesti, go.fecha, id, ip, 'push'));
      if (puP && pdE != null) { const x = minDa(puP.hasta); if (x != null && x !== pdE && contenuta(pdE, x, d, tope)) phE = x; else pa.avvisi.push('push_fuori_finestra'); }
      if (hEff !== h && pdE != null && !puP && !contenuta(pdE, phE, d, hEff)) {   // il push dello strumento accorcia anche la parte
        if (!contenuta(pdE, hEff, d, hEff) || pdE === hEff) { pa.perche = 'fuori_orario_parte'; continue; }   // la parte comincia dopo la fine di oggi
        phE = hEff;
      }
      if (!vende(ip)) { pa.perche = ago[ip] ? 'agotado' : 'non_si_vende'; continue; }
      if (!dentro(minOra, pdE, phE)) { pa.perche = 'fuori_orario_parte'; continue; }
      pa.vende = true;
      if (tipo === 'botellas' || tipo === 'precio_fijo') {
        const pp = prezzoP != null ? prezzoP : (prezzo ? prezzo.precio : null);
        if (pp == null) { pa.vende = false; pa.perche = 'sin_precio'; continue; }
        pa.precio = pp;
      }
      pa._restano = restano(minOra, pdE, phE);
    }
    const vive = o.parti.filter(function (x) { return x.vende; });
    if (tipo === 'menu') {
      if (o.id_contenitore && !vende(o.id_contenitore)) { o.perche = ago[o.id_contenitore] ? 'contenitore_agotado' : 'contenitore_non_si_vende'; continue; }
      const roli = []; for (const x of o.parti) if (x.rol && roli.indexOf(x.rol) < 0) roli.push(x.rol);
      const vuoto = roli.find(function (rl) { return !vive.some(function (x) { return x.rol === rl; }); });
      if (!vive.length || vuoto) { o.perche = vuoto ? 'gruppo_senza_opzioni:' + vuoto : 'sin_partes'; continue; }
    } else if (SENZA_PARTI.indexOf(tipo) < 0 && !vive.length) { o.perche = 'sin_partes'; continue; }
    o.visible = true;
  }

  // i prodotti: listino, poi lo strumento di prezzo che vince, poi il recargo sopra
  const prodotti = {}, contenitori = {};
  const vis = out.filter(function (x) { return x.visible; });
  const cand = {};
  for (const s of vis) {
    if (s.tipo === 'menu' && s.id_contenitore && s.precio) contenitori[s.id_contenitore] = { precio: s.precio.precio, strumento: s.id, badge: s.badge };
    for (const pa of s.parti) {
      if (!pa.vende) continue;
      const k = pa.id_producto;
      const c = cand[k] || (cand[k] = { prezzo: [], recargo: [], badge: [], multiplo: [] });
      const base = { id: s.id, prioridad: s.prioridad, ts_registro: s.ts_registro, _restano: Math.min(s._restano, pa._restano) };
      if (s.tipo === 'botellas' || s.tipo === 'precio_fijo') c.prezzo.push(Object.assign({ precio: pa.precio, badge: s.badge }, base));
      else if (s.tipo === 'recargo') c.recargo.push(Object.assign({ factor: s.factor }, base));
      else if (s.tipo === 'multiplo') c.multiplo.push(Object.assign({ multiplo: s.multiplo, badge: s.badge }, base));
      else if (s.badge) c.badge.push(Object.assign({ badge: s.badge }, base));
    }
  }
  for (const k of Object.keys(cand)) {
    const l = listino(k), c = cand[k];
    if (l == null) continue;   // senza prezzo di listino non si vende (cintura del prezzo): lo strumento non lo inventa
    const vp = vinceSlot(c.prezzo), vr = vinceSlot(c.recargo), vm = vinceSlot(c.multiplo), vb = vinceSlot(c.badge);
    let precio = vp ? vp.precio : l;
    if (vr) precio = Math.round(precio * vr.factor);
    prodotti[k] = { listino: l, precio: precio, strumento: vp ? vp.id : null, recargo: vr ? vr.id : null, multiplo: vm ? Object.assign({ strumento: vm.id }, vm.multiplo) : null,
      badge: (vp && vp.badge) || (vm && vm.badge) || (vb && vb.badge) || null };
  }
  for (const s of out) delete s._restano;
  for (const s of out) for (const pa of s.parti) delete pa._restano;
  const lista = out.slice().sort(perOrden);
  return {
    ok: true, version: STRUMENTI_VERSION, ahora: { fecha_op: go.fecha, dia: go.dia, hhmm: String(p.hh).padStart(2, '0') + ':' + String(p.mm).padStart(2, '0') },
    strumenti: lista, prodotti: prodotti, contenitori: contenitori,
  };
}

/** §3 per il pannello e il carosello: fra gli strumenti VISIBILI dei tipi chiesti, chi vince lo stesso posto adesso. */
export function slotAdesso(risposta, tipi, now, strumentiRighe) {
  if (!risposta || !risposta.ok) return null;
  const p = parteSantiago(now), minOra = p.hh * 60 + p.mm;
  const fin = {}; for (const s of strumentiRighe || []) fin[tx(s.id_strumento)] = s;
  const c = risposta.strumenti.filter(function (s) { return s.visible && tipi.indexOf(s.tipo) >= 0; }).map(function (s) {
    const r = fin[s.id] || {}; const d = minDa(r.desde), h = s.finestra ? minDa(s.finestra.hasta_oggi) : null;
    return Object.assign({}, s, { _restano: d == null ? Infinity : restano(minOra, d, h) });
  });
  const w = vinceSlot(c);
  if (w) delete w._restano;
  return w;
}
