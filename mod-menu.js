// Módulo Menú: semana (plantillas, sugerencias, copiar semana) y recetas editables.
// Cada hueco (día + comida) es un dato propio para que los dos móviles puedan editar a la vez.
(function () {
  'use strict';
  const App = window.App, S = App.S, SL = App.SL, C = App.C;
  const esc = App.esc;
  let week = App.mondayOf(App.today());
  let recipeQuery = '', recipeMeal = '';

  const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const mealId = (date, meal) => `m-${date}-${meal}`;
  const weekDates = w => Array.from({ length: 7 }, (_, i) => App.addDays(w, i));
  const weekMeals = w => { const ds = weekDates(w); return App.meals().filter(m => ds.includes(m.date)); };
  const fmtShort = d => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

  function render(sub) {
    if (sub === 'recipes') { App.fabAction = () => openRecipe(); renderRecipes(); }
    else renderWeek();
  }

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
        <div class="section-label">Plantillas</div>
        <div class="chips">${C.MENU_TEMPLATES.map(t => `<button data-tpl="${t.id}">+ ${esc(t.emoji)} ${esc(t.name)}</button>`).join('')}</div>
        <div class="btnrow"><button class="ghost" id="fillRandom">🎲 Sugerir huecos</button><button class="ghost" id="copyPrev">⎘ Copiar semana anterior</button></div>
        ${planned.length ? `<button class="primary block" id="toList" style="margin-top:10px">🛒 Crear lista de la compra desde el menú</button>` : ''}
      </div>`;

    dates.forEach((d, i) => {
      h += `<div class="card day${d === today ? ' today' : ''}"><div class="dayhdr">${DAY_NAMES[i]} <span class="muted">${esc(fmtShort(d))}</span>${d === today ? ' <span class="pill pos">hoy</span>' : ''}</div>`;
      meals.forEach(meal => {
        const slot = S.get(mealId(d, meal.id));
        const r = slot && slot.recipe && rById[slot.recipe];
        const label = r ? `${esc(r.emoji)} ${esc(r.name)}` : slot && slot.text ? `📝 ${esc(slot.text)}` : '';
        const serv = slot && (slot.servings || 2) !== App.defaultServings() ? ` <span class="pill zero">${slot.servings} rac.</span>` : '';
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
    view.querySelectorAll('[data-tpl]').forEach(b => b.onclick = () => applyTemplate(C.MENU_TEMPLATES.find(t => t.id === b.dataset.tpl)));
    $('#fillRandom').onclick = fillRandom;
    $('#copyPrev').onclick = copyPrevWeek;
    if ($('#toList')) $('#toList').onclick = () => openMenuToList();
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
      <div class="row" style="margin-top:8px"><span class="grow muted">Raciones</span>
        <button class="qbtn" id="sMinus">−</button><b id="sVal" class="qval"></b><button class="qbtn" id="sPlus">+</button></div>
      <input id="q" placeholder="🔍 Buscar receta" autocomplete="off" style="margin-top:10px">
      <div class="chips" style="margin-top:8px">${['Fuera de casa', 'Sobras', 'Libre'].map(t => `<button data-text="${t}">${t}</button>`).join('')}</div>
      <div class="list" id="rlist" style="margin-top:6px"></div>
      <div class="row" style="margin-top:10px"><input id="free" placeholder="Otra cosa (texto libre)" class="grow" value="${esc(slot && slot.text ? slot.text : '')}"><button class="small" id="useFree">Usar</button></div>
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
    sv(); list();
  }

  // ---------- Lista de la compra desde el menú ----------
  function openMenuToList() {
    const store = App.currentStore(), pById = App.productsById(), rById = App.recipesById();
    const today = App.today();
    let scope = week <= today && today <= App.addDays(week, 6) ? 'fromToday' : 'week';
    const listItems = App.shopItems().filter(i => !i.checked);
    let lines = [], picked = {};

    function compute() {
      const ms = weekMeals(week).filter(m => scope === 'week' || m.date >= today);
      const need = SL.menuNeeds(ms, rById);
      lines = Object.entries(need).map(([pid, amount]) => ({ product: pById[pid], amount }))
        .filter(l => l.product)
        .sort((a, b) => App.section(a.product.section).order - App.section(b.product.section).order || a.product.name.localeCompare(b.product.name, 'es'));
      picked = {};
      lines.forEach(l => { picked[l.product.id] = !l.product.staple; });
    }

    const m = App.sheet(`<h3>🛒 Lista desde el menú</h3>
      <div class="muted">Marca lo que necesitas comprar. Lo de despensa sale desmarcado porque normalmente ya lo tenéis.</div>
      <div class="seg" style="margin-top:10px"><button data-scope="week">Toda la semana</button><button data-scope="fromToday">Desde hoy</button></div>
      <div id="lines" class="list" style="margin-top:8px"></div>
      <div class="totalbar"><div class="grow"><b id="tot"></b><div class="muted" id="totsub"></div></div><button class="primary" id="add">Añadir</button></div>
      <div class="actions"><button id="cancel">Cancelar</button></div>`);
    const $ = s => m.querySelector(s);

    function draw() {
      m.querySelectorAll('[data-scope]').forEach(b => b.classList.toggle('on', b.dataset.scope === scope));
      let lastSec = null, h = '';
      lines.forEach(l => {
        const p = l.product, sec = App.section(p.section);
        if (sec.id !== lastSec) { h += `<div class="sechdr">${esc(sec.emoji)} ${esc(sec.name)}</div>`; lastSec = sec.id; }
        const cost = store ? SL.lineCost({ amount: l.amount }, p, store) : null;
        const inList = listItems.find(i => i.product === p.id);
        const buy = p.bulk ? '' : ` · compras ${SL.packsFor(p, l.amount)} ud`;
        h += `<label class="item check"><input type="checkbox" data-p="${p.id}" ${picked[p.id] ? 'checked' : ''}>
          <div class="grow"><div class="ellipsis">${esc(p.name)}</div>
          <div class="muted">necesitas ${esc(SL.fmtAmount(p.unit, l.amount))}${buy}${p.staple ? ' · <span class="badge">despensa</span>' : ''}${inList ? ' · <span class="badge">ya en la lista</span>' : ''}</div></div>
          <div class="amount">${cost != null ? App.euros(cost) : '—'}</div></label>`;
      });
      $('#lines').innerHTML = h || '<div class="muted" style="padding:12px 0">No hay recetas con ingredientes en este periodo.</div>';
      m.querySelectorAll('[data-p]').forEach(cb => cb.onchange = () => { picked[cb.dataset.p] = cb.checked; totals(); });
      totals();
    }
    function totals() {
      const sel = lines.filter(l => picked[l.product.id]);
      const sum = sel.reduce((a, l) => a + (store ? SL.lineCost({ amount: l.amount }, l.product, store) || 0 : 0), 0);
      $('#tot').textContent = `${sel.length} producto${sel.length === 1 ? '' : 's'} · ${App.euros(sum)}`;
      $('#totsub').textContent = store ? `Precios de ${store.name}` : '';
      $('#add').disabled = !sel.length;
    }
    m.querySelectorAll('[data-scope]').forEach(b => b.onclick = () => { scope = b.dataset.scope; compute(); draw(); });
    $('#cancel').onclick = App.closeSheet;
    $('#add').onclick = () => {
      const changes = [];
      lines.filter(l => picked[l.product.id]).forEach(l => {
        const ex = listItems.find(i => i.product === l.product.id);
        if (ex) {
          // Si ya venía de este mismo menú, se sustituye la cantidad en lugar de sumarla.
          const amount = ex.menuWeek === week ? l.amount : ex.amount + l.amount;
          changes.push({ kind: 'shopitem', data: Object.assign({}, ex, { amount, menuWeek: week }) });
        } else {
          changes.push({ kind: 'shopitem', data: { id: 'i-' + App.uid(), product: l.product.id, name: l.product.name, section: l.product.section,
            amount: l.amount, checked: false, source: 'menu', menuWeek: week, addedAt: Date.now() } });
        }
      });
      S.putMany(changes);
      App.closeAllSheets();
      App.toast(`Añadidos ${changes.length} productos a la lista`);
      App.go('shop', 'list');
    };
    compute(); draw();
  }

  // ---------- Recetas ----------
  function renderRecipes() {
    const view = App.view, store = App.habitualStore(), pById = App.productsById();
    const ql = recipeQuery.trim().toLowerCase();
    const rs = App.recipes().filter(r => (!ql || r.name.toLowerCase().includes(ql)) && (!recipeMeal || (r.meals || []).includes(recipeMeal)));
    let h = `<input id="rq" placeholder="🔍 Buscar receta" value="${esc(recipeQuery)}">
      <div class="chips scroll-x" style="margin-top:8px"><button data-rm="" class="${!recipeMeal ? 'on' : ''}">Todas</button>
      ${C.MEALS.map(x => `<button data-rm="${x.id}" class="${recipeMeal === x.id ? 'on' : ''}">${x.emoji} ${x.name}</button>`).join('')}</div>
      <div class="muted" style="margin-top:8px">${rs.length} receta${rs.length === 1 ? '' : 's'}${store ? ` · coste por ración en ${esc(store.name)}` : ''}</div>`;
    h += rs.length ? `<div class="card list">${rs.map(r => {
      const cost = store ? recipeCost(r, store, pById) : 0;
      return `<div class="item tap" data-r="${r.id}"><div class="emoji">${esc(r.emoji)}</div><div class="grow"><div class="ellipsis"><b>${esc(r.name)}</b></div>
        <div class="muted ellipsis">${(r.meals || []).map(x => App.mealDef(x).name).join(' · ')} · ${(r.ingredients || []).length} ingredientes</div></div>
        <div class="amount">${cost ? App.euros(cost) : ''}</div></div>`;
    }).join('')}</div>` : `<div class="card empty">No hay recetas. Pulsa <b>+</b> para crear una.</div>`;
    view.innerHTML = h;
    const rq = view.querySelector('#rq');
    rq.oninput = () => {
      recipeQuery = rq.value; clearTimeout(rq._t);
      rq._t = setTimeout(() => { App.render(); const n = App.view.querySelector('#rq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 300);
    };
    view.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { recipeMeal = b.dataset.rm; App.render(); });
    view.querySelectorAll('[data-r]').forEach(el => el.onclick = () => openRecipe(S.get(el.dataset.r)));
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
      <label>Ingredientes por ración</label><div class="list" id="ings"></div>
      <button class="small" id="addIng" style="margin-top:6px">＋ Añadir ingrediente</button>
      <div class="muted" id="cost" style="margin-top:8px"></div>
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
          <input type="number" inputmode="decimal" step="any" min="0" class="qty-input" data-q="${i}" value="${ing.qty}"><span class="unit">${p ? esc(p.unit) : ''}</span>
          <button class="xbtn" data-x="${i}" aria-label="Quitar">✕</button></div>`;
      }).join('') || '<div class="muted" style="padding:8px 0">Sin ingredientes todavía.</div>';
      m.querySelectorAll('[data-q]').forEach(inp => inp.oninput = () => { r.ingredients[+inp.dataset.q].qty = App.num(inp.value) || 0; drawCost(); });
      m.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { r.ingredients.splice(+b.dataset.x, 1); drawIngs(); });
      drawCost();
    }
    function drawCost() {
      const c = store ? recipeCost(r, store, App.productsById()) : 0;
      $('#cost').textContent = c ? `Coste aproximado por ración: ${App.euros(c)} (${store.name})` : '';
    }
    $('#addIng').onclick = () => App.pickProduct(p => {
      if (r.ingredients.some(x => x.product === p.id)) { App.toast('Ya está en la receta'); return; }
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
    };
    const del = $('#del');
    if (del) del.onclick = async () => {
      const uses = App.meals().filter(x => x.recipe === r.id && x.date >= App.today()).length;
      if (!await App.confirmDelete(uses ? `Esta receta está en ${uses} comida(s) planificada(s); quedarán vacías. ¿Eliminarla?` : `¿Eliminar la receta ${r.name}?`)) return;
      App.closeSheet();
      App.removeWithUndo('recipe', existing, 'Receta eliminada');
    };
    drawMeals(); drawIngs();
    if (isNew) setTimeout(() => $('#nm').focus(), 80);
  }

  App.modules.menu = { render, openRecipe };
})();
