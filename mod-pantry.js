// Despensa: lo que hay en casa. Se llena al terminar una compra, baja con las comidas del menú
// (al acabar su día) y con la frecuencia de los esenciales. Todo se puede ajustar a mano.
(function () {
  'use strict';
  const App = window.App, S = App.S, SL = App.SL;
  const esc = App.esc;
  let query = '', filter = 'all';
  const shortName = n => n.replace(/\s*\(.*\)\s*$/, '');
  const fmt = (p, v) => SL.fmtAmount(p.unit, Math.round(v * 100) / 100);
  // Paso de los botones −/+: 1 unidad, o un trozo razonable del envase.
  const stepOf = p => p.unit === 'ud' ? (p.pack >= 4 ? 1 : 0.5) : p.bulk ? (p.unit === 'ud' ? 1 : 100) : Math.max(5, Math.round(p.pack / 4));

  // Lo que pide el menú de hoy a 7 días (comidas sin hacer ni descartar).
  function upcomingNeeds() {
    const today = App.today(), end = App.addDays(today, 6);
    const meals = App.meals().filter(m => m.date >= today && m.date <= end && !m.skip && !m.doneAt);
    return SL.menuNeeds(meals, App.recipesById());
  }
  App.upcomingNeeds = upcomingNeeds;

  function rowsData() {
    const pById = App.productsById(), pan = App.pantry(), need = upcomingNeeds();
    return Object.entries(pan).map(([pid, l]) => {
      const p = pById[pid]; if (!p) return null;
      const n = need[pid] || 0;
      return Object.assign({ p, need: n, short: n > l.qty + 0.001, low: l.qty <= 0 || (l.daysLeft != null && l.daysLeft < 3) }, l);
    }).filter(Boolean);
  }

  function render(partial) {
    const view = App.view;
    const all = rowsData();
    const low = all.filter(r => r.low), short = all.filter(r => r.short);
    const ql = query.trim().toLowerCase();
    const rows = all.filter(r => (filter === 'all' || (filter === 'low' && r.low) || (filter === 'menu' && r.need > 0))
      && (!ql || r.p.name.toLowerCase().includes(ql)))
      .sort((a, b) => App.section(a.p.section).order - App.section(b.p.section).order || a.p.name.localeCompare(b.p.name, 'es'));
    const fix = [...new Set([...short, ...low].map(r => r.p.id))];

    const head = `<div class="card"><div class="row"><div class="emoji">🏠</div><div class="grow"><b>${all.length} producto${all.length === 1 ? '' : 's'} en casa</b>
        <div class="muted">Entra lo que compráis y baja solo con el menú (al acabar cada día) y con el uso diario de los esenciales.</div></div></div>
        ${fix.length ? `<div class="alert" id="fixAll"><div class="emoji">🛒</div><div class="grow"><b>${fix.length} por reponer</b>
          <div class="muted">${short.length ? `${short.length} no llega${short.length === 1 ? '' : 'n'} para el menú` : ''}${short.length && low.length ? ' · ' : ''}${low.length ? `${low.length} se acaba${low.length === 1 ? '' : 'n'}` : ''}</div></div><button class="small primary">A la lista</button></div>` : ''}
        <button class="block" id="addHave">＋ Añadir lo que tengo en casa</button></div>
      <div class="chips scroll-x" style="margin-top:8px">${[['all', 'Todo', all.length], ['low', '⚠️ Se acaba', low.length], ['menu', '🍽️ Para el menú', all.filter(r => r.need > 0).length]]
        .map(([k, n, c]) => `<button data-pf="${k}" class="${filter === k ? 'on' : ''}">${n} <span class="muted">${c}</span></button>`).join('')}</div>
      <input id="panq" class="search" type="search" autocomplete="off" placeholder="🔍 Buscar en la despensa" value="${esc(query)}" style="margin-top:8px">`;

    let h = '';
    if (!all.length) {
      h = `<div class="card empty">🏠 La despensa está vacía.<br>Se llenará sola al terminar una compra.<br>Si ya tenéis cosas en casa, pulsa <b>«Añadir lo que tengo en casa»</b>.</div>`;
    } else if (!rows.length) {
      h = `<div class="card empty">Nada con este filtro.</div>`;
    } else {
      let lastSec = null;
      rows.forEach(r => {
        const sec = App.section(r.p.section);
        if (sec.id !== lastSec) { if (lastSec !== null) h += `</div>`; h += `<div class="sechdr">${esc(sec.emoji)} ${esc(sec.name)}</div><div class="card list tight">`; lastSec = sec.id; }
        const ref = Math.max(r.qty, r.p.essentialQty || 0, r.p.pack || 1, r.need);
        let sub = r.qty <= 0 ? '<span class="neg">Se ha acabado</span>' : '';
        if (r.perDay) sub += (sub ? ' · ' : '') + (r.qty > 0 ? `≈ ${Math.max(0, Math.round(r.daysLeft))} día${Math.round(r.daysLeft) === 1 ? '' : 's'}` : '') + ` · ${fmt(r.p, r.perDay)}/día`;
        if (r.need) sub += (sub ? ' · ' : '') + `<span class="${r.short ? 'neg' : ''}">el menú pide ${fmt(r.p, r.need)}</span>`;
        h += `<div class="item pan"><div class="grow tap" data-st="${r.p.id}"><div class="ellipsis">${esc(r.p.name)}</div>
            <div class="muted ellipsis">${sub || (r.perDay ? '' : 'baja con el menú')}</div>
            <div class="bar"><span style="width:${Math.min(100, r.qty / ref * 100)}%;${r.low || r.short ? 'background:var(--neg)' : ''}"></span></div></div>
          <button class="qbtn" data-sdn="${r.p.id}" aria-label="Menos">−</button><span class="qval pq">${esc(fmt(r.p, r.qty))}</span><button class="qbtn" data-sup="${r.p.id}" aria-label="Más">+</button></div>`;
      });
      h += `</div>`;
    }

    const body = view.querySelector('#panbody');
    if (partial) { if (!body) return; body.innerHTML = h; }
    else {
      view.innerHTML = head + `<div id="panbody">${h}</div>`;
      const $ = s => view.querySelector(s);
      $('#addHave').onclick = addHave;
      if ($('#fixAll')) $('#fixAll').onclick = () => addMissingToList(fix);
      view.querySelectorAll('[data-pf]').forEach(b => b.onclick = () => { filter = b.dataset.pf; App.render(); });
      const qi = $('#panq');
      qi.oninput = () => { query = qi.value; clearTimeout(qi._t); qi._t = setTimeout(() => render(true), 120); };
    }
    const b = view.querySelector('#panbody');
    b.querySelectorAll('[data-st]').forEach(el => el.onclick = () => openStock(S.get(el.dataset.st)));
    b.querySelectorAll('[data-sdn]').forEach(el => el.onclick = () => bump(el.dataset.sdn, -1));
    b.querySelectorAll('[data-sup]').forEach(el => el.onclick = () => bump(el.dataset.sup, +1));
  }

  function current(pid) {
    const st = S.get(App.stockId(pid)), p = S.get(pid);
    return st && p ? SL.stockLevel(st, p, App.stockCtx()).qty : 0;
  }
  function bump(pid, dir) {
    const p = S.get(pid); if (!p) return;
    App.setStock(pid, Math.max(0, current(pid) + dir * stepOf(p)));
  }

  function addHave() {
    App.pickProduct(p => openStock(p));
  }

  // Lo que falta (para el menú o porque se acaba) → lista de la compra, sin duplicar.
  function addMissingToList(pids) {
    const inList = new Set(App.shopItems().filter(i => !i.checked).map(i => i.product));
    const rows = rowsData(), changes = [];
    pids.forEach(pid => {
      if (inList.has(pid)) return;
      const r = rows.find(x => x.p.id === pid); if (!r) return;
      const p = r.p;
      let amount = r.short ? r.need - r.qty : (p.essentialQty || p.pack || 1);
      if (!p.bulk) amount = Math.max(1, SL.packsFor(p, amount)) * p.pack;
      changes.push({ kind: 'shopitem', data: { id: 'i-' + App.uid() + changes.length, product: p.id, name: p.name, section: p.section, amount,
        checked: false, source: 'pantry', addedAt: Date.now() } });
    });
    S.putMany(changes);
    App.toast(changes.length ? `Añadidos ${changes.length} productos a la lista` : 'Ya estaba todo en la lista');
  }

  // Ficha de despensa de un producto: cuánto queda, accesos rápidos y quitarlo.
  function openStock(p, opts) {
    if (!p) return;
    opts = opts || {};
    const st = S.get(App.stockId(p.id));
    const lvl = st ? SL.stockLevel(st, p, App.stockCtx()) : { qty: 0, perDay: SL.dailyUse(p) };
    const need = upcomingNeeds()[p.id] || 0;
    const unitLbl = p.unit === 'ud' ? 'unidades' : p.unit === 'ml' ? 'ml' : 'gramos';
    const quick = [[0, 'Se ha acabado']];
    if (p.pack > 1 || p.unit !== 'ud') { quick.push([p.pack / 2, '½ envase']); quick.push([p.pack, '1 envase']); quick.push([p.pack * 2, '2 envases']); }
    else { quick.push([1, '1']); quick.push([2, '2']); quick.push([4, '4']); }
    const m = App.sheet(`<h3>${esc(p.name)}</h3>
      <div class="muted">${esc(App.section(p.section).emoji)} ${esc(App.section(p.section).name)}${st ? '' : ' · aún no está en la despensa'}</div>
      <label>Lo que queda en casa (${unitLbl})</label>
      <div class="row"><button class="qbtn" id="dn">−</button><input id="qty" type="text" inputmode="decimal" autocomplete="off" class="grow center" value="${+lvl.qty.toFixed(2)}"><button class="qbtn" id="up">+</button></div>
      <div class="chips" style="margin-top:8px">${quick.map(([v, l]) => `<button data-qv="${v}">${l}</button>`).join('')}</div>
      <div class="note" style="margin-top:12px">${lvl.perDay
        ? `🧂 Es esencial: baja solo unos ${esc(fmt(p, lvl.perDay))} al día (lo que soléis comprar cada ${p.every} días).${lvl.qty > 0 ? ` Queda para unos ${Math.round(lvl.qty / lvl.perDay)} días.` : ''}`
        : '🍽️ Baja solo al acabar el día de cada comida del menú que lo lleva.'}
        ${need ? `<br>El menú de los próximos 7 días pide <b>${esc(fmt(p, need))}</b>.` : ''}</div>
      <div class="actions">${st ? '<button class="danger" id="rm">Quitar</button>' : ''}<button id="toList">🛒 A la lista</button><button class="primary" id="ok">Guardar</button></div>`, { stack: !!opts.stack });
    const $ = s => m.querySelector(s);
    const step = stepOf(p);
    const val = () => { const v = App.num($('#qty').value); return v >= 0 ? v : 0; };
    $('#dn').onclick = () => { $('#qty').value = +Math.max(0, val() - step).toFixed(2); };
    $('#up').onclick = () => { $('#qty').value = +(val() + step).toFixed(2); };
    m.querySelectorAll('[data-qv]').forEach(b => b.onclick = () => { $('#qty').value = +(+b.dataset.qv).toFixed(2); });
    $('#ok').onclick = () => {
      const v = App.num($('#qty').value);
      if (!(v >= 0)) { App.toast('Cantidad no válida'); return; }
      App.setStock(p.id, v);
      App.closeSheet();
      App.toast(`${shortName(p.name)}: ${fmt(p, v)} en casa`);
    };
    $('#toList').onclick = () => { App.closeSheet(); App.modules.shop.addProduct(p); };
    if ($('#rm')) $('#rm').onclick = () => { App.closeSheet(); App.removeWithUndo('stock', st, `${shortName(p.name)} ya no se controla en la despensa`); };
  }

  App.modules.pantry = { render, openStock, addMissingToList, stepOf };
})();
