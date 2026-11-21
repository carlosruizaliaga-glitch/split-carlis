// Módulo Menú: semana (plantillas, sugerencias, copiar semana) y comidas editables con ingredientes para 1 persona.
// Cada hueco (día + comida) es un dato propio para que los dos móviles puedan editar a la vez.
(function () {
  'use strict';
  const App = window.App, S = App.S, SL = App.SL, C = App.C;
  const esc = App.esc;
  let week = App.mondayOf(App.today());
  let recipeQuery = '', recipeMeal = '';
  let selecting = false, selected = {}; // comidas elegidas: id → personas

  const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const mealId = (date, meal) => `m-${date}-${meal}`;
  const weekDates = w => Array.from({ length: 7 }, (_, i) => App.addDays(w, i));
  const weekMeals = w => { const ds = weekDates(w); return App.meals().filter(m => ds.includes(m.date)); };
  const fmtShort = d => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

  function render() { renderWeek(); }
  function renderRecipesModule() { App.fabAction = selecting ? null : () => openRecipe(); renderRecipes(); }
  // Abre Recetas en modo «elegir varias» (desde Menú o desde Compra).
  function startPicking() { selecting = true; selected = {}; App.go('recipes'); }

  // Coste de una ración consumida (parte proporcional del envase) en un súper.
  function recipeCost(r, store, pById) {
    let total = 0;
    (r.ingredients || []).forEach(ing => {
      const p = pById[ing.product]; if (!p) return;
      const info = SL.priceInfo(p, store); if (!info) return;
      total += ing.qty / p.pack * info.p;
    });
    return total / (r.servings || 1);
  }

  // Nutrición por persona de una receta (con los ingredientes que tienen datos).
  const nutOf = (r, pById) => SL.recipeNut(r, pById);
  // Bloque «por persona» para fichas y editor.
  function nutHtml(r, pById) {
    const { nut, missing } = nutOf(r, pById);
    if (!(r.ingredients || []).length) return '';
    if (missing.length === r.ingredients.length) return '<div class="muted">Sus ingredientes aún no tienen información nutricional. Puedes añadirla en cada producto.</div>';
    return App.nutGrid(nut) + (missing.length ? `<div class="muted" style="margin-top:6px">Sin datos de: ${missing.map(esc).join(', ')} (no se cuentan).</div>` : '')
      + '<div class="muted" style="margin-top:6px">Valores orientativos. IR = ingesta de referencia diaria de un adulto.</div>';
  }

  // ---------- Semana ----------
  function renderWeek() {
    const view = App.view;
    const dates = weekDates(week), meals = App.enabledMeals(), rById = App.recipesById();
    const planned = weekMeals(week).filter(m => meals.some(x => x.id === m.meal));
    const totalSlots = dates.length * meals.length;
    const today = App.today();
    const isThisWeek = week === App.mondayOf(today);
    const store = App.currentStore(), pById = App.productsById();
    let estimate = 0;
    planned.forEach(m => { const r = rById[m.recipe]; if (r && store) estimate += recipeCost(r, store, pById) * (m.servings || 2); });

    let h = `<div class="weeknav"><button class="icon" id="prevW" aria-label="Semana anterior">‹</button>
      <div class="grow center"><b>${esc(fmtShort(dates[0]))} – ${esc(fmtShort(dates[6]))}</b>
      <div class="muted">${isThisWeek ? 'Esta semana' : week > App.mondayOf(today) ? 'Próximamente' : 'Semana pasada'}</div></div>
      ${isThisWeek ? '' : '<button class="small ghost" id="thisW">Hoy</button>'}<button class="icon" id="nextW" aria-label="Semana siguiente">›</button></div>
      <div class="card">
        <div class="row"><div class="grow"><b>${planned.length}/${totalSlots}</b> comidas planificadas</div>
        ${estimate ? `<div class="muted">≈ ${App.euros(estimate)} en comida</div>` : ''}</div>
        <div class="bar"><span style="width:${totalSlots ? planned.length / totalSlots * 100 : 0}%"></span></div>
        <button class="primary block" id="pickDishes" style="margin-top:12px">🍳 Planificar eligiendo recetas</button>
        <div class="section-label">Plantillas</div>
        <div class="chips">${App.menuTemplates().map(t => `<button data-tpl="${t.id}">+ ${esc(t.emoji)} ${esc(t.name)}</button>`).join('')}</div>
        <div class="btnrow"><button class="ghost" id="fillRandom">🎲 Sugerir huecos</button><button class="ghost" id="copyPrev">⎘ Copiar semana anterior</button></div>
        ${planned.length ? '<button class="ghost block small" id="saveWeekTpl">💾 Guardar esta semana como plantilla</button>' : ''}
        ${planned.length ? `<button class="block" id="toList" style="margin-top:10px">🛒 Crear lista de la compra desde el menú</button>` : ''}
      </div>`;

    dates.forEach((d, i) => {
      let dayK = 0;
      meals.forEach(meal => { const sl = S.get(mealId(d, meal.id)); const rr = sl && sl.recipe && rById[sl.recipe]; if (rr) dayK += nutOf(rr, pById).nut.kcal; });
      h += `<div class="card day${d === today ? ' today' : ''}"><div class="dayhdr row"><span class="grow">${DAY_NAMES[i]} <span class="muted">${esc(fmtShort(d))}</span>${d === today ? ' <span class="pill pos">hoy</span>' : ''}</span>${dayK ? `<span class="kcal-pill">≈ ${App.fmtN(dayK, 'kcal')} kcal/pers.</span>` : ''}</div>`;
      meals.forEach(meal => {
        const slot = S.get(mealId(d, meal.id));
        const r = slot && slot.recipe && rById[slot.recipe];
        const label = r ? `${esc(r.emoji)} ${slot.skip ? `<s>${esc(r.name)}</s>` : esc(r.name)}` : slot && slot.text ? `📝 ${esc(slot.text)}` : '';
        const serv = (slot && (slot.servings || 2) !== App.defaultServings() ? ` <span class="pill zero">${slot.servings} pers.</span>` : '')
          + (slot && slot.doneAt ? ' <span class="pill pos">✓</span>' : '') + (slot && slot.skip ? ' <span class="pill zero">no se hizo</span>' : '');
        h += `<div class="slot tap" data-slot="${d}|${meal.id}"><span class="slotmeal">${meal.emoji} ${esc(meal.name)}</span>
          <span class="grow slotval ${label ? '' : 'empty'}">${label || '＋ Añadir'}${serv}</span></div>`;
      });
      h += `</div>`;
    });
    if (planned.length) h += `<button class="block danger" id="clearW" style="margin-top:6px">Vaciar esta semana</button>`;
    view.innerHTML = h;
    const $ = s => view.querySelector(s);
    $('#prevW').onclick = () => { week = App.addDays(week, -7); App.render(); };
    $('#nextW').onclick = () => { week = App.addDays(week, 7); App.render(); };
    if ($('#thisW')) $('#thisW').onclick = () => { week = App.mondayOf(today); App.render(); };
    view.querySelectorAll('[data-tpl]').forEach(b => b.onclick = () => applyTemplate(App.menuTemplates().find(t => t.id === b.dataset.tpl)));
    $('#fillRandom').onclick = fillRandom;
    $('#copyPrev').onclick = copyPrevWeek;
    if ($('#saveWeekTpl')) $('#saveWeekTpl').onclick = () => {
      const plan = {};
      weekDates(week).forEach((d, i) => App.enabledMeals().forEach(meal => {
        const sl = S.get(mealId(d, meal.id));
        if (!sl || !sl.recipe) return;
        plan[meal.id] = plan[meal.id] || [null, null, null, null, null, null, null];
        plan[meal.id][i] = sl.recipe;
      }));
      App.edit.openMenuTemplate(null, { plan });
    };
    if ($('#toList')) $('#toList').onclick = () => openMenuToList();
    $('#pickDishes').onclick = startPicking;
    if ($('#clearW')) $('#clearW').onclick = clearWeek;
    view.querySelectorAll('[data-slot]').forEach(el => el.onclick = () => { const [d, m] = el.dataset.slot.split('|'); openSlot(d, m); });
  }

  function newMeal(date, meal, recipe, text, servings) {
    return { id: mealId(date, meal), date, meal, recipe: recipe || null, text: text || '', servings: servings || App.defaultServings() };
  }

  // Como las plantillas de la maleta: solo rellenan huecos vacíos.
  function applyTemplate(tpl) {
    const dates = weekDates(week), enabled = App.enabledMeals().map(m => m.id), rById = App.recipesById();
    const changes = [];
    Object.entries(tpl.plan).forEach(([meal, list]) => {
      if (!enabled.includes(meal)) return;
      list.forEach((rid, i) => {
        if (!rid || !rById[rid] || S.get(mealId(dates[i], meal))) return;
        changes.push({ kind: 'meal', data: newMeal(dates[i], meal, rid) });
      });
    });
    S.putMany(changes);
    App.toast(changes.length ? `Añadidas ${changes.length} comidas` : 'No había huecos que rellenar');
  }

  function fillRandom() {
    const dates = weekDates(week), recipes = App.recipes();
    const used = new Set(weekMeals(week).map(m => m.recipe).filter(Boolean));
    const changes = [];
    dates.forEach(d => App.enabledMeals().forEach(meal => {
      if (S.get(mealId(d, meal.id))) return;
      const fit = recipes.filter(r => (r.meals || []).includes(meal.id));
      if (!fit.length) return;
      // Evita repetir en la semana (salvo desayunos, que se repiten a gusto).
      let pool = meal.id === 'desayuno' ? fit : fit.filter(r => !used.has(r.id));
      if (!pool.length) pool = fit;
      const r = pool[Math.floor(Math.random() * pool.length)];
      used.add(r.id);
      changes.push({ kind: 'meal', data: newMeal(d, meal.id, r.id) });
    }));
    S.putMany(changes);
    App.toast(changes.length ? `Sugeridas ${changes.length} comidas. Toca una para cambiarla.` : 'No había huecos que rellenar');
  }

  function copyPrevWeek() {
    const prev = App.addDays(week, -7), enabled = App.enabledMeals().map(m => m.id);
    const changes = [];
    weekMeals(prev).forEach(m => {
      if (!enabled.includes(m.meal)) return;
      const d = App.addDays(m.date, 7);
      if (S.get(mealId(d, m.meal))) return;
      changes.push({ kind: 'meal', data: newMeal(d, m.meal, m.recipe, m.text, m.servings) });
    });
    S.putMany(changes);
    App.toast(changes.length ? `Copiadas ${changes.length} comidas` : 'Nada que copiar de la semana anterior');
  }

  async function clearWeek() {
    const list = weekMeals(week);
    if (!await App.confirmDelete(`¿Vaciar las ${list.length} comidas de esta semana?`)) return;
    S.putMany(list.map(m => ({ kind: 'meal', data: m, deleted: true })));
    App.toast('Semana vaciada', { undo: () => S.putMany(list.map(m => ({ kind: 'meal', data: m }))) });
  }

  // ---------- Elegir comida de un hueco ----------
  function openSlot(date, meal) {
    const slot = S.get(mealId(date, meal));
    const mdef = App.mealDef(meal);
    let servings = slot ? slot.servings || 2 : App.defaultServings();
    let showAll = false, q = '';
    const di = (new Date(date + 'T12:00:00').getDay() + 6) % 7;
    const m = App.sheet(`<h3>${DAY_NAMES[di]} · ${esc(mdef.emoji)} ${esc(mdef.name)}</h3>
      <div class="row" style="margin-top:8px"><span class="grow muted">Personas que comen</span>
        <button class="qbtn" id="sMinus">−</button><b id="sVal" class="qval"></b><button class="qbtn" id="sPlus">+</button></div>
      <div class="sheethead" style="margin-top:2px"><input id="q" class="search" type="search" enterkeyhint="done" placeholder="🔍 Buscar receta" autocomplete="off"></div>
      <div class="chips" style="margin-top:8px">${['Fuera de casa', 'Sobras', 'Libre'].map(t => `<button data-text="${t}">${t}</button>`).join('')}</div>
      <div class="list" id="rlist" style="margin-top:6px"></div>
      <div class="row" style="margin-top:10px"><input id="free" placeholder="Otra cosa (texto libre)" class="grow" value="${esc(slot && slot.text ? slot.text : '')}"><button class="small" id="useFree">Usar</button></div>
      ${slot && slot.recipe && date <= App.today() ? `<div class="section-label">Despensa</div><div class="muted">Sus ingredientes se descuentan de la despensa al acabar el día.</div>
        <div class="btnrow"><button id="done" class="${slot.doneAt ? 'primary' : ''}">✓ ${slot.doneAt ? 'Hecha' : 'Ya la hicimos'}</button><button id="skip" class="${slot.skip ? 'primary' : ''}">✗ ${slot.skip ? 'No se hizo' : 'No la hicimos'}</button></div>` : ''}
      <div class="actions">${slot ? '<button class="danger" id="clear">Quitar</button>' : ''}<button id="newR">＋ Nueva receta</button><button id="cancel">Cerrar</button></div>`);
    const $ = s => m.querySelector(s);
    const save = (recipe, text) => {
      S.put('meal', newMeal(date, meal, recipe, text, servings));
      App.closeSheet();
    };
    function list() {
      const all = App.recipes();
      const ql = q.trim().toLowerCase();
      let rs = all.filter(r => !ql || r.name.toLowerCase().includes(ql));
      const fit = rs.filter(r => (r.meals || []).includes(meal));
      if (!showAll && !ql) rs = fit;
      $('#rlist').innerHTML = rs.map(r => `<div class="item tap${slot && slot.recipe === r.id ? ' selected' : ''}" data-r="${r.id}"><div class="emoji">${esc(r.emoji)}</div>
          <div class="grow">${esc(r.name)}<div class="muted">${(r.meals || []).map(x => App.mealDef(x).name).join(' · ')}</div></div>${slot && slot.recipe === r.id ? '✓' : ''}</div>`).join('')
        + (!showAll && !ql && fit.length < all.length ? `<div class="item tap" id="showAll"><div class="emoji">…</div><div class="grow muted">Ver todas las recetas</div></div>` : '')
        + (!rs.length ? `<div class="muted" style="padding:10px 0">Sin resultados.</div>` : '');
      m.querySelectorAll('[data-r]').forEach(el => el.onclick = () => save(el.dataset.r, ''));
      const sa = $('#showAll'); if (sa) sa.onclick = () => { showAll = true; list(); };
    }
    const sv = () => { $('#sVal').textContent = servings; };
    $('#sMinus').onclick = () => { servings = Math.max(1, servings - 1); sv(); if (slot) S.put('meal', Object.assign({}, slot, { servings })); };
    $('#sPlus').onclick = () => { servings = Math.min(20, servings + 1); sv(); if (slot) S.put('meal', Object.assign({}, slot, { servings })); };
    $('#q').oninput = ev => { q = ev.target.value; list(); };
    m.querySelectorAll('[data-text]').forEach(b => b.onclick = () => save(null, b.dataset.text));
    $('#useFree').onclick = () => { const t = $('#free').value.trim(); if (t) save(null, t); };
    $('#cancel').onclick = App.closeSheet;
    $('#newR').onclick = () => openRecipe(null, { meals: [meal], onSaved: r => save(r.id, '') });
    if ($('#clear')) $('#clear').onclick = () => { App.closeSheet(); App.removeWithUndo('meal', slot, 'Comida quitada'); };
    if ($('#done')) $('#done').onclick = () => {
      const cur = S.get(slot.id) || slot;
      S.put('meal', Object.assign({}, cur, { doneAt: cur.doneAt ? null : Date.now(), skip: false }));
      App.closeSheet(); App.toast(cur.doneAt ? 'Se descontará al acabar el día' : 'Hecha: descontada de la despensa');
    };
    if ($('#skip')) $('#skip').onclick = () => {
      const cur = S.get(slot.id) || slot;
      S.put('meal', Object.assign({}, cur, { skip: !cur.skip, doneAt: null }));
      App.closeSheet(); App.toast(cur.skip ? 'Se descontará al acabar el día' : 'No se descontará de la despensa');
    };
    sv(); list();
  }

  // ---------- Lista de la compra a partir de comidas ----------
  // Sirve para el menú de la semana y para comidas elegidas en el apartado Comidas.
  function openMenuToList() {
    const today = App.today();
    const inWeek = week <= today && today <= App.addDays(week, 6);
    openNeedsToList({
      title: '🛒 Lista desde el menú',
      scopes: [['week', 'Toda la semana'], ['fromToday', 'Desde hoy']],
      scope: inWeek ? 'fromToday' : 'week',
      getMeals: scope => weekMeals(week).filter(m => scope === 'week' || m.date >= today),
      menuWeek: week
    });
  }

  function openNeedsToList(opts) {
    const store = App.currentStore(), pById = App.productsById(), rById = App.recipesById();
    let scope = opts.scope;
    const listItems = App.shopItems().filter(i => !i.checked);
    let lines = [], picked = {};

    const pan = App.pantry();
    function compute() {
      const need = SL.menuNeeds(opts.getMeals(scope), rById);
      // Solo se compra lo que falta: lo que pide el menú menos lo que hay en casa.
      lines = Object.entries(need).map(([pid, amount]) => {
        const have = pan[pid] ? pan[pid].qty : 0;
        return { product: pById[pid], need: amount, have, tracked: !!pan[pid], amount: Math.max(0, Math.round((amount - have) * 100) / 100) };
      })
        .filter(l => l.product)
        .sort((a, b) => App.section(a.product.section).order - App.section(b.product.section).order || a.product.name.localeCompare(b.product.name, 'es'));
      picked = {};
      lines.forEach(l => { picked[l.product.id] = l.amount > 0 && !(l.product.staple && !l.tracked); });
    }

    const m = App.sheet(`<h3>${esc(opts.title)}</h3>
      <div class="muted">Marca lo que necesitas comprar. Se descuenta lo que ya hay en la despensa; lo básico (aceite, sal…) que no controláis sale desmarcado.</div>
      ${opts.scopes ? `<div class="seg" style="margin-top:10px">${opts.scopes.map(([id, n]) => `<button data-scope="${id}">${n}</button>`).join('')}</div>` : ''}
      <div id="lines" class="list" style="margin-top:8px"></div>
      <div class="totalbar"><div class="grow"><b id="tot"></b><div class="muted" id="totsub"></div></div><button class="primary" id="add">Añadir</button></div>
      <div class="actions"><button id="cancel">Cancelar</button></div>`, { stack: !!opts.stack });
    const $ = s => m.querySelector(s);

    function draw() {
      m.querySelectorAll('[data-scope]').forEach(b => b.classList.toggle('on', b.dataset.scope === scope));
      let lastSec = null, h = '';
      lines.forEach(l => {
        const p = l.product, sec = App.section(p.section);
        if (sec.id !== lastSec) { h += `<div class="sechdr">${esc(sec.emoji)} ${esc(sec.name)}</div>`; lastSec = sec.id; }
        const cost = store && l.amount ? SL.lineCost({ amount: l.amount }, p, store) : l.amount ? null : 0;
        const inList = listItems.find(i => i.product === p.id);
        const buy = !l.amount ? '' : p.bulk ? '' : ` · compras ${SL.packsFor(p, l.amount)} ud`;
        const home = l.tracked ? (l.amount ? ` · en casa ${esc(SL.fmtAmount(p.unit, l.have))}, faltan ${esc(SL.fmtAmount(p.unit, l.amount))}` : ' · <span class="pos">ya lo tenéis en casa</span>') : '';
        h += `<label class="item check"><input type="checkbox" data-p="${p.id}" ${picked[p.id] ? 'checked' : ''} ${l.amount ? '' : 'disabled'}>
          <div class="grow"><div class="ellipsis">${esc(p.name)}</div>
          <div class="muted">el menú pide ${esc(SL.fmtAmount(p.unit, l.need))}${home}${buy}${p.staple && !l.tracked ? ' · <span class="badge">despensa</span>' : ''}${inList ? ' · <span class="badge">ya en la lista</span>' : ''}</div></div>
          <div class="amount">${cost != null ? App.euros(cost) : '—'}</div></label>`;
      });
      $('#lines').innerHTML = h || '<div class="muted" style="padding:12px 0">No hay comidas con ingredientes en este periodo.</div>';
      m.querySelectorAll('[data-p]').forEach(cb => cb.onchange = () => { picked[cb.dataset.p] = cb.checked; totals(); });
      totals();
    }
    function totals() {
      const sel = lines.filter(l => picked[l.product.id] && l.amount > 0);
      const sum = sel.reduce((a, l) => a + (store ? SL.lineCost({ amount: l.amount }, l.product, store) || 0 : 0), 0);
      $('#tot').textContent = `${sel.length} producto${sel.length === 1 ? '' : 's'} · ${App.euros(sum)}`;
      $('#totsub').textContent = store ? `Precios de ${store.name}` : '';
      $('#add').disabled = !sel.length;
    }
    m.querySelectorAll('[data-scope]').forEach(b => b.onclick = () => { scope = b.dataset.scope; compute(); draw(); });
    $('#cancel').onclick = App.closeSheet;
    $('#add').onclick = () => {
      const changes = [];
      lines.filter(l => picked[l.product.id] && l.amount > 0).forEach(l => {
        const ex = listItems.find(i => i.product === l.product.id);
        if (ex) {
          // Si ya venía de este mismo menú, se sustituye la cantidad en lugar de sumarla.
          const amount = opts.menuWeek && ex.menuWeek === opts.menuWeek ? l.amount : ex.amount + l.amount;
          changes.push({ kind: 'shopitem', data: Object.assign({}, ex, { amount, menuWeek: opts.menuWeek || ex.menuWeek }) });
        } else {
          changes.push({ kind: 'shopitem', data: { id: 'i-' + App.uid() + changes.length, product: l.product.id, name: l.product.name, section: l.product.section,
            amount: l.amount, checked: false, source: 'menu', menuWeek: opts.menuWeek || null, addedAt: Date.now() } });
        }
      });
      S.putMany(changes);
      App.closeAllSheets();
      if (opts.onDone) opts.onDone();
      App.toast(`Añadidos ${changes.length} productos a la lista`);
      App.go('shop', 'list');
    };
    compute(); draw();
  }

  // ---------- Comidas ----------
  // Cada comida tiene sus ingredientes para 1 persona. Se pueden elegir varias
  // para meterlas en el menú de la semana o pasar sus ingredientes a la lista.
  // partial = solo redibuja los resultados (al escribir en el buscador no se toca el campo).
  function renderRecipes(partial) {
    const view = App.view, store = App.habitualStore(), pById = App.productsById();
    const ql = recipeQuery.trim().toLowerCase();
    const rs = App.recipes().filter(r => (!ql || r.name.toLowerCase().includes(ql)) && (!recipeMeal || (r.meals || []).includes(recipeMeal)));
    const nSel = Object.keys(selected).filter(id => S.get(id)).length;
    let h = `<input id="rq" placeholder="🔍 Buscar receta" value="${esc(recipeQuery)}">
      <div class="chips scroll-x" style="margin-top:8px"><button data-rm="" class="${!recipeMeal ? 'on' : ''}">Todas</button>
      ${C.MEALS.map(x => `<button data-rm="${x.id}" class="${recipeMeal === x.id ? 'on' : ''}">${x.emoji} ${x.name}</button>`).join('')}</div>`;
    const head = h; h = '';
    h += selecting
      ? `<div class="note row"><div class="grow">Toca las recetas que quieres. <b>${nSel}</b> elegida${nSel === 1 ? '' : 's'}.</div><button class="small" id="selCancel">Cancelar</button></div>`
      : `<div class="row" style="margin-top:8px"><div class="grow muted">${rs.length} receta${rs.length === 1 ? '' : 's'}${store ? ` · coste por persona en ${esc(store.name)}` : ''}</div>
         <button class="small ghost" id="selStart">☑️ Elegir varias</button></div>`;
    h += rs.length ? `<div class="card list">${rs.map(r => {
      const cost = store ? recipeCost(r, store, pById) : 0;
      const on = !!selected[r.id];
      return `<div class="item tap${on ? ' selected' : ''}" data-r="${r.id}">${selecting ? `<span class="chk${on ? ' on' : ''}">${on ? '✓' : ''}</span>` : ''}
        <div class="emoji">${esc(r.emoji)}</div><div class="grow"><div class="ellipsis"><b>${esc(r.name)}</b></div>
        <div class="muted ellipsis">${(r.meals || []).map(x => App.mealDef(x).name).join(' · ')} · ${(r.ingredients || []).length} ingredientes${(() => { const k = nutOf(r, pById).nut.kcal; return k ? ` · <b>${App.fmtN(k, 'kcal')} kcal</b>` : ''; })()}</div></div>
        <div class="amount">${cost ? App.euros(cost) : ''}<div class="muted">${cost ? '/persona' : ''}</div></div></div>`;
    }).join('')}</div>` : `<div class="card empty">No hay recetas${ql || recipeMeal ? ' con estos filtros' : ''}. Pulsa <b>+</b> para crear una.</div>`;
    if (selecting && nSel) {
      h += `<div style="height:64px"></div><div class="selbar"><div class="grow"><b>${nSel}</b> receta${nSel === 1 ? '' : 's'}</div>
        <button class="small" id="selToMenu">📅 Al menú</button><button class="small primary" id="selToList">🛒 A la lista</button></div>`;
    }
    const $ = x => view.querySelector(x);
    if (partial) { if (!$('#rbody')) return; $('#rbody').innerHTML = h; }
    else {
      view.innerHTML = head + `<div id="rbody">${h}</div>`;
      const rq = $('#rq');
      rq.setAttribute('type', 'search'); rq.setAttribute('autocomplete', 'off'); rq.classList.add('search');
      rq.oninput = () => { recipeQuery = rq.value; clearTimeout(rq._t); rq._t = setTimeout(() => renderRecipes(true), 120); };
      view.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { recipeMeal = b.dataset.rm; App.render(); });
    }
    view.querySelectorAll('[data-r]').forEach(el => el.onclick = () => {
      if (!selecting) { openRecipeCard(S.get(el.dataset.r)); return; }
      const id = el.dataset.r;
      if (selected[id]) delete selected[id]; else selected[id] = App.defaultServings();
      App.render();
    });
    if ($('#selStart')) $('#selStart').onclick = () => { selecting = true; selected = {}; App.render(); };
    if ($('#selCancel')) $('#selCancel').onclick = () => { selecting = false; selected = {}; App.render(); };
    if ($('#selToMenu')) $('#selToMenu').onclick = () => openAddToMenu();
    if ($('#selToList')) $('#selToList').onclick = openSelectedToList;
  }

  const selectedRecipes = () => Object.keys(selected).map(id => S.get(id)).filter(Boolean);
  const endSelection = () => { selecting = false; selected = {}; };

  // Reparte las comidas elegidas en los huecos libres de la semana (se puede cambiar cada una).
  function openAddToMenu(only, onlyServings) {
    const rs = only ? [only] : selectedRecipes();
    const enabled = App.enabledMeals();
    const thisW = App.mondayOf(App.today());
    let target = week < thisW ? thisW : week;
    let servings = onlyServings || App.defaultServings();
    let assign = {};

    const freeSlots = w => {
      const out = [];
      const today = App.today();
      weekDates(w).forEach((d, i) => enabled.forEach(meal => {
        // Solo días de hoy en adelante: no tiene sentido planificar el pasado.
        if (d >= today && !S.get(mealId(d, meal.id))) out.push({ key: d + '|' + meal.id, d, meal, label: `${DAY_NAMES[i]} · ${meal.emoji} ${meal.name}` });
      }));
      return out;
    };
    function autoAssign() {
      const free = freeSlots(target), used = new Set();
      assign = {};
      rs.forEach(r => {
        // Primero un hueco de una comida que le encaje; si no hay, cualquiera libre (salvo desayuno).
        let slot = null;
        for (const mealType of (r.meals || [])) { slot = free.find(f => f.meal.id === mealType && !used.has(f.key)); if (slot) break; }
        if (!slot) slot = free.find(f => !used.has(f.key) && f.meal.id !== 'desayuno');
        if (slot) { used.add(slot.key); assign[r.id] = slot.key; } else assign[r.id] = '';
      });
    }
    // Si a esta semana le quedan menos huecos que comidas elegidas, propone la siguiente.
    if (target === thisW && freeSlots(thisW).length < rs.length) target = App.addDays(thisW, 7);
    const m = App.sheet(`<h3>📅 Añadir al menú</h3>
      <div class="muted">Se colocan en huecos libres. Cambia el día de cualquiera si quieres.</div>
      <div class="seg" style="margin-top:10px"><button data-w="this">Esta semana</button><button data-w="next">La próxima</button></div>
      <div class="row" style="margin-top:10px"><span class="grow muted">Personas que comen</span>
        <button class="qbtn" id="sMinus">−</button><b id="sVal" class="qval"></b><button class="qbtn" id="sPlus">+</button></div>
      <div class="list" id="assign" style="margin-top:6px"></div>
      <div class="actions"><button id="cancel">Cancelar</button><button class="primary" id="ok">Añadir al menú</button></div>`);
    const $ = x => m.querySelector(x);
    function draw() {
      m.querySelectorAll('[data-w]').forEach(b => b.classList.toggle('on', (b.dataset.w === 'this') === (target === thisW)));
      $('#sVal').textContent = servings;
      const free = freeSlots(target);
      $('#assign').innerHTML = rs.map(r => `<div class="item"><div class="emoji">${esc(r.emoji)}</div><div class="grow"><div class="ellipsis">${esc(r.name)}</div>
        <select data-as="${r.id}" style="margin-top:4px">${free.map(f => `<option value="${f.key}" ${assign[r.id] === f.key ? 'selected' : ''}>${esc(f.label)}</option>`).join('')}
        <option value="" ${!assign[r.id] ? 'selected' : ''}>— No añadir —</option></select></div></div>`).join('')
        + (!free.length ? '<div class="muted" style="padding:8px 0">Esta semana no tiene huecos libres.</div>' : '');
      m.querySelectorAll('[data-as]').forEach(sel => sel.onchange = () => { assign[sel.dataset.as] = sel.value; });
    }
    m.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { target = b.dataset.w === 'this' ? thisW : App.addDays(thisW, 7); autoAssign(); draw(); });
    $('#sMinus').onclick = () => { servings = Math.max(1, servings - 1); draw(); };
    $('#sPlus').onclick = () => { servings = Math.min(20, servings + 1); draw(); };
    $('#cancel').onclick = App.closeSheet;
    $('#ok').onclick = () => {
      const keys = Object.values(assign).filter(Boolean);
      if (new Set(keys).size !== keys.length) { App.toast('Hay dos comidas en el mismo hueco'); return; }
      const changes = rs.filter(r => assign[r.id]).map(r => {
        const [d, meal] = assign[r.id].split('|');
        return { kind: 'meal', data: newMeal(d, meal, r.id, '', servings) };
      });
      if (!changes.length) { App.toast('No hay nada que añadir'); return; }
      S.putMany(changes);
      endSelection(); week = target;
      App.closeSheet();
      App.toast(`Añadidas ${changes.length} comidas al menú`);
      App.go('menu', 'week');
    };
    autoAssign(); draw();
  }

  // Ingredientes de las comidas elegidas → lista, eligiendo cuántas personas comen cada una.
  function openSelectedToList() {
    const rs = selectedRecipes();
    const m = App.sheet(`<h3>🛒 Recetas a la lista</h3>
      <div class="muted">¿Para cuántas personas es cada comida? Las cantidades de cada receta son por persona.</div>
      <div class="list" id="srv" style="margin-top:6px"></div>
      <div class="actions"><button id="cancel">Cancelar</button><button class="primary" id="ok">Ver ingredientes</button></div>`);
    const $ = x => m.querySelector(x);
    function draw() {
      $('#srv').innerHTML = rs.map(r => `<div class="item"><div class="emoji">${esc(r.emoji)}</div><div class="grow ellipsis">${esc(r.name)}</div>
        <button class="qbtn" data-dn="${r.id}">−</button><b class="qval">${selected[r.id]}</b><button class="qbtn" data-up="${r.id}">+</button></div>`).join('');
      m.querySelectorAll('[data-dn]').forEach(b => b.onclick = () => { selected[b.dataset.dn] = Math.max(1, selected[b.dataset.dn] - 1); draw(); });
      m.querySelectorAll('[data-up]').forEach(b => b.onclick = () => { selected[b.dataset.up] = Math.min(40, selected[b.dataset.up] + 1); draw(); });
    }
    $('#cancel').onclick = App.closeSheet;
    $('#ok').onclick = () => openNeedsToList({
      title: '🛒 Lista desde recetas', stack: true,
      getMeals: () => rs.map(r => ({ recipe: r.id, servings: selected[r.id] })),
      onDone: endSelection
    });
    draw();
  }

  function openRecipe(existing, opts) {
    opts = opts || {};
    const isNew = !existing;
    const r = existing ? JSON.parse(JSON.stringify(existing))
      : { id: 'r-' + App.uid(), emoji: '🍽️', name: '', meals: opts.meals || ['comida', 'cena'], servings: 1, ingredients: [], notes: '' };
    const store = App.habitualStore();
    const m = App.sheet(`<h3>${isNew ? 'Nueva receta' : 'Editar receta'}</h3>
      <div class="row"><div style="width:76px"><label>Emoji</label><input id="em" value="${esc(r.emoji)}" maxlength="8" class="center"></div>
        <div class="grow"><label>Nombre</label><input id="nm" value="${esc(r.name)}" maxlength="60" autocomplete="off"></div></div>
      <label>Para</label><div class="chips" id="meals"></div>
      <label>Ingredientes para 1 persona</label><div class="list" id="ings"></div>
      <button class="small" id="addIng" style="margin-top:6px">＋ Añadir ingrediente</button>
      <div class="muted" id="cost" style="margin-top:8px"></div>
      <label>🥗 Nutrición por persona</label><div id="nut"></div>
      <label>Notas</label><textarea id="notes" rows="3" maxlength="1000" placeholder="Pasos, trucos…">${esc(r.notes || '')}</textarea>
      <div class="actions">${isNew ? '' : '<button class="danger" id="del">Eliminar</button>'}<button id="cancel">Cancelar</button><button class="primary" id="ok">Guardar</button></div>`, { stack: !!opts.onSaved });
    const $ = s => m.querySelector(s);
    function drawMeals() {
      $('#meals').innerHTML = C.MEALS.map(x => `<button data-meal="${x.id}" class="${r.meals.includes(x.id) ? 'on' : ''}">${x.emoji} ${x.name}</button>`).join('');
      m.querySelectorAll('[data-meal]').forEach(b => b.onclick = () => {
        const id = b.dataset.meal;
        r.meals = r.meals.includes(id) ? r.meals.filter(x => x !== id) : r.meals.concat(id);
        drawMeals();
      });
    }
    function drawIngs() {
      const pById = App.productsById();
      $('#ings').innerHTML = r.ingredients.map((ing, i) => {
        const p = pById[ing.product];
        return `<div class="item"><div class="grow ellipsis">${p ? esc(p.name) : '<span class="muted">Producto borrado</span>'}</div>
          <input type="text" inputmode="decimal" autocomplete="off" class="qty-input" data-q="${i}" value="${ing.qty}"><span class="unit">${p ? esc(p.unit) : ''}</span>
          <button class="xbtn" data-x="${i}" aria-label="Quitar">✕</button></div>`;
      }).join('') || '<div class="muted" style="padding:8px 0">Sin ingredientes todavía.</div>';
      m.querySelectorAll('[data-q]').forEach(inp => inp.oninput = () => { r.ingredients[+inp.dataset.q].qty = App.num(inp.value) || 0; drawCost(); });
      m.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { r.ingredients.splice(+b.dataset.x, 1); drawIngs(); });
      drawCost();
    }
    function drawCost() {
      const c = store ? recipeCost(r, store, App.productsById()) : 0;
      $('#cost').textContent = c ? `Coste aproximado por persona: ${App.euros(c)} (${store.name})` : '';
      $('#nut').innerHTML = nutHtml(r, App.productsById()) || '<div class="muted">Añade ingredientes para verla.</div>';
    }
    $('#addIng').onclick = () => App.pickProduct(p => {
      if (r.ingredients.some(x => x.product === p.id)) { App.toast('Ya está en esta comida'); return; }
      const qty = p.unit === 'ud' ? 1 : p.unit === 'ml' ? 100 : 100;
      r.ingredients.push({ product: p.id, qty });
      drawIngs();
    });
    $('#cancel').onclick = App.closeSheet;
    $('#ok').onclick = () => {
      r.name = $('#nm').value.trim(); r.emoji = $('#em').value.trim() || '🍽️'; r.notes = $('#notes').value.trim();
      if (!r.name) { App.toast('Ponle un nombre'); return; }
      if (!r.meals.length) { App.toast('Elige al menos una comida'); return; }
      r.ingredients = r.ingredients.filter(x => x.qty > 0);
      S.put('recipe', r);
      App.closeSheet();
      App.toast('Receta guardada');
      if (opts.onSaved) opts.onSaved(r);
      else openRecipeCard(r); // ficha con «Al menú» y «A la lista»
    };
    const del = $('#del');
    if (del) del.onclick = async () => {
      const uses = App.meals().filter(x => x.recipe === r.id && x.date >= App.today()).length;
      if (!await App.confirmDelete(uses ? `Esta receta está en ${uses} hueco(s) del menú, que quedarán vacíos. ¿Eliminarla?` : `¿Eliminar ${r.name}?`)) return;
      App.closeSheet();
      App.removeWithUndo('recipe', existing, 'Receta eliminada');
    };
    drawMeals(); drawIngs();
    if (isNew) setTimeout(() => $('#nm').focus(), 80);
  }

  // Ficha de una receta: ingredientes para N personas, coste y accesos directos
  // al menú de la semana y a la lista de la compra.
  // slotRef = [fecha, comida] cuando se abre desde un hueco del menú (permite cambiarla).
  function openRecipeCard(r, startServings, slotRef) {
    if (!r) return;
    let servings = startServings || App.defaultServings();
    const store = App.habitualStore();
    const m = App.sheet(`<div class="row"><div class="emoji" style="font-size:34px">${esc(r.emoji)}</div>
        <div class="grow"><h3 style="margin:0">${esc(r.name)}</h3><div class="muted">${(r.meals || []).map(x => App.mealDef(x).emoji + ' ' + App.mealDef(x).name).join(' · ')}</div></div></div>
      <div class="row" style="margin-top:12px"><span class="grow muted">Personas</span>
        <button class="qbtn" id="sMinus">−</button><b id="sVal" class="qval"></b><button class="qbtn" id="sPlus">+</button></div>
      <div class="section-label">Ingredientes</div><div class="list tight" id="ings"></div>
      <div class="muted" id="cost" style="margin-top:8px"></div>
      <div class="section-label">🥗 Nutrición por persona</div><div id="nut">${nutHtml(r, App.productsById()) || '<div class="muted">Sin ingredientes.</div>'}</div>
      ${r.notes ? `<div class="section-label">Notas</div><div class="note" style="white-space:pre-wrap">${esc(r.notes)}</div>` : ''}
      <div class="btnrow" style="margin-top:14px"><button class="primary" id="toMenu">📅 Al menú</button><button class="primary" id="toList">🛒 A la lista</button></div>
      <div class="actions">${slotRef ? '<button id="swap">🔁 Cambiar</button>' : ''}<button id="edit">✏️ Editar</button><button id="cancel">Cerrar</button></div>`);
    const $ = s => m.querySelector(s);
    function draw() {
      const pById = App.productsById();
      $('#sVal').textContent = servings;
      $('#ings').innerHTML = (r.ingredients || []).map(ing => {
        const p = pById[ing.product];
        return `<div class="item"><div class="emoji">${p ? esc(App.section(p.section).emoji) : '❔'}</div><div class="grow ellipsis">${p ? esc(p.name) : '<span class="muted">Producto borrado</span>'}</div>
          <div class="amount">${p ? esc(SL.fmtAmount(p.unit, ing.qty * servings / (r.servings || 1))) : ''}</div></div>`;
      }).join('') || '<div class="muted" style="padding:8px 0">Sin ingredientes. Pulsa Editar para añadirlos.</div>';
      const c = store ? recipeCost(r, store, pById) * servings : 0;
      $('#cost').textContent = c ? `≈ ${App.euros(c)} para ${servings} persona${servings === 1 ? '' : 's'} en ${store.name}` : '';
      $('#toList').disabled = !(r.ingredients || []).length;
    }
    $('#sMinus').onclick = () => { servings = Math.max(1, servings - 1); draw(); };
    $('#sPlus').onclick = () => { servings = Math.min(40, servings + 1); draw(); };
    $('#toMenu').onclick = () => openAddToMenu(r, servings);
    $('#toList').onclick = () => openNeedsToList({ title: `🛒 ${r.name} a la lista`, stack: true, getMeals: () => [{ recipe: r.id, servings }] });
    $('#edit').onclick = () => openRecipe(S.get(r.id) || r);
    if (slotRef) $('#swap').onclick = () => openSlot(slotRef[0], slotRef[1]);
    $('#cancel').onclick = App.closeSheet;
    draw();
  }

  App.modules.menu = { render, openRecipe, openSlot, openNeedsToList, openRecipeCard, recipeCost, mealId };
  App.modules.recipes = { render: renderRecipesModule, openRecipe, startPicking };
})();
