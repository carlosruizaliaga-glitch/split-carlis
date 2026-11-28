// Módulo Tareas del hogar: tareas con peso (puntos) y frecuencia, reparto semanal equilibrado con rotación,
// planificación por días, ranking, logros y premios. Conectado con Menú (cocinar) y Compra (hacer la compra).
(function () {
  'use strict';
  const App = window.App, S = App.S;
  const esc = App.esc;
  const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const DAY_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const WEEK = 7 * 86400000;
  const fmtShort = d => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  let week = App.mondayOf(App.today());
  let filterWho = '';           // '' = todos
  let rankPeriod = 'week', achWho = null;

  // ---------- Datos ----------
  const chores = () => S.list('chore').sort(App.byOrder);
  const occs = () => S.list('chorewk');
  const rewards = () => S.list('reward').sort(App.byOrder);
  const occId = (cid, date) => `ch-${cid}-${date}`;
  const cookOccId = mealId => `ch-cook-${mealId}`;
  const choreOf = o => S.get(o.chore) || { id: o.chore, emoji: '❔', name: 'Tarea borrada', weight: o.w || 1 };
  const doer = o => o.doneBy || o.who;
  const weekDates = w => Array.from({ length: 7 }, (_, i) => App.addDays(w, i));
  const isPastWeek = w => App.addDays(w, 6) < App.today();

  // Parte de cada persona (como «porcentaje» en los gastos). Por defecto, a partes iguales.
  function shares() {
    const ps = App.people(), st = App.settings().choreShares || {}, out = {};
    let tot = 0;
    ps.forEach(p => { out[p.id] = st[p.id] > 0 ? +st[p.id] : 1; tot += out[p.id]; });
    ps.forEach(p => { out[p.id] /= tot || 1; });
    return out;
  }

  // ---------- Frecuencias ----------
  function scheduledDates(c, monday) {
    const dates = weekDates(monday), f = c.freq || { type: 'weekly', day: 5 };
    const day = f.day != null ? f.day : 5;
    switch (f.type) {
      case 'daily': return dates;
      case 'days': return dates.filter((d, i) => (f.days || []).includes(i));
      case 'weekly': return [dates[day]];
      case 'everyN': {
        const n = Math.max(2, f.n || 2), anchor = App.mondayOf(f.anchor || monday);
        const k = Math.round((Date.parse(monday) - Date.parse(anchor)) / WEEK);
        return ((k % n) + n) % n === 0 ? [dates[day]] : [];
      }
      case 'monthly': { const md = Math.min(28, Math.max(1, f.monthDay || 1)); return dates.filter(d => +d.slice(8) === md); }
    }
    return [];
  }
  function freqText(c) {
    if (c.link === 'cook') return 'Cada comida del menú · ' + (c.cookMeals || ['comida', 'cena']).map(m => App.mealDef(m).name).join(', ');
    const f = c.freq || {}, day = DAY_NAMES[f.day != null ? f.day : 5].toLowerCase();
    if (f.type === 'daily') return 'Cada día';
    if (f.type === 'days') return (f.days || []).length ? (f.days || []).slice().sort().map(i => DAY_SHORT[i]).join(' · ') : 'Sin días';
    if (f.type === 'everyN') return `Cada ${f.n || 2} semanas · ${day}`;
    if (f.type === 'monthly') return `Cada mes · día ${f.monthDay || 1}`;
    return `Cada semana · ${day}`;
  }
  const freqGroup = c => c.link ? 5 : ({ daily: 0, days: 1, weekly: 2, everyN: 3, monthly: 4 })[(c.freq || {}).type] ?? 2;
  const GROUPS = ['Cada día', 'Varios días a la semana', 'Cada semana', 'Cada varias semanas', 'Cada mes', 'Del menú y la compra'];

  // ---------- Generar y repartir la semana ----------
  // Lo que debería haber en la semana según las tareas activas y el menú.
  function wanted(monday) {
    const out = [], rById = App.recipesById(), end = App.addDays(monday, 6);
    chores().filter(c => c.active !== false).forEach(c => {
      if (c.link === 'cook') {
        const ms = c.cookMeals || ['comida', 'cena'];
        App.meals().forEach(m => {
          if (m.recipe && rById[m.recipe] && ms.includes(m.meal) && m.date >= monday && m.date <= end)
            out.push({ id: cookOccId(m.id), chore: c.id, date: m.date, meal: m.id, w: c.weight || 1 });
        });
      } else scheduledDates(c, monday).forEach(d => out.push({ id: occId(c.id, d), chore: c.id, date: d, w: c.weight || 1 }));
    });
    return out;
  }

  // Reparto: cada tarea va a quien menos puntos lleve (según su parte), penalizando que repita
  // la misma tarea que la última vez (rotación). Determinista: los dos móviles llegan al mismo reparto.
  function assign(monday, list, fixed) {
    const ps = App.people().map(p => p.id).sort(), sh = shares();
    const load = {}; ps.forEach(p => { load[p] = 0; });
    fixed.forEach(o => { if (load[o.who] != null) load[o.who] += o.w || 1; });
    const last = {};
    occs().filter(o => o.week < monday).sort((a, b) => a.date.localeCompare(b.date)).forEach(o => { last[o.chore] = doer(o); });
    fixed.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach(o => { last[o.chore] = o.who; });
    return list.slice().sort((a, b) => a.date.localeCompare(b.date) || (b.w - a.w) || a.id.localeCompare(b.id)).map(o => {
      const c = S.get(o.chore) || {};
      const cand = (c.people || []).filter(p => load[p] != null);
      const pool = cand.length ? cand : ps;
      let best = null, bestScore = Infinity;
      pool.forEach(p => {
        const share = sh[p] || 1 / ps.length;
        let score = (load[p] + o.w) / share;
        if (last[o.chore] === p && pool.length > 1) score += o.w / share * 1.2;
        if (score < bestScore - 1e-9) { bestScore = score; best = p; }
      });
      load[best] += o.w; last[o.chore] = best;
      return Object.assign({}, o, { week: monday, who: best });
    });
  }

  // Crea lo que falta, quita lo que ya no toca (si no estaba hecho) y actualiza puntos y fechas del menú.
  function ensureWeek(monday) {
    if (!S.lastSync() || !App.people().length || !chores().length || isPastWeek(monday)) return;
    const want = wanted(monday), byId = {};
    want.forEach(o => { byId[o.id] = o; });
    const existing = occs().filter(o => o.week === monday), changes = [];
    existing.forEach(o => {
      const w = byId[o.id];
      if (!w) { if (!o.doneAt) changes.push({ kind: 'chorewk', data: o, deleted: true }); return; }
      const upd = {};
      if (!o.doneAt && o.w !== w.w) upd.w = w.w;
      if (o.meal && o.date !== w.date) upd.date = w.date;
      if (Object.keys(upd).length) changes.push({ kind: 'chorewk', data: Object.assign({}, o, upd) });
    });
    const have = new Set(existing.map(o => o.id));
    // Solo se crean tareas de hoy en adelante (no aparecen «atrasadas» de días que ya pasaron).
    const today = App.today();
    const missing = want.filter(o => !have.has(o.id) && o.date >= today);
    if (missing.length) assign(monday, missing, existing.filter(o => byId[o.id])).forEach(o => changes.push({ kind: 'chorewk', data: o }));
    if (changes.length) S.putMany(changes);
  }
  let ensureT = null;
  function scheduleEnsure() {
    clearTimeout(ensureT);
    ensureT = setTimeout(() => {
      if (!App.started) return;
      const cur = App.mondayOf(App.today());
      ensureWeek(cur);
      if (week > cur) ensureWeek(week);
    }, 250);
  }
  S.onChange(scheduleEnsure);

  // Vuelve a repartir lo pendiente de la semana (desde hoy) sin tocar lo hecho.
  async function reshuffle() {
    const today = App.today();
    const list = occs().filter(o => o.week === week && !o.doneAt && !o.skip && o.date >= today);
    if (!list.length) { App.toast('No hay tareas pendientes que repartir'); return; }
    if (!await App.ask(`¿Repartir de nuevo las ${list.length} tareas pendientes de esta semana? Se cambiarán también las que hayáis movido a mano.`, { ok: 'Repartir' })) return;
    const ids = new Set(list.map(o => o.id));
    const fixed = occs().filter(o => o.week === week && !ids.has(o.id));
    S.putMany(assign(week, list.map(o => Object.assign({}, o, { who: null })), fixed).map(o => ({ kind: 'chorewk', data: o })));
    App.toast('Tareas repartidas');
  }

  // ---------- Hacer / deshacer (y enlaces con Menú y Compra) ----------
  function setDone(o, done, by) {
    const cur = S.get(o.id) || o;
    const upd = Object.assign({}, cur, done ? { doneAt: Date.now(), doneBy: by || cur.who, skip: false } : { doneAt: null, doneBy: null });
    const changes = [{ kind: 'chorewk', data: upd }];
    // Cocinar ↔ comida del menú: hecha en un sitio, hecha en el otro (y descuenta la despensa).
    if (cur.meal) { const m = S.get(cur.meal); if (m && !!m.doneAt !== done) changes.push({ kind: 'meal', data: Object.assign({}, m, { doneAt: done ? Date.now() : null, skip: false }) }); }
    S.putMany(changes);
    if (done) {
      const c = choreOf(cur), p = App.person(upd.doneBy);
      App.toast(`✅ ${c.name}: +${cur.w || 1} pts para ${p.name}`, { undo: () => setDone(upd, false) });
    }
  }
  // Desde el menú: «Ya la hicimos» / deshacer.
  function mealDone(meal, done) {
    const o = S.get(cookOccId(meal.id));
    if (o && !!o.doneAt !== done) S.put('chorewk', Object.assign({}, o, done ? { doneAt: Date.now(), doneBy: o.who } : { doneAt: null, doneBy: null }));
  }
  // Desde Compra: al terminar una compra, la de esta semana queda hecha por quien pagó.
  function shopDone(by, date) {
    const shop = chores().find(c => c.link === 'shop' && c.active !== false);
    if (!shop) return;
    const monday = App.mondayOf(date || App.today());
    const o = occs().find(x => x.week === monday && x.chore === shop.id && !x.doneAt);
    if (o) S.put('chorewk', Object.assign({}, o, { doneAt: Date.now(), doneBy: by }));
    else if (!occs().some(x => x.week === monday && x.chore === shop.id)) {
      const d = date || App.today();
      S.put('chorewk', { id: occId(shop.id, d), chore: shop.id, date: d, week: monday, w: shop.weight || 1, who: by, doneAt: Date.now(), doneBy: by });
    }
  }
  const cookOf = mealIdStr => S.get(cookOccId(mealIdStr));
  const shopOccThisWeek = () => { const shop = chores().find(c => c.link === 'shop'); const mon = App.mondayOf(App.today()); return shop && occs().find(o => o.week === mon && o.chore === shop.id); };

  // ---------- Vista: semana ----------
  function render(sub) {
    scheduleEnsure();
    if (sub === 'list') { App.fabAction = () => openChore(null); renderList(); }
    else if (sub === 'rank') renderRank();
    else { App.fabAction = () => openChore(null); renderWeek(); }
  }

  function occRow(o, opts) {
    const c = choreOf(o), p = App.person(o.who), today = App.today();
    let sub = '';
    if (o.meal) { const m = S.get(o.meal), r = m && S.get(m.recipe); sub = m ? `${App.mealDef(m.meal).emoji} ${esc(App.mealDef(m.meal).name)}${r ? ': ' + esc(r.name) : ''}` : ''; }
    else if (c.link === 'shop') { const n = App.shopItems().filter(i => !i.checked).length; sub = `🛒 ${n} producto${n === 1 ? '' : 's'} en la lista`; }
    if (opts && opts.showDay) sub = `${DAY_NAMES[(new Date(o.date + 'T12:00:00').getDay() + 6) % 7]}${sub ? ' · ' + sub : ''}`;
    if (o.doneAt && o.doneBy && o.doneBy !== o.who) sub += `${sub ? ' · ' : ''}la hizo ${esc(App.person(o.doneBy).name)}`;
    const late = !o.doneAt && !o.skip && o.date < today;
    return `<div class="chrow${o.doneAt ? ' done' : ''}${o.skip ? ' skip' : ''}${late ? ' late' : ''}" data-row="${o.id}">
      <button class="chk${o.doneAt ? ' on' : ''}" data-cd="${o.id}" aria-label="Hecha">${o.doneAt ? '✓' : ''}</button>
      <div class="grow tap" data-co="${o.id}"><div class="ellipsis nm">${esc(c.emoji)} ${esc(c.name)}</div>${sub || late ? `<div class="muted ellipsis">${late ? '<span class="neg">pendiente</span>' + (sub ? ' · ' : '') : ''}${sub}</div>` : ''}</div>
      <span class="ptspill">+${o.w || 1}</span>
      <button class="avbtn" data-cw="${o.id}" aria-label="Cambiar persona">${App.avatar(p, 1)}</button></div>`;
  }
  function bindRows(root) {
    root.querySelectorAll('.chrow[data-row]').forEach(row => {
      let x0 = null, y0 = 0, dx = 0, horiz = null;
      row.addEventListener('touchstart', ev => { const t = ev.touches[0]; x0 = t.clientX; y0 = t.clientY; dx = 0; horiz = null; }, { passive: true });
      row.addEventListener('touchmove', ev => {
        if (x0 == null) return;
        const t = ev.touches[0]; dx = t.clientX - x0;
        if (horiz == null && (Math.abs(dx) > 8 || Math.abs(t.clientY - y0) > 8)) horiz = Math.abs(dx) > Math.abs(t.clientY - y0);
        if (horiz && dx > 0) { row.style.transform = `translateX(${Math.min(dx, 120)}px)`; row.classList.toggle('swiping', dx > 80); }
      }, { passive: true });
      row.addEventListener('touchend', () => {
        if (horiz && dx > 80) { const o = S.get(row.dataset.row); if (o) setDone(o, !o.doneAt); }
        row.style.transform = ''; row.classList.remove('swiping'); x0 = null;
      });
    });
    root.querySelectorAll('[data-cd]').forEach(b => b.onclick = () => { const o = S.get(b.dataset.cd); if (o) setDone(o, !o.doneAt); });
    root.querySelectorAll('[data-co]').forEach(el => el.onclick = () => openOcc(S.get(el.dataset.co)));
    root.querySelectorAll('[data-cw]').forEach(b => b.onclick = () => {
      // Toque rápido en la persona: pasa a la siguiente.
      const o = S.get(b.dataset.cw); if (!o) return;
      const ps = App.people(), i = ps.findIndex(p => p.id === o.who), next = ps[(i + 1) % ps.length];
      S.put('chorewk', Object.assign({}, o, { who: next.id }));
      App.toast(`${choreOf(o).name}: ahora le toca a ${next.name}`);
    });
  }

  // Cálculos del ranking guardados mientras no cambien los datos (con meses de historial, recalcular cansa).
  const memo = { v: -1, c: {} };
  function memoize(key, fn) {
    const v = S.version();
    if (memo.v !== v) { memo.v = v; memo.c = {}; }
    return key in memo.c ? memo.c[key] : (memo.c[key] = fn());
  }

  // Puntos de la semana por persona: asignados, hechos.
  function weekScore(monday) { return memoize('ws' + monday, () => weekScoreRaw(monday)); }
  function weekScoreRaw(monday) {
    const out = {};
    App.people().forEach(p => { out[p.id] = { assigned: 0, done: 0, n: 0, nd: 0 }; });
    occs().filter(o => o.week === monday && !o.skip).forEach(o => {
      if (out[o.who]) { out[o.who].assigned += o.w || 1; out[o.who].n++; }
      if (o.doneAt && out[doer(o)]) { out[doer(o)].done += o.w || 1; out[doer(o)].nd++; }
    });
    return out;
  }

  function renderWeek() {
    const view = App.view, dates = weekDates(week), today = App.today();
    const isThis = week === App.mondayOf(today);
    const ps = App.people(), sc = weekScore(week);
    const list = occs().filter(o => o.week === week && (!filterWho || o.who === filterWho || doer(o) === filterWho));
    const leader = ps.slice().sort((a, b) => sc[b.id].done - sc[a.id].done)[0];
    const tie = ps.length > 1 && sc[ps[0].id] && ps.every(p => sc[p.id].done === sc[leader.id].done);
    let h = `<div class="weeknav"><button class="icon" id="prevW" aria-label="Semana anterior">‹</button>
      <div class="grow center"><b>${esc(fmtShort(dates[0]))} – ${esc(fmtShort(dates[6]))}</b><div class="muted">${isThis ? 'Esta semana' : week > today ? 'Próximamente' : 'Semana pasada'}</div></div>
      ${isThis ? '' : '<button class="small ghost" id="thisW">Hoy</button>'}<button class="icon" id="nextW" aria-label="Semana siguiente">›</button></div>
      <div class="card">${ps.map(p => {
        const s = sc[p.id];
        return `<div class="scorerow tap" data-fw="${p.id}">${App.avatar(p)}<div class="grow"><div class="row"><b class="grow">${esc(p.name)}</b><span class="muted">${s.nd}/${s.n} tareas</span></div>
          <div class="bar"><span style="width:${s.assigned ? Math.min(100, s.done / s.assigned * 100) : 0}%;background:${esc(p.color)}"></span></div>
          <div class="muted">${s.done} de ${s.assigned} puntos</div></div></div>`;
      }).join('')}
        ${list.length || occs().some(o => o.week === week) ? `<div class="muted center" style="margin-top:6px">${!sc[leader.id].done ? '🏁 Aún nadie ha sumado puntos' : tie ? '🤝 Vais empatados' : `🏆 ${week < App.mondayOf(today) ? 'Ganó' : 'Va ganando'} <b>${esc(leader.name)}</b>`}</div>` : ''}
        <div class="chips" style="margin-top:10px"><button data-fw="" class="${!filterWho ? 'on' : ''}">Todos</button>${ps.map(p => `<button data-fw="${p.id}" class="${filterWho === p.id ? 'on' : ''}">${esc(p.name)}</button>`).join('')}</div>
        ${!isPastWeek(week) ? '<button class="ghost block small" id="reshuffle">🔀 Repartir de nuevo lo pendiente</button>' : ''}</div>`;
    if (!chores().length) h += `<div class="card empty">Aún no hay tareas. Pulsa <b>+</b> para crear la primera.</div>`;
    else if (isPastWeek(week) && !occs().some(o => o.week === week)) h += `<div class="card empty">Esta semana no tuvo tareas planificadas.</div>`;
    dates.forEach((d, i) => {
      const day = list.filter(o => o.date === d).sort((a, b) => (!!a.doneAt - !!b.doneAt) || (b.w - a.w) || choreOf(a).name.localeCompare(choreOf(b).name, 'es'));
      const all = occs().filter(o => o.week === week && o.date === d);
      if (!day.length && !all.length) return;
      h += `<div class="card day${d === today ? ' today' : ''}"><div class="dayhdr row"><span class="grow">${DAY_NAMES[i]} <span class="muted">${esc(fmtShort(d))}</span>${d === today ? ' <span class="pill pos">hoy</span>' : ''}</span>
        <span class="muted">${all.filter(o => o.doneAt).length}/${all.filter(o => !o.skip).length}</span></div>
        ${day.map(o => occRow(o)).join('') || '<div class="muted" style="padding:6px 0">Nada para esta persona.</div>'}</div>`;
    });
    view.innerHTML = h;
    const $ = s => view.querySelector(s);
    $('#prevW').onclick = () => { week = App.addDays(week, -7); App.render(); };
    $('#nextW').onclick = () => { week = App.addDays(week, 7); App.render(); };
    if ($('#thisW')) $('#thisW').onclick = () => { week = App.mondayOf(today); App.render(); };
    if ($('#reshuffle')) $('#reshuffle').onclick = reshuffle;
    view.querySelectorAll('[data-fw]').forEach(b => b.onclick = () => { filterWho = filterWho === b.dataset.fw ? '' : b.dataset.fw; App.render(); });
    bindRows(view);
  }

  // Ficha de una tarea concreta de la semana.
  function openOcc(o) {
    if (!o) return;
    const c = choreOf(o), ps = App.people(), dates = weekDates(o.week);
    const m = o.meal ? S.get(o.meal) : null, r = m && S.get(m.recipe);
    const sh = App.sheet(`<div class="row"><div class="emoji" style="font-size:32px">${esc(c.emoji)}</div><div class="grow"><h3 style="margin:0">${esc(c.name)}</h3>
        <div class="muted">${esc(freqText(c))} · ${o.w || 1} punto${(o.w || 1) === 1 ? '' : 's'}</div></div></div>
      ${r ? `<div class="alert ok tap" id="goRecipe" style="margin-top:12px"><div class="emoji">${esc(r.emoji)}</div><div class="grow"><b>${esc(r.name)}</b><div class="muted">${esc(App.mealDef(m.meal).name)} · ${m.servings || 2} personas</div></div><span class="muted">Ver receta ›</span></div>` : ''}
      ${c.link === 'shop' ? `<div class="alert ok tap" id="goShop" style="margin-top:12px"><div class="emoji">🛒</div><div class="grow"><b>Lista de la compra</b><div class="muted">Se marca sola al «Terminar compra»</div></div><span class="muted">Ir ›</span></div>` : ''}
      <label>Le toca a</label><div class="seg">${ps.map(p => `<button data-who="${p.id}" class="${p.id === o.who ? 'on' : ''}">${esc(p.name)}</button>`).join('')}</div>
      <label>Día</label><select id="day" ${o.meal ? 'disabled' : ''}>${dates.map((d, i) => `<option value="${d}" ${d === o.date ? 'selected' : ''}>${DAY_NAMES[i]} ${esc(fmtShort(d))}</option>`).join('')}</select>
      ${o.meal ? '<div class="muted" style="margin-top:4px">El día lo marca el menú.</div>' : ''}
      ${o.doneAt ? `<label>La hizo</label><div class="seg">${ps.map(p => `<button data-by="${p.id}" class="${p.id === doer(o) ? 'on' : ''}">${esc(p.name)}</button>`).join('')}</div>` : ''}
      <div class="btnrow" style="margin-top:14px">${o.doneAt ? '<button id="undo">↩️ No está hecha</button>' : `<button class="primary" id="done">✓ Hecha</button><button id="doneOther">✓ La hizo otro/a</button>`}</div>
      <div class="actions"><button id="skip">${o.skip ? '↩️ Volver a ponerla' : '⏭️ Saltar esta vez'}</button><button id="edit">✏️ Editar tarea</button><button id="cancel">Cerrar</button></div>`);
    const $ = s => sh.querySelector(s);
    const upd = patch => S.put('chorewk', Object.assign({}, S.get(o.id) || o, patch));
    sh.querySelectorAll('[data-who]').forEach(b => b.onclick = () => { upd({ who: b.dataset.who }); sh.querySelectorAll('[data-who]').forEach(x => x.classList.toggle('on', x === b)); });
    sh.querySelectorAll('[data-by]').forEach(b => b.onclick = () => { upd({ doneBy: b.dataset.by }); sh.querySelectorAll('[data-by]').forEach(x => x.classList.toggle('on', x === b)); });
    $('#day').onchange = () => upd({ date: $('#day').value });
    if ($('#done')) $('#done').onclick = () => { App.closeSheet(); setDone(o, true); };
    if ($('#doneOther')) $('#doneOther').onclick = () => { const other = ps.find(p => p.id !== o.who) || ps[0]; App.closeSheet(); setDone(o, true, other.id); };
    if ($('#undo')) $('#undo').onclick = () => { App.closeSheet(); setDone(o, false); };
    $('#skip').onclick = () => { App.closeSheet(); upd({ skip: !o.skip, doneAt: null, doneBy: null }); App.toast(o.skip ? 'Vuelve a estar en la semana' : 'Saltada esta vez (no cuenta)'); };
    $('#edit').onclick = () => openChore(S.get(o.chore));
    $('#cancel').onclick = App.closeSheet;
    if ($('#goRecipe')) $('#goRecipe').onclick = () => App.modules.menu.openRecipeCard(r, m.servings, [m.date, m.meal]);
    if ($('#goShop')) $('#goShop').onclick = () => { App.closeSheet(); App.go('shop', 'list'); };
  }

  // ---------- Vista: lista de tareas ----------
  function renderList() {
    const view = App.view, ps = App.people(), sh = shares(), cs = chores();
    let h = `<div class="card tap" id="shares"><div class="hhead"><span class="grow">⚖️ Reparto</span><span class="go">Editar ›</span></div>
      <div class="row" style="gap:12px;flex-wrap:wrap">${ps.map(p => `<span class="row" style="gap:6px">${App.avatar(p, 1)}<b>${Math.round(sh[p.id] * 100)}%</b></span>`).join('')}</div>
      <div class="muted" style="margin-top:6px">Cada semana se reparten los puntos según esto y rotando, para que nadie repita siempre lo mismo.</div></div>`;
    const groups = {};
    cs.forEach(c => { const g = freqGroup(c); (groups[g] = groups[g] || []).push(c); });
    Object.keys(groups).sort().forEach(g => {
      h += `<h2>${GROUPS[g]}</h2><div class="card list">${groups[g].map(c => {
        const who = (c.people || []).length ? (c.people || []).map(id => esc(App.person(id).name)).join(', ') : 'todos';
        return `<div class="item tap${c.active === false ? ' off' : ''}" data-ch="${c.id}"><div class="emoji">${esc(c.emoji)}</div>
          <div class="grow"><div class="ellipsis"><b>${esc(c.name)}</b></div><div class="muted ellipsis">${esc(freqText(c))} · ${who}${c.active === false ? ' · pausada' : ''}</div></div>
          <span class="ptspill">${c.weight || 1} pt${(c.weight || 1) === 1 ? '' : 's'}</span></div>`;
      }).join('')}</div>`;
    });
    view.innerHTML = h;
    view.querySelector('#shares').onclick = openShares;
    view.querySelectorAll('[data-ch]').forEach(el => el.onclick = () => openChore(S.get(el.dataset.ch)));
  }

  function openShares() {
    const ps = App.people(), sh = shares();
    const m = App.sheet(`<h3>⚖️ Reparto de tareas</h3><div class="muted">Qué parte de los puntos de la semana hace cada uno. Lo normal: a partes iguales.</div>
      ${ps.map(p => `<label>${esc(p.name)} (%)</label><input data-sh="${p.id}" type="text" inputmode="decimal" autocomplete="off" value="${Math.round(sh[p.id] * 100)}">`).join('')}
      <div class="actions"><button id="eq">A partes iguales</button><button class="primary" id="ok">Guardar</button></div>`);
    const put = v => { S.put('settings', Object.assign({}, S.get('settings') || App.D.settings, { choreShares: v })); App.closeSheet(); App.toast('Reparto guardado: se aplica a lo nuevo y al repartir de nuevo'); };
    m.querySelector('#eq').onclick = () => put({});
    m.querySelector('#ok').onclick = () => {
      const v = {};
      for (const inp of m.querySelectorAll('[data-sh]')) { const n = App.num(inp.value); if (!(n >= 0)) { App.toast('Número no válido'); return; } v[inp.dataset.sh] = n; }
      if (!Object.values(v).some(x => x > 0)) { App.toast('Alguien tiene que hacer algo 😅'); return; }
      put(v);
    };
  }

  // Crear / editar una tarea.
  function openChore(c) {
    const isNew = !c;
    c = c ? JSON.parse(JSON.stringify(c)) : { id: 'chore-' + App.uid(), emoji: '🧽', name: '', weight: 2, freq: { type: 'weekly', day: 5 }, people: [], active: true, order: chores().length };
    c.freq = c.freq || { type: 'weekly', day: 5 };
    const ps = App.people(), sys = !!c.link;
    const m = App.sheet(`<h3>${isNew ? 'Nueva tarea' : 'Editar tarea'}</h3>
      <div class="row"><div style="width:76px"><label>Emoji</label><input id="em" value="${esc(c.emoji)}" maxlength="8" class="center"></div>
        <div class="grow"><label>Nombre</label><input id="nm" value="${esc(c.name)}" maxlength="50" autocomplete="off" placeholder="Ej: Limpiar el baño"></div></div>
      <label>Esfuerzo (puntos)</label>
      <div class="row"><button class="qbtn" id="wDn">−</button><b class="qval" id="wVal"></b><button class="qbtn" id="wUp">+</button><span class="muted grow" id="wHint"></span></div>
      ${c.link === 'cook' ? `<label>Qué comidas del menú son tarea</label><div class="chips" id="cm"></div>`
        : c.link === 'shop' ? `<label>Día de la compra</label><select id="fday">${DAY_NAMES.map((d, i) => `<option value="${i}">${d}</option>`).join('')}</select>`
        : `<label>Frecuencia</label><div class="seg" id="ftype">${[['daily', 'Diaria'], ['days', 'Días'], ['weekly', 'Semanal'], ['everyN', 'Cada N sem.'], ['monthly', 'Mensual']].map(([k, t]) => `<button data-ft="${k}">${t}</button>`).join('')}</div>
          <div id="fdet"></div>`}
      <label>Quién puede hacerla</label><div class="chips" id="ppl"></div><div class="muted" style="margin-top:4px">Sin marcar a nadie = cualquiera.</div>
      <label class="row check-line"><input type="checkbox" id="act" ${c.active !== false ? 'checked' : ''}> Activa (si no, queda en pausa)</label>
      <div class="actions">${isNew || sys ? '' : '<button class="danger" id="del">Eliminar</button>'}<button id="cancel">Cancelar</button><button class="primary" id="ok">Guardar</button></div>`);
    const $ = s => m.querySelector(s);
    const HINT = ['', 'muy rápida', 'rápida', 'normal', 'normal', 'costosa', 'costosa', 'muy costosa', 'muy costosa', 'dura', 'durísima'];
    const drawW = () => { $('#wVal').textContent = c.weight; $('#wHint').textContent = HINT[c.weight] || ''; };
    $('#wDn').onclick = () => { c.weight = Math.max(1, c.weight - 1); drawW(); };
    $('#wUp').onclick = () => { c.weight = Math.min(10, c.weight + 1); drawW(); };
    function drawFreq() {
      if (!$('#ftype')) return;
      const f = c.freq;
      m.querySelectorAll('[data-ft]').forEach(b => b.classList.toggle('on', b.dataset.ft === f.type));
      const daySel = `<label>Día</label><select id="fday">${DAY_NAMES.map((d, i) => `<option value="${i}" ${i === (f.day != null ? f.day : 5) ? 'selected' : ''}>${d}</option>`).join('')}</select>`;
      $('#fdet').innerHTML = f.type === 'days' ? `<label>Qué días</label><div class="chips">${DAY_NAMES.map((d, i) => `<button data-fd="${i}" class="${(f.days || []).includes(i) ? 'on' : ''}">${d.slice(0, 3)}</button>`).join('')}</div>`
        : f.type === 'weekly' ? daySel
        : f.type === 'everyN' ? `<label>Cada cuántas semanas</label><div class="row"><button class="qbtn" id="nDn">−</button><b class="qval">${f.n || 2}</b><button class="qbtn" id="nUp">+</button><span class="muted grow">empezando esta semana</span></div>${daySel}`
        : f.type === 'monthly' ? `<label>Día del mes (1-28)</label><input id="mday" type="text" inputmode="numeric" autocomplete="off" value="${f.monthDay || 1}">`
        : '<div class="muted" style="margin-top:8px">Todos los días de la semana.</div>';
      m.querySelectorAll('[data-fd]').forEach(b => b.onclick = () => { const i = +b.dataset.fd; f.days = (f.days || []).includes(i) ? f.days.filter(x => x !== i) : (f.days || []).concat(i); drawFreq(); });
      if ($('#fday')) $('#fday').onchange = () => { f.day = +$('#fday').value; };
      if ($('#nDn')) { $('#nDn').onclick = () => { f.n = Math.max(2, (f.n || 2) - 1); drawFreq(); }; $('#nUp').onclick = () => { f.n = Math.min(8, (f.n || 2) + 1); drawFreq(); }; }
      if ($('#mday')) $('#mday').onchange = () => { f.monthDay = Math.min(28, Math.max(1, Math.round(App.num($('#mday').value)) || 1)); };
    }
    m.querySelectorAll('[data-ft]').forEach(b => b.onclick = () => {
      c.freq = Object.assign({}, c.freq, { type: b.dataset.ft });
      if (c.freq.type === 'days' && !(c.freq.days || []).length) c.freq.days = [0, 2, 4];
      if (c.freq.type === 'everyN') { c.freq.n = c.freq.n || 2; if (!c.freq.anchor) c.freq.anchor = App.mondayOf(App.today()); }
      drawFreq();
    });
    if (c.link === 'shop') { $('#fday').value = c.freq.day != null ? c.freq.day : 5; $('#fday').onchange = () => { c.freq = { type: 'weekly', day: +$('#fday').value }; }; }
    function drawCook() {
      if (!$('#cm')) return;
      const on = c.cookMeals || ['comida', 'cena'];
      $('#cm').innerHTML = App.C.MEALS.map(x => `<button data-cm="${x.id}" class="${on.includes(x.id) ? 'on' : ''}">${x.emoji} ${x.name}</button>`).join('');
      m.querySelectorAll('[data-cm]').forEach(b => b.onclick = () => { const id = b.dataset.cm; c.cookMeals = on.includes(id) ? on.filter(x => x !== id) : on.concat(id); drawCook(); });
    }
    function drawPeople() {
      $('#ppl').innerHTML = ps.map(p => `<button data-pp="${p.id}" class="${(c.people || []).includes(p.id) ? 'on' : ''}">${esc(p.name)}</button>`).join('');
      m.querySelectorAll('[data-pp]').forEach(b => b.onclick = () => { const id = b.dataset.pp; c.people = (c.people || []).includes(id) ? c.people.filter(x => x !== id) : (c.people || []).concat(id); drawPeople(); });
    }
    $('#cancel').onclick = App.closeSheet;
    $('#ok').onclick = () => {
      c.name = $('#nm').value.trim(); c.emoji = $('#em').value.trim() || '🧽';
      if (!c.name) { App.toast('Ponle un nombre'); $('#nm').focus(); return; }
      if ($('#mday')) c.freq.monthDay = Math.min(28, Math.max(1, Math.round(App.num($('#mday').value)) || 1));
      if (c.freq.type === 'days' && !(c.freq.days || []).length) { App.toast('Elige al menos un día'); return; }
      if (c.link === 'cook' && !(c.cookMeals || ['comida', 'cena']).length) { App.toast('Elige al menos una comida'); return; }
      c.active = $('#act').checked;
      S.put('chore', c); App.closeSheet(); App.toast('Tarea guardada');
    };
    const del = $('#del');
    if (del) del.onclick = async () => {
      if (!await App.confirmDelete(`¿Eliminar «${c.name}»? Lo ya hecho se queda en el ranking.`)) return;
      App.closeSheet(); App.removeWithUndo('chore', S.get(c.id), 'Tarea eliminada');
    };
    drawW(); drawFreq(); drawCook(); drawPeople();
    if (isNew) setTimeout(() => $('#nm').focus(), 80);
  }

  // ---------- Estadísticas, logros y premios ----------
  function periodFilter(period) {
    const today = App.today(), mon = App.mondayOf(today), month = App.monthOf(today);
    if (period === 'week') return o => o.week === mon;
    if (period === 'month') return o => App.monthOf(o.date) === month;
    return () => true;
  }
  function personStats(pid) { return memoize('ps' + pid, () => personStatsRaw(pid)); }
  function personStatsRaw(pid) {
    const all = occs(), mine = all.filter(o => o.doneAt && doer(o) === pid);
    const s = { count: mine.length, points: mine.reduce((a, o) => a + (o.w || 1), 0), cook: 0, shop: 0, cats: 0, helper: 0, early: 0, maxSame: 0, distinct: 0, streak: 0, perfect: 0, wins: 0 };
    const per = {};
    mine.forEach(o => {
      const c = choreOf(o);
      if (c.link === 'cook') s.cook++;
      if (c.link === 'shop') s.shop++;
      if (/monchi|hierba|arenero|gat/i.test(c.name)) s.cats++;
      if (o.doneBy && o.doneBy !== o.who) s.helper++;
      if (new Date(o.doneAt).getHours() < 9) s.early++;
      per[o.chore] = (per[o.chore] || 0) + 1;
    });
    s.maxSame = Math.max(0, ...Object.values(per)); s.distinct = Object.keys(per).length;
    // Racha: días seguidos con alguna tarea hecha.
    const days = [...new Set(mine.map(o => { const d = new Date(o.doneAt); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }))].sort();
    let run = 0, prev = null;
    days.forEach(d => { run = prev && App.addDays(prev, 1) === d ? run + 1 : 1; s.streak = Math.max(s.streak, run); prev = d; });
    // Semanas terminadas: perfectas (todo lo suyo hecho) y ganadas.
    const weeks = [...new Set(all.map(o => o.week))].filter(w => isPastWeek(w));
    weeks.forEach(w => {
      const wk = all.filter(o => o.week === w && !o.skip);
      const assigned = wk.filter(o => o.who === pid);
      if (assigned.length && assigned.every(o => o.doneAt)) s.perfect++;
      if (weekWinner(w) === pid) s.wins++;
    });
    return s;
  }
  function weekWinner(w) {
    const sc = weekScore(w), ps = App.people().map(p => p.id).sort((a, b) => sc[b].done - sc[a].done);
    if (!ps.length || !sc[ps[0]].done) return null;
    return ps.length > 1 && sc[ps[0]].done === sc[ps[1]].done ? null : ps[0];
  }
  function monthWinner(month) {
    const pts = {};
    occs().filter(o => o.doneAt && App.monthOf(o.date) === month).forEach(o => { pts[doer(o)] = (pts[doer(o)] || 0) + (o.w || 1); });
    const ps = Object.keys(pts).sort((a, b) => pts[b] - pts[a]);
    if (!ps.length || (ps.length > 1 && pts[ps[0]] === pts[ps[1]])) return null;
    return ps[0];
  }

  const ACH = [
    ['🌱', 'Primer paso', 'Haz tu primera tarea', 'count', 1], ['🧹', 'Manos a la obra', '10 tareas hechas', 'count', 10], ['🏅', 'Currante', '50 tareas hechas', 'count', 50],
    ['💪', 'Centenario', 'Llega a 100 puntos', 'points', 100], ['🚀', 'Leyenda del hogar', 'Llega a 500 puntos', 'points', 500], ['💎', 'Diamante', 'Llega a 1.000 puntos', 'points', 1000],
    ['🔥', 'En racha', '7 días seguidos haciendo algo', 'streak', 7], ['☄️', 'Imparable', '30 días seguidos', 'streak', 30],
    ['💯', 'Semana perfecta', 'Todas tus tareas de una semana', 'perfect', 1], ['✨', 'Triple perfección', '3 semanas perfectas', 'perfect', 3],
    ['🏆', 'Campeón/a', 'Gana una semana', 'wins', 1], ['👑', 'Realeza', 'Gana 5 semanas', 'wins', 5],
    ['👨‍🍳', 'Chef', 'Cocina 10 comidas del menú', 'cook', 10], ['⭐', 'MasterChef', 'Cocina 50 comidas', 'cook', 50],
    ['🛒', 'Rey/Reina del súper', 'Haz 5 compras semanales', 'shop', 5], ['🐱', 'Mayordomo de Monchi y Hierba', '20 tareas de las gatas', 'cats', 20],
    ['🤝', 'Buen compañero/a', '5 tareas que le tocaban al otro', 'helper', 5], ['🌅', 'Madrugador/a', '10 tareas antes de las 9:00', 'early', 10],
    ['🎯', 'Especialista', 'La misma tarea 25 veces', 'maxSame', 25], ['🧭', 'Todoterreno', '10 tareas distintas', 'distinct', 10]
  ];

  // Estado de los premios: quién se los ha ganado y si ya se han disfrutado.
  function rewardStatus(rw) {
    const today = App.today(), out = [];
    if (rw.rule === 'week') {
      const last = App.addDays(App.mondayOf(today), -7), win = weekWinner(last);
      if (win) out.push({ pid: win, key: 'w' + last, label: `Semana del ${fmtShort(last)}` });
      const lead = weekWinner(App.mondayOf(today));
      return { items: out, now: lead ? `ahora va ${App.person(lead).name}` : 'ahora: empate' };
    }
    if (rw.rule === 'month') {
      const d = new Date(today + 'T12:00:00'); d.setDate(1); d.setMonth(d.getMonth() - 1);
      const lm = d.toISOString().slice(0, 7), win = monthWinner(lm);
      if (win) out.push({ pid: win, key: 'm' + lm, label: App.fmtMonth(lm) });
      const lead = monthWinner(App.monthOf(today));
      return { items: out, now: lead ? `ahora va ${App.person(lead).name}` : 'ahora: empate' };
    }
    // Cada X puntos: se acumulan los que falten por disfrutar.
    const n = Math.max(1, rw.points || 100), claims = rw.claims || {};
    const now = App.people().map(p => {
      const pts = personStats(p.id).points, earned = Math.floor(pts / n), used = claims[p.id] || 0;
      for (let k = used; k < earned; k++) out.push({ pid: p.id, key: 'p' + p.id, label: `${earned * n} puntos` });
      return `${p.name} ${pts % n}/${n}`;
    }).join(' · ');
    return { items: out, now: now };
  }
  function claim(rw, it) {
    const cur = S.get(rw.id) || rw, upd = Object.assign({}, cur);
    if (rw.rule === 'points') upd.claims = Object.assign({}, cur.claims || {}, { [it.pid]: ((cur.claims || {})[it.pid] || 0) + 1 });
    else upd.claimed = Object.assign({}, cur.claimed || {}, { [it.key]: true });
    S.put('reward', upd);
    App.toast(`🎉 ¡A disfrutar, ${App.person(it.pid).name}!`);
  }

  function renderRank() {
    const view = App.view, ps = App.people(), f = periodFilter(rankPeriod), me = S.me();
    const inP = occs().filter(f), today = App.today();
    const rows = ps.map(p => {
      const done = inP.filter(o => o.doneAt && doer(o) === p.id), due = inP.filter(o => o.who === p.id && !o.skip && o.date <= today);
      return { p, pts: done.reduce((a, o) => a + (o.w || 1), 0), n: done.length, pct: due.length ? Math.round(due.filter(o => o.doneAt).length / due.length * 100) : null };
    }).sort((a, b) => b.pts - a.pts);
    const MEDAL = ['🥇', '🥈', '🥉'];
    achWho = achWho && S.get(achWho) ? achWho : me;
    let h = `<div class="seg">${[['week', 'Semana'], ['month', 'Mes'], ['all', 'Siempre']].map(([k, t]) => `<button data-rp="${k}" class="${rankPeriod === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div class="card podium">${rows.map((r, i) => `<div class="podrow tap" data-ach="${r.p.id}"><span class="medal">${r.pts ? MEDAL[i] || '' : ''}</span>${App.avatar(r.p)}
        <div class="grow"><b>${esc(r.p.name)}</b><div class="muted">${r.n} tarea${r.n === 1 ? '' : 's'}${r.pct != null ? ` · cumple el ${r.pct}%` : ''}</div></div><div class="bigpts">${r.pts}<small> pts</small></div></div>`).join('')}</div>`;
    // Premios
    h += `<h2>🎁 Premios</h2>`;
    const rws = rewards();
    h += rws.length ? `<div class="card list">${rws.map(rw => {
      const st = rewardStatus(rw), pend = st.items.filter(it => rw.rule === 'points' || !(rw.claimed || {})[it.key]);
      return `<div class="item tap" data-rw="${rw.id}"><div class="emoji">${esc(rw.emoji)}</div><div class="grow"><b>${esc(rw.name)}</b>
          <div class="muted">${rw.rule === 'week' ? 'Gana la semana' : rw.rule === 'month' ? 'Gana el mes' : `Cada ${rw.points} pts`} · ${esc(st.now)}</div></div></div>
        ${pend.map((it, k) => `<div class="alert"><div class="emoji">🏆</div><div class="grow"><b>${esc(App.person(it.pid).name)}</b> se lo ha ganado<div class="muted">${esc(it.label)}</div></div><button class="small primary" data-claim="${rw.id}|${k}">Disfrutado</button></div>`).join('')}`;
    }).join('')}</div>` : '<div class="card empty">Aún no hay premios.</div>';
    h += `<button class="block small ghost" id="addRw">＋ Añadir premio</button>`;
    // Logros
    const st = personStats(achWho), got = ACH.filter(a => st[a[3]] >= a[4]).length;
    h += `<h2>🏅 Logros · ${got}/${ACH.length}</h2><div class="seg">${ps.map(p => `<button data-aw="${p.id}" class="${p.id === achWho ? 'on' : ''}">${esc(p.name)}</button>`).join('')}</div>
      <div class="achgrid">${ACH.map(([e, n, d, k, goal]) => {
        const v = Math.min(st[k], goal), ok = st[k] >= goal;
        return `<div class="ach${ok ? ' ok' : ''}"><div class="ae">${e}</div><b>${esc(n)}</b><span>${esc(d)}</span>${ok ? '<em>¡Conseguido!</em>' : `<div class="bar"><span style="width:${v / goal * 100}%"></span></div><em>${v}/${goal}</em>`}</div>`;
      }).join('')}</div>`;
    // Por tarea
    const byChore = {};
    inP.filter(o => o.doneAt).forEach(o => { const b = byChore[o.chore] = byChore[o.chore] || {}; b[doer(o)] = (b[doer(o)] || 0) + 1; });
    const keys = Object.keys(byChore).sort((a, b) => Object.values(byChore[b]).reduce((x, y) => x + y, 0) - Object.values(byChore[a]).reduce((x, y) => x + y, 0));
    h += `<h2>📊 Por tarea</h2>` + (keys.length ? `<div class="card list">${keys.map(k => {
      const c = choreOf({ chore: k }), b = byChore[k], tot = Object.values(b).reduce((x, y) => x + y, 0);
      return `<div class="item tap" data-ch="${k}"><div class="emoji">${esc(c.emoji)}</div><div class="grow"><div class="ellipsis">${esc(c.name)}</div>
        <div class="stack">${ps.map(p => b[p.id] ? `<span style="width:${b[p.id] / tot * 100}%;background:${esc(p.color)}"></span>` : '').join('')}</div>
        <div class="muted">${ps.filter(p => b[p.id]).map(p => `${esc(p.name)} ${b[p.id]}`).join(' · ')}</div></div></div>`;
    }).join('')}</div>` : '<div class="card empty">Aún no hay tareas hechas en este periodo.</div>');
    view.innerHTML = h;
    view.querySelectorAll('[data-rp]').forEach(b => b.onclick = () => { rankPeriod = b.dataset.rp; App.render(); });
    view.querySelectorAll('[data-aw]').forEach(b => b.onclick = () => { achWho = b.dataset.aw; App.render(); });
    view.querySelectorAll('[data-ach]').forEach(el => el.onclick = () => { achWho = el.dataset.ach; App.render(); });
    view.querySelectorAll('[data-rw]').forEach(el => el.onclick = () => openReward(S.get(el.dataset.rw)));
    view.querySelectorAll('[data-ch]').forEach(el => el.onclick = () => { const c = S.get(el.dataset.ch); if (c) openChore(c); });
    view.querySelectorAll('[data-claim]').forEach(b => b.onclick = () => {
      const [id, k] = b.dataset.claim.split('|'), rw = S.get(id), st = rewardStatus(rw);
      const pend = st.items.filter(it => rw.rule === 'points' || !(rw.claimed || {})[it.key]);
      if (pend[+k]) claim(rw, pend[+k]);
    });
    view.querySelector('#addRw').onclick = () => openReward(null);
  }

  function openReward(rw) {
    const isNew = !rw;
    rw = rw ? Object.assign({}, rw) : { id: 'rw-' + App.uid(), emoji: '🎁', name: '', rule: 'week', points: 100, order: rewards().length };
    const m = App.sheet(`<h3>${isNew ? 'Nuevo premio' : 'Editar premio'}</h3>
      <div class="row"><div style="width:76px"><label>Emoji</label><input id="em" value="${esc(rw.emoji)}" maxlength="8" class="center"></div>
        <div class="grow"><label>Premio</label><input id="nm" value="${esc(rw.name)}" maxlength="60" autocomplete="off" placeholder="Ej: Elige la peli del finde"></div></div>
      <label>Se gana</label><div class="seg">${[['week', 'Ganar la semana'], ['month', 'Ganar el mes'], ['points', 'Cada X puntos']].map(([k, t]) => `<button data-rr="${k}" class="${rw.rule === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div id="ptsRow" style="display:${rw.rule === 'points' ? '' : 'none'}"><label>Cada cuántos puntos</label><input id="pts" type="text" inputmode="numeric" autocomplete="off" value="${rw.points || 100}"></div>
      <div class="actions">${isNew ? '' : '<button class="danger" id="del">Eliminar</button>'}<button id="cancel">Cancelar</button><button class="primary" id="ok">Guardar</button></div>`);
    const $ = s => m.querySelector(s);
    m.querySelectorAll('[data-rr]').forEach(b => b.onclick = () => { rw.rule = b.dataset.rr; m.querySelectorAll('[data-rr]').forEach(x => x.classList.toggle('on', x === b)); $('#ptsRow').style.display = rw.rule === 'points' ? '' : 'none'; });
    $('#cancel').onclick = App.closeSheet;
    $('#ok').onclick = () => {
      rw.name = $('#nm').value.trim(); rw.emoji = $('#em').value.trim() || '🎁';
      if (!rw.name) { App.toast('¿Cuál es el premio?'); return; }
      if (rw.rule === 'points') { const n = Math.round(App.num($('#pts').value)); if (!(n > 0)) { App.toast('Puntos no válidos'); return; } rw.points = n; }
      S.put('reward', rw); App.closeSheet(); App.toast('Premio guardado');
    };
    if ($('#del')) $('#del').onclick = async () => { if (!await App.confirmDelete(`¿Eliminar el premio «${rw.name}»?`)) return; App.closeSheet(); App.removeWithUndo('reward', S.get(rw.id), 'Premio eliminado'); };
  }

  // ---------- Para Inicio, Menú y Compra ----------
  // Tarjeta de Inicio: lo de hoy (lo mío primero) y cómo va la semana.
  function homeCard() {
    const today = App.today(), me = S.me(), mon = App.mondayOf(today);
    const list = occs().filter(o => o.date === today && !o.skip).sort((a, b) => ((a.who !== me) - (b.who !== me)) || (!!a.doneAt - !!b.doneAt) || (b.w - a.w));
    const late = occs().filter(o => o.week === mon && o.date < today && !o.doneAt && !o.skip && o.who === me).length;
    const sc = weekScore(mon), ps = App.people();
    if (!chores().length) return '';
    const minePending = list.filter(o => o.who === me && !o.doneAt);
    return `${lastWeekCard()}<div class="card"><div class="hhead"><span class="grow">🧹 Tareas de hoy</span><button class="small ghost" data-go="chores">Semana ›</button></div>
      ${list.map(o => occRow(o)).join('') || '<div class="muted" style="padding:6px 0">Hoy no hay tareas. ¡Día libre! 🎉</div>'}
      ${minePending.length > 1 ? `<button class="small block" id="allMine">✓ Hechas todas las mías de hoy (${minePending.length})</button>` : ''}
      ${list.length ? '<div class="muted center" style="margin-top:6px;font-size:12px">Consejo: desliza una tarea a la derecha para marcarla</div>' : ''}
      ${late ? `<div class="alert" data-go="chores" style="margin-top:8px"><div class="emoji">⏰</div><div class="grow"><b>Tienes ${late} tarea${late === 1 ? '' : 's'} atrasada${late === 1 ? '' : 's'}</b><div class="muted">De días anteriores de esta semana</div></div></div>` : ''}
      <div class="row" style="margin-top:8px;gap:14px;flex-wrap:wrap">${ps.map(p => `<span class="row" style="gap:6px">${App.avatar(p, 1)}<span class="muted"><b>${sc[p.id].done}</b>/${sc[p.id].assigned} pts</span></span>`).join('')}</div></div>`;
  }

  // Resumen de una semana terminada (para Inicio y el aviso del lunes).
  function weekSummary(monday) {
    const sc = weekScore(monday), ps = App.people();
    if (!ps.some(p => sc[p.id].assigned)) return null;
    const win = weekWinner(monday), rw = rewards().find(r => r.rule === 'week');
    const pts = ps.map(p => `${p.name} ${sc[p.id].done} pts`).join(' · ');
    return { week: monday, winner: win, text: win ? `Ganó ${App.person(win).name} (${pts})${rw ? ` → ${rw.emoji} ${rw.name}` : ''}` : `Empate (${pts})`, reward: rw };
  }
  // Tarjeta en Inicio de lunes a miércoles con la semana pasada (se puede cerrar).
  function lastWeekCard() {
    const today = App.today(), dow = (new Date(today + 'T12:00:00').getDay() + 6) % 7;
    if (dow > 2) return '';
    const last = App.addDays(App.mondayOf(today), -7), sum = weekSummary(last);
    let closed = null; try { closed = localStorage.getItem('splitcarlis.weekCard'); } catch (e) {}
    if (!sum || closed === last) return '';
    const ps = App.people(), sc = weekScore(last);
    return `<div class="card weekcard"><div class="hhead"><span class="grow">🏆 La semana pasada</span><button class="xbtn" id="closeWeek" aria-label="Cerrar">✕</button></div>
      <div class="row" style="gap:12px">${sum.winner ? `<div class="emoji" style="font-size:34px">🥇</div><div class="grow"><b>¡Ganó ${esc(App.person(sum.winner).name)}!</b>` : '<div class="emoji" style="font-size:34px">🤝</div><div class="grow"><b>¡Empate!</b>'}
        <div class="muted">${ps.map(p => `${esc(p.name)} ${sc[p.id].done}/${sc[p.id].assigned} pts`).join(' · ')}</div>
        ${sum.winner && sum.reward ? `<div style="margin-top:4px">${esc(sum.reward.emoji)} Premio: <b>${esc(sum.reward.name)}</b></div>` : ''}</div></div>
      <button class="small ghost block" data-go="chores/rank">Ver ranking y logros</button></div>`;
  }
  // Lo que necesita Inicio además de las filas.
  function bindHome(root) {
    bindRows(root);
    const all = root.querySelector('#allMine');
    if (all) all.onclick = () => {
      const me = S.me(), today = App.today();
      const list = occs().filter(o => o.date === today && o.who === me && !o.doneAt && !o.skip);
      S.putMany(list.map(o => ({ kind: 'chorewk', data: Object.assign({}, o, { doneAt: Date.now(), doneBy: me }) }))
        .concat(list.filter(o => o.meal && S.get(o.meal)).map(o => ({ kind: 'meal', data: Object.assign({}, S.get(o.meal), { doneAt: Date.now(), skip: false }) }))));
      App.toast(`✅ ${list.length} tareas hechas: +${list.reduce((a, o) => a + (o.w || 1), 0)} pts`, { undo: () => S.putMany(list.map(o => ({ kind: 'chorewk', data: o }))) });
    };
    const cw = root.querySelector('#closeWeek');
    if (cw) cw.onclick = () => { try { localStorage.setItem('splitcarlis.weekCard', App.addDays(App.mondayOf(App.today()), -7)); } catch (e) {} App.render(); };
  }

  App.modules.chores = { render, openOcc, openChore, homeCard, bindRows, bindHome, mealDone, shopDone, cookOf, shopOccThisWeek, ensureWeek, weekSummary };

  // Datos iniciales (los usa ensureSeed del núcleo).
  App.choreSeed = function () {
    const W = (day) => ({ type: 'weekly', day });
    const C = [
      ['chore-cook', '👨‍🍳', 'Cocinar', 3, null, { link: 'cook', cookMeals: ['comida', 'cena'] }],
      ['chore-shop', '🛒', 'Hacer la compra semanal', 4, W(5), { link: 'shop' }],
      ['chore-fregar', '🍽️', 'Fregar / lavavajillas', 1, { type: 'daily' }],
      ['chore-arenero', '🐱', 'Arenero de Monchi y Hierba', 1, { type: 'daily' }],
      ['chore-gatas', '🐟', 'Comida y agua de Monchi y Hierba', 1, { type: 'days', days: [0, 2, 4, 6] }],
      ['chore-basura', '🗑️', 'Sacar la basura y el reciclaje', 1, { type: 'days', days: [0, 2, 4] }],
      ['chore-lavadora', '🧺', 'Poner lavadora y tender', 2, { type: 'days', days: [1, 4] }],
      ['chore-doblar', '👕', 'Recoger y doblar la ropa', 2, W(6)],
      ['chore-aspirar', '🧹', 'Aspirar / barrer', 2, { type: 'days', days: [2, 5] }],
      ['chore-suelos', '🪣', 'Fregar los suelos', 3, W(5)],
      ['chore-bano', '🚽', 'Limpiar el baño', 4, W(5)],
      ['chore-cocina', '🧽', 'Limpiar la cocina a fondo', 3, W(6)],
      ['chore-polvo', '🪶', 'Quitar el polvo', 2, W(3)],
      ['chore-sabanas', '🛏️', 'Cambiar las sábanas', 2, { type: 'everyN', n: 2, day: 6 }],
      ['chore-plantas', '🪴', 'Regar las plantas', 1, W(2)],
      ['chore-nevera', '🧊', 'Limpiar la nevera', 3, { type: 'monthly', monthDay: 1 }],
      ['chore-cristales', '🪟', 'Limpiar cristales', 3, { type: 'monthly', monthDay: 15 }]
    ];
    const anchor = App.mondayOf(App.today());
    const out = C.map(([id, emoji, name, weight, freq, extra], i) => ({ kind: 'chore', data: Object.assign({ id, emoji, name, weight,
      freq: freq ? Object.assign({ anchor }, freq) : null, people: [], active: true, order: i }, extra || {}) }));
    [['rw-peli', '🎬', 'Elige la peli o serie del finde', 'week', 0], ['rw-cena', '🍽️', 'Cena fuera: elige sitio y paga el otro', 'month', 0],
      ['rw-libre', '🛋️', 'Un día libre de fregar', 'points', 100], ['rw-desayuno', '🥐', 'Desayuno en la cama', 'points', 250]]
      .forEach(([id, emoji, name, rule, points], i) => out.push({ kind: 'reward', data: { id, emoji, name, rule, points: points || 100, order: i } }));
    return out;
  };
})();
