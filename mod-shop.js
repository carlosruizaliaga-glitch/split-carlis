// Módulo Compra: lista (estilo maleta), comparador de súpers, precios y ahorro.
(function () {
  'use strict';
  const App = window.App, S = App.S, SL = App.SL, C = App.C;
  const esc = App.esc, euros = App.euros;
  let compareScope = 'all', priceQuery = '', priceSection = '';
  let addQuery = '', tplOpen = false, essOpen = false;
  let pSel = null; // productos elegidos en «Elegir varios» (Set) o null

  function render(sub) {
    if (sub === 'compare') renderCompare();
    else if (sub === 'prices') { App.fabAction = pSel ? null : () => openProduct(); renderPrices(); }
    else if (sub === 'pantry') { App.fabAction = () => App.pickProduct(p => App.modules.pantry.openStock(p)); App.modules.pantry.render(); }
    else if (sub === 'savings') renderSavings();
    else { App.fabAction = () => App.pickProduct(p => addProduct(p)); renderList(); }
  }

  const sortItems = (a, b) => App.section(a.section).order - App.section(b.section).order || (a.checked - b.checked) || a.name.localeCompare(b.name, 'es');
  const itemCost = (it, pById, store) => SL.lineCost(it, it.product ? pById[it.product] : null, store);

  function defaultAmount(p) {
    if (p.bulk) return p.unit === 'ud' ? 1 : 500;
    return p.pack;
  }

  // Añade un producto a la lista; si ya está pendiente, suma un paso.
  function addProduct(p, amount) {
    const ex = App.shopItems().find(i => i.product === p.id && !i.checked);
    if (ex) {
      const na = amount || (p.bulk ? ex.amount + SL.stepFor(p) : (SL.packsFor(p, ex.amount) + 1) * p.pack);
      S.put('shopitem', Object.assign({}, ex, { amount: na }));
      App.toast(`${p.name}: ahora ${qtyLabel(p, na)}`);
      return;
    }
    S.put('shopitem', { id: 'i-' + App.uid(), product: p.id, name: p.name, section: p.section, amount: amount || defaultAmount(p), checked: false, source: 'manual', addedAt: Date.now() });
    App.toast(`Añadido: ${p.name}`);
  }

  function qtyLabel(p, amount) {
    if (!p) return `${amount} ud`;
    if (p.bulk) return SL.fmtAmount(p.unit, amount);
    const packs = SL.packsFor(p, amount);
    return `${packs} ud`;
  }

  // ---------- Lista ----------
  function renderList() {
    const view = App.view, store = App.currentStore(), pById = App.productsById();
    const items = App.shopItems().sort(sortItems);
    const checked = items.filter(i => i.checked);
    const total = items.reduce((a, i) => a + (itemCost(i, pById, store) || 0), 0);
    const inCart = checked.reduce((a, i) => a + (itemCost(i, pById, store) || 0), 0);

    const so = App.modules.chores && App.modules.chores.shopOccThisWeek();
    let h = `${so ? `<div class="alert ${so.doneAt ? 'ok' : ''} tap" id="shopTask" style="margin-top:4px">${App.avatar(App.person(so.doneAt ? so.doneBy || so.who : so.who), 1)}
        <div class="grow">${so.doneAt ? `<b>Compra de la semana hecha</b> por ${esc(App.person(so.doneBy || so.who).name)}` : `La compra de esta semana le toca a <b>${esc(App.person(so.who).name)}</b>`}
        <div class="muted">Tarea del hogar · +${so.w || 1} pts · se marca sola al terminar la compra</div></div><span class="muted">›</span></div>` : ''}
    <div class="card">
      <div class="section-label" style="margin-top:0">Comprando en</div>
      <div class="chips scroll-x">${App.stores().map(s => `<button data-store="${s.id}" class="${store && s.id === store.id ? 'on' : ''}">${App.storeDot(s)} ${esc(s.name)}</button>`).join('')}</div>
      <div class="row" style="margin-top:10px"><div class="grow"><b>${checked.length}/${items.length}</b> en el carro</div>
        <div><b>${euros(inCart)}</b> <span class="muted">de ${euros(total)}</span></div></div>
      <div class="bar"><span style="width:${items.length ? checked.length / items.length * 100 : 0}%"></span></div>
      <div class="btnrow" style="margin-top:10px"><button class="ghost" id="fromMenu">📅 Desde el menú</button><button class="ghost" id="fromRecipes">🍳 Desde recetas</button></div>
      ${items.length && !tplOpen ? `<button class="ghost block small" id="tplToggle">＋ Plantillas y repetir compra</button>` : `
      <div class="section-label">Plantillas</div>
      <div class="chips">${App.shopTemplates().map(t => `<button data-tpl="${t.id}">+ ${esc(t.emoji)} ${esc(t.name)}</button>`).join('')}</div>
      <div class="btnrow"><button class="ghost" id="repeat">⎘ Repetir una compra</button>${items.length ? '<button class="ghost" id="saveTpl">💾 Guardar como plantilla</button>' : ''}</div>
      ${items.length ? '<button class="ghost block small" id="tplToggle">Ocultar plantillas</button>' : ''}`}
    </div>
    ${essentialsCard()}
    <div class="addbox"><input id="addq" class="search" type="search" enterkeyhint="done" placeholder="＋ Añadir producto…" autocomplete="off" value="${esc(addQuery)}"><div id="sugg" class="sugg"></div></div>`;

    if (!items.length) {
      h += `<div class="card empty">🛒 La lista está vacía.<br>Añade productos, usa una plantilla o créala desde el menú.</div>`;
    } else {
      let lastSec = null;
      const secCount = {};
      items.forEach(i => { const k = i.section || 'otros'; secCount[k] = secCount[k] || [0, 0]; secCount[k][1]++; if (i.checked) secCount[k][0]++; });
      items.forEach(it => {
        const sec = App.section(it.section);
        if (sec.id !== lastSec) {
          if (lastSec !== null) h += `</div>`;
          h += `<div class="sechdr">${esc(sec.emoji)} ${esc(sec.name)} <span class="muted">${secCount[sec.id][0]}/${secCount[sec.id][1]}</span></div><div class="card list tight">`;
          lastSec = sec.id;
        }
        const p = it.product ? pById[it.product] : null;
        const info = p && store ? SL.priceInfo(p, store) : null;
        const cost = itemCost(it, pById, store);
        let sub = '';
        if (p) {
          sub = p.bulk ? `${SL.fmtAmount(p.unit, it.amount)}${info ? ` · ${euros(info.p)}/${p.unit === 'ml' ? 'l' : p.unit === 'g' ? 'kg' : 'ud'}` : ''}`
            : `${info ? `${euros(info.p)}/ud` : 'sin precio'}${it.source === 'menu' && it.amount % p.pack ? ` · necesitas ${SL.fmtAmount(p.unit, it.amount)}` : ''}`;
          if (info) sub += ' ' + App.srcBadge(info.src);
        } else sub = it.price > 0 ? `${euros(it.price)}/ud` : 'sin precio';
        if (it.note) sub += ` · ${esc(it.note)}`;
        h += `<div class="item shop${it.checked ? ' done' : ''}">
          <button class="chk${it.checked ? ' on' : ''}" data-chk="${it.id}" aria-label="Marcar">${it.checked ? '✓' : ''}</button>
          <div class="grow">
            <div class="row"><div class="grow nm tap" data-item="${it.id}">${esc(it.name)}</div><div class="amount cost">${cost != null ? euros(cost) : '—'}</div>
              <button class="xbtn" data-del="${it.id}" aria-label="Quitar de la lista">✕</button></div>
            <div class="row"><div class="grow muted ellipsis tap" data-item="${it.id}">${sub}</div>
              <button class="qbtn" data-minus="${it.id}" aria-label="Menos">−</button><span class="qval">${esc(p ? (p.bulk ? SL.fmtAmount(p.unit, it.amount) : SL.packsFor(p, it.amount)) : it.amount)}</span><button class="qbtn" data-plus="${it.id}" aria-label="Más">+</button></div>
          </div></div>`;
      });
      h += `</div>`;
      h += listNutCard(items, pById);
      if (checked.length) h += `<button class="primary block big-btn" id="finish">✅ Terminar compra · ${checked.length} producto${checked.length === 1 ? '' : 's'} · ${euros(inCart)}</button>`;
      h += `<div class="btnrow"><button class="ghost small" id="uncheck">Desmarcar todo</button><button class="danger small" id="clearList">Vaciar lista</button></div>`;
    }
    view.innerHTML = h;
    const $ = s => view.querySelector(s);
    view.querySelectorAll('[data-store]').forEach(b => b.onclick = () => { App.setCurrentStore(b.dataset.store); App.render(); });
    view.querySelectorAll('[data-tpl]').forEach(b => b.onclick = () => applyTemplate(App.shopTemplates().find(t => t.id === b.dataset.tpl)));
    if ($('#fromMenu')) $('#fromMenu').onclick = () => App.go('menu', 'week');
    if ($('#fromRecipes')) $('#fromRecipes').onclick = () => App.modules.recipes.startPicking();
    if ($('#repeat')) $('#repeat').onclick = openRepeat;
    if ($('#shopTask')) $('#shopTask').onclick = () => App.modules.chores.openOcc(so);
    if ($('#saveTpl')) $('#saveTpl').onclick = () => App.edit.saveListAsTemplate();
    if ($('#tplToggle')) $('#tplToggle').onclick = () => { tplOpen = !tplOpen; App.render(); };
    view.querySelectorAll('[data-chk]').forEach(b => b.onclick = () => {
      const it = S.get(b.dataset.chk); if (it) S.put('shopitem', Object.assign({}, it, { checked: !it.checked }));
    });
    view.querySelectorAll('[data-item]').forEach(el => el.onclick = () => openItem(S.get(el.dataset.item)));
    view.querySelectorAll('[data-minus]').forEach(b => b.onclick = () => changeQty(S.get(b.dataset.minus), -1));
    view.querySelectorAll('[data-plus]').forEach(b => b.onclick = () => changeQty(S.get(b.dataset.plus), +1));
    view.querySelectorAll('[data-del]').forEach(b => b.onclick = () => removeItem(S.get(b.dataset.del)));
    if ($('#finish')) $('#finish').onclick = openFinish;
    if ($('#uncheck')) $('#uncheck').onclick = () => S.putMany(App.shopItems().filter(i => i.checked).map(i => ({ kind: 'shopitem', data: Object.assign({}, i, { checked: false }) })));
    if ($('#clearList')) $('#clearList').onclick = async () => {
      const all = App.shopItems();
      if (!await App.confirmDelete(`¿Vaciar la lista (${all.length} productos)?`)) return;
      S.putMany(all.map(i => ({ kind: 'shopitem', data: i, deleted: true })));
      App.toast('Lista vaciada', { undo: () => S.putMany(all.map(i => ({ kind: 'shopitem', data: i }))) });
    };
    bindEssentials();
    setupAddBox();
  }

  // Cuadro de añadir con sugerencias del catálogo mientras escribes.
  function setupAddBox() {
    const inp = App.view.querySelector('#addq'), box = App.view.querySelector('#sugg');
    const draw = () => {
      const q = inp.value.trim().toLowerCase();
      addQuery = inp.value;
      if (!q) { box.innerHTML = ''; return; }
      const ps = App.products().filter(p => p.name.toLowerCase().includes(q))
        .sort((a, b) => (a.name.toLowerCase().startsWith(q) ? 0 : 1) - (b.name.toLowerCase().startsWith(q) ? 0 : 1)).slice(0, 6);
      box.innerHTML = ps.map(p => `<div class="sitem" data-sp="${p.id}">${esc(App.section(p.section).emoji)} ${esc(p.name)}</div>`).join('')
        + `<div class="sitem new" data-new>＋ Crear «${esc(inp.value.trim())}»</div>`;
      // Se vacía el campo antes de añadir: el teclado sigue abierto para el siguiente producto.
      box.querySelectorAll('[data-sp]').forEach(el => el.onclick = () => { addQuery = ''; inp.value = ''; box.innerHTML = ''; addProduct(S.get(el.dataset.sp)); });
      box.querySelector('[data-new]').onclick = () => { const name = inp.value.trim(); addQuery = ''; openProduct(null, { name, onSaved: p => addProduct(p) }); };
    };
    inp.oninput = draw;
    inp.onkeydown = ev => {
      if (ev.key !== 'Enter') return;
      const first = box.querySelector('.sitem'); if (first) first.click();
    };
    if (addQuery) { draw(); inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  }

  function removeItem(it) {
    if (!it) return;
    App.removeWithUndo('shopitem', it, `Quitado: ${it.name}`);
  }

  function changeQty(it, dir) {
    if (!it) return;
    const p = it.product ? S.get(it.product) : null;
    // "−" con la cantidad mínima: se quita de la lista (con opción de deshacer).
    const atMin = !p ? (it.amount || 1) <= 1 : p.bulk ? it.amount <= SL.stepFor(p) : SL.packsFor(p, it.amount) <= 1;
    if (dir < 0 && atMin) { removeItem(it); return; }
    let na;
    if (!p) na = Math.max(1, (it.amount || 1) + dir);
    else if (p.bulk) na = Math.max(SL.stepFor(p), Math.round((it.amount + dir * SL.stepFor(p)) * 100) / 100);
    else na = Math.max(1, SL.packsFor(p, it.amount) + dir) * p.pack;
    if (na !== it.amount) S.put('shopitem', Object.assign({}, it, { amount: na }));
  }

  // Como las plantillas de la maleta: sin duplicados.
  function applyTemplate(tpl) {
    const have = new Set(App.shopItems().filter(i => !i.checked).map(i => i.product));
    const changes = [];
    tpl.items.forEach(([pid, amount]) => {
      const p = S.get(pid);
      if (!p || have.has(pid)) return;
      have.add(pid);
      changes.push({ kind: 'shopitem', data: { id: 'i-' + App.uid() + changes.length, product: p.id, name: p.name, section: p.section, amount, checked: false, source: 'template', addedAt: Date.now() } });
    });
    S.putMany(changes);
    App.toast(changes.length ? `Añadidos ${changes.length} productos` : 'Ya tenías todo en la lista');
  }

  function openRepeat() {
    const ps = App.purchases().slice(0, 15);
    if (!ps.length) { App.toast('Aún no hay compras anteriores'); return; }
    const m = App.sheet(`<h3>⎘ Repetir una compra</h3><div class="muted">Añade a la lista lo que comprasteis (sin duplicar lo que ya está).</div>
      <div class="list" style="margin-top:8px">${ps.map(p => `<div class="item tap" data-pu="${p.id}">${App.storeDot(S.get(p.store) || {})}<div class="grow">${esc(App.fmtDate(p.date))} · ${esc((S.get(p.store) || { name: '¿?' }).name)}
        <div class="muted">${(p.items || []).length} productos</div></div><div class="amount">${euros(p.total)}</div></div>`).join('')}</div>
      <div class="actions"><button id="cancel">Cerrar</button></div>`);
    m.querySelector('#cancel').onclick = App.closeSheet;
    m.querySelectorAll('[data-pu]').forEach(el => el.onclick = () => {
      const pu = S.get(el.dataset.pu);
      const have = new Set(App.shopItems().filter(i => !i.checked).map(i => i.product || i.name));
      const changes = [];
      (pu.items || []).forEach(x => {
        const key = x.product || x.name;
        if (have.has(key)) return;
        const p = x.product ? S.get(x.product) : null;
        if (x.product && !p) return;
        have.add(key);
        changes.push({ kind: 'shopitem', data: { id: 'i-' + App.uid() + changes.length, product: x.product || null, name: p ? p.name : x.name,
          section: p ? p.section : (x.section || 'otros'), amount: x.amount, price: x.product ? undefined : x.price, checked: false, source: 'repeat', addedAt: Date.now() } });
      });
      S.putMany(changes);
      App.closeSheet();
      App.toast(changes.length ? `Añadidos ${changes.length} productos` : 'Ya tenías todo en la lista');
    });
  }

  // ---------- Nutrición ----------
  const NUT_FIELDS = [['kcal', 'Energía (kcal)'], ['p', 'Proteínas (g)'], ['hc', 'Hidratos (g)'], ['g', 'Grasas (g)'], ['fib', 'Fibra (g)'], ['sal', 'Sal (g)']];
  const NON_FOOD = ['limpieza', 'higiene', 'mascota'];
  // Lo que aporta la comida de la lista, repartido entre las personas que coméis.
  function listNutCard(items, pById) {
    const tot = SL.emptyNut(); let n = 0, without = 0;
    items.forEach(it => {
      const p = it.product && pById[it.product];
      if (!p || NON_FOOD.includes(p.section)) return;
      const v = SL.nutFor(p, it.amount);
      if (v) { SL.addNut(tot, v); n++; } else without++;
    });
    if (!n) return '';
    const ppl = App.defaultServings(), per = SL.addNut(SL.emptyNut(), tot, 1 / ppl);
    return `<details class="card"><summary class="row" style="cursor:pointer"><div class="emoji">🥗</div><div class="grow"><b>Nutrición de la lista</b>
      <div class="muted">≈ ${App.kcal(per)} por persona (${ppl} personas) · ${App.fmtN(per.p)} g proteínas</div></div><span class="muted">▾</span></summary>
      <div class="section-label">Por persona</div>${App.nutGrid(per, { noRI: true })}
      <div class="muted" style="margin-top:8px">Suma de ${n} alimento${n === 1 ? '' : 's'} de la lista dividida entre ${ppl}.${without ? ` ${without} sin datos no se cuentan.` : ''} Equivale a ${(per.kcal / 2000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} días de 2.000 kcal.</div></details>`;
  }

  // ---------- Esenciales ----------
  // Lo que se compra aunque no esté en el menú (leche, café, sal, limpieza…).
  // Cada uno tiene una frecuencia; "toca reponer" si hace más días que eso desde la última compra.
  function lastBought() {
    const m = {};
    App.purchases().forEach(pu => (pu.items || []).forEach(i => {
      if (i.product && (!m[i.product] || pu.date > m[i.product])) m[i.product] = pu.date;
    }));
    return m;
  }
  function essentialsStatus() {
    const last = lastBought(), today = Date.parse(App.today());
    const inList = new Set(App.shopItems().filter(i => !i.checked).map(i => i.product));
    const pan = App.pantry();
    return App.products().filter(p => p.essential).map(p => {
      const l = last[p.id], st = pan[p.id];
      const days = l ? Math.round((today - Date.parse(l)) / 86400000) : null;
      // Si está en la despensa manda lo que queda; si no, los días desde la última compra.
      const due = st ? (st.qty <= 0 || (st.daysLeft != null && st.daysLeft < 3)) : days != null && days >= (p.every || 30);
      return { p, days, due, never: days == null && !st, inList: inList.has(p.id), stock: st };
    }).sort((a, b) => App.section(a.p.section).order - App.section(b.p.section).order || a.p.name.localeCompare(b.p.name, 'es'));
  }
  const essLabel = e => e.stock ? (e.stock.qty <= 0 ? 'se acabó' : `quedan ~${Math.round(e.stock.daysLeft)} d`) : e.never ? '' : e.days === 0 ? 'hoy' : `hace ${e.days} d`;
  const shortName = n => n.replace(/\s*\(.*\)\s*$/, '');

  function essentialsCard() {
    const st = essentialsStatus().filter(e => !e.inList);
    const due = st.filter(e => e.due), rest = st.filter(e => !e.due);
    if (!essOpen) {
      return `<div class="card ess"><div class="ess-sum" id="essToggle"><div class="emoji">🧂</div><div class="grow"><b>Esenciales</b>
        <div class="muted ellipsis">${due.length ? `Toca reponer: ${due.slice(0, 4).map(e => esc(shortName(e.p.name))).join(', ')}${due.length > 4 ? '…' : ''}` : 'Leche, café, sal, limpieza… lo que se gasta aunque no esté en el menú'}</div></div>
        ${due.length ? `<span class="pill neg">${due.length}</span>` : ''}<span class="muted">▾</span></div></div>`;
    }
    const chip = e => `<button data-ess="${e.p.id}" class="${e.due ? 'due' : ''}">+ ${esc(shortName(e.p.name))}${essLabel(e) ? ` <span class="muted">· ${essLabel(e)}</span>` : ''}</button>`;
    let h = `<div class="card ess"><div class="ess-sum" id="essToggle"><div class="emoji">🧂</div><div class="grow"><b>Esenciales</b>
      <div class="muted">Lo que se gasta aunque no esté en el menú. Toca para añadir.</div></div><span class="muted">▴</span></div>`;
    if (due.length) {
      h += `<div class="section-label">Toca reponer</div><div class="chips">${due.map(chip).join('')}</div>
        <button class="small primary block" id="essAddDue">＋ ${due.length === 1 ? 'Añadirlo a la lista' : `Añadir los ${due.length} que tocan`}</button>`;
    }
    // El resto, agrupado por sección del súper.
    let lastSec = null;
    rest.forEach(e => {
      const sec = App.section(e.p.section);
      if (sec.id !== lastSec) { if (lastSec !== null) h += `</div>`; h += `<div class="section-label">${esc(sec.emoji)} ${esc(sec.name)}</div><div class="chips">`; lastSec = sec.id; }
      h += chip(e);
    });
    if (lastSec !== null) h += `</div>`;
    if (!st.length) h += `<div class="muted" style="margin-top:8px">Todos los esenciales ya están en la lista 👍</div>`;
    h += `<button class="small ghost block" id="essManage">⚙️ Gestionar esenciales</button></div>`;
    return h;
  }

  function bindEssentials() {
    const view = App.view, $ = s => view.querySelector(s);
    $('#essToggle').onclick = () => { essOpen = !essOpen; App.render(); };
    view.querySelectorAll('[data-ess]').forEach(b => b.onclick = () => addEssential(S.get(b.dataset.ess)));
    if ($('#essAddDue')) $('#essAddDue').onclick = () => {
      const due = essentialsStatus().filter(e => e.due && !e.inList);
      S.putMany(due.map((e, i) => ({ kind: 'shopitem', data: newEssentialItem(e.p, i) })));
      App.toast(`Añadidos ${due.length} esenciales`);
    };
    if ($('#essManage')) $('#essManage').onclick = () => App.go('settings', 'essentials');
  }

  function newEssentialItem(p, n) {
    return { id: 'i-' + App.uid() + (n || ''), product: p.id, name: p.name, section: p.section,
      amount: Math.max(p.essentialQty || 0, p.bulk ? 0 : (p.pack || 1)) || defaultAmount(p), checked: false, source: 'essential', addedAt: Date.now() };
  }
  function addEssential(p) {
    if (!p) return;
    if (App.shopItems().some(i => i.product === p.id && !i.checked)) { App.toast('Ya está en la lista'); return; }
    S.put('shopitem', newEssentialItem(p));
    App.toast(`Añadido: ${shortName(p.name)}`);
  }

  // ---------- Editar una línea de la lista ----------
  function openItem(it) {
    if (!it) return;
    const p = it.product ? S.get(it.product) : null;
    const store = App.currentStore();
    const info = p && store ? SL.priceInfo(p, store) : null;
    const unitLbl = p ? (p.bulk ? p.unit : 'envases') : 'ud';
    const qtyVal = p ? (p.bulk ? it.amount : SL.packsFor(p, it.amount)) : it.amount;
    const per = p ? (p.bulk ? (p.unit === 'g' ? 'kg' : p.unit === 'ml' ? 'l' : 'ud') : 'envase') : 'ud';
    const otherPrices = p ? App.stores().map(s => ({ s, info: SL.priceInfo(p, s) })).filter(x => x.info).sort((a, b) => a.info.p - b.info.p) : [];
    const m = App.sheet(`<h3>${esc(it.name)}</h3>
      ${p ? `<div class="muted">${esc(App.section(p.section).emoji)} ${esc(App.section(p.section).name)}${p.bulk ? ' · a granel' : ` · envase de ${esc(SL.fmtAmount(p.unit, p.pack))}`}</div>` : ''}
      ${!p ? `<label>Nombre</label><input id="nm" value="${esc(it.name)}" maxlength="60">` : ''}
      <label>Cantidad (${esc(unitLbl)})</label><input id="qty" type="text" inputmode="decimal" autocomplete="off" value="${+(+qtyVal).toFixed(2)}">
      ${p && it.source === 'menu' ? `<div class="muted" style="margin-top:4px">El menú necesita ${esc(SL.fmtAmount(p.unit, it.amount))}.</div>` : ''}
      <label>Precio por ${per}${store && p ? ` en ${esc(store.name)}` : ''}</label>
      <div class="row"><input id="price" type="text" inputmode="decimal" autocomplete="off" class="grow" value="${p ? (info ? info.p : '') : (it.price || '')}" placeholder="0,00">
        ${info ? App.srcBadge(info.src) : ''}${info && info.src === 'estimado' ? '<button class="small" id="confirmP">✓ Coincide</button>' : ''}</div>
      ${p ? `<div class="muted" style="margin-top:4px">Si no coincide con la etiqueta, ponlo bien: se guarda para ${esc(store ? store.name : 'este súper')}.</div>` : ''}
      ${otherPrices.length > 1 ? `<label>En otros súpers</label><div class="list tight">${otherPrices.map((x, i) => `<div class="item">${App.storeDot(x.s)}<div class="grow">${esc(x.s.name)}${i === 0 ? ' <span class="pill pos">más barato</span>' : ''}</div><div class="amount">${euros(x.info.p)} ${App.srcBadge(x.info.src)}</div></div>`).join('')}</div>` : ''}
      <label>Nota</label><input id="note" value="${esc(it.note || '')}" maxlength="80" placeholder="Marca, tamaño…">
      ${p && p.nut ? `<label>🥗 Nutrición ${p.unit === 'ud' ? 'por unidad' : p.unit === 'ml' ? 'por 100 ml' : 'por 100 g'}</label>${App.nutGrid(p.nut, { noRI: true })}
        <div class="muted" style="margin-top:6px">Lo que hay en la lista (${esc(SL.fmtAmount(p.unit, it.amount))}): <b>${App.kcal(SL.nutFor(p, it.amount))}</b> · ${App.kcal(SL.nutFor(p, it.amount / App.defaultServings()))} por persona.</div>`
        : p && !NON_FOOD.includes(p.section) ? '<div class="muted" style="margin-top:10px">🥗 Sin información nutricional: puedes añadirla en «Producto».</div>' : ''}
      <div class="actions"><button class="danger" id="del">Quitar</button>${p ? '<button id="editP">Producto</button>' : ''}<button class="primary" id="ok">Guardar</button></div>`);
    const $ = s => m.querySelector(s);
    const priceBefore = $('#price').value;
    $('#ok').onclick = () => App.safely('guardar la línea', () => {
      const q = App.num($('#qty').value);
      if (!(q > 0)) { App.toast('Cantidad no válida'); return; }
      if ($('#price').value.trim() && !(App.num($('#price').value) >= 0)) { App.toast('Precio no válido'); return; }
      const upd = Object.assign({}, S.get(it.id) || it, { note: $('#note').value.trim() });
      upd.amount = p ? (p.bulk ? q : Math.ceil(q) * p.pack) : q;
      if (!p) { upd.name = $('#nm').value.trim() || it.name; const pr = App.num($('#price').value); upd.price = pr > 0 ? pr : undefined; }
      S.put('shopitem', upd);
      const pr = App.num($('#price').value);
      if (p && store && pr > 0 && $('#price').value !== priceBefore) setPrice(p, store, pr, 'manual');
      App.closeSheet();
      App.toast('Guardado');
    });
    if ($('#confirmP')) $('#confirmP').onclick = () => {
      setPrice(p, store, info.p, 'manual');
      $('#confirmP').remove(); App.toast(`Precio confirmado en ${store.name}`);
    };
    $('#del').onclick = () => { App.closeSheet(); App.removeWithUndo('shopitem', it, 'Quitado de la lista'); };
    if ($('#editP')) $('#editP').onclick = () => { App.closeSheet(); openProduct(S.get(p.id) || p); };
  }

  // Guarda el precio real de un producto en un súper (con historial).
  function setPrice(p, store, price, src) {
    const np = JSON.parse(JSON.stringify(S.get(p.id) || p));
    np.prices = np.prices || {};
    np.prices[store.id] = { p: SL.round2(price), t: Date.now(), src: src || 'manual' };
    np.log = (np.log || []).concat({ s: store.id, p: SL.round2(price), t: Date.now(), src: src || 'manual' }).slice(-30);
    S.put('product', np);
  }
  App.setPrice = setPrice;

  // ---------- Terminar compra → gasto en el split ----------
  function openFinish() {
    const pById = App.productsById(), ps = App.people(), me = S.me();
    let store = App.currentStore(), paidBy = me;
    const checked = App.shopItems().filter(i => i.checked);
    const estAt = st => SL.round2(checked.reduce((a, i) => a + (itemCost(i, pById, st) || 0), 0));
    const m = App.sheet(`<h3>✅ Terminar compra</h3>
      <div class="muted">${checked.length} producto${checked.length === 1 ? '' : 's'} en el carro. Se guardará la compra y se creará el gasto en Split.</div>
      <label>Súper</label><select id="st">${App.stores().map(s => `<option value="${s.id}" ${store && s.id === store.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
      <label>Pagado por</label><div class="seg">${ps.map(p => `<button data-payer="${p.id}">${esc(p.name)}</button>`).join('')}</div>
      <label>Total del ticket (€)</label><input id="tot" type="text" inputmode="decimal" autocomplete="off" class="amount-input">
      <div class="muted" id="est" style="margin-top:4px"></div>
      <label>Fecha</label><input id="date" type="date" value="${App.today()}">
      <label class="row check-line"><input type="checkbox" id="mkExp" checked> Crear gasto en Split (🏠 Casa · 🛒 Supermercado · a medias)</label>
      <div class="actions"><button id="cancel">Cancelar</button><button class="primary" id="ok">Terminar</button></div>`);
    const $ = s => m.querySelector(s);
    let touched = false;
    const refresh = () => {
      m.querySelectorAll('[data-payer]').forEach(b => b.classList.toggle('on', b.dataset.payer === paidBy));
      const est = estAt(store);
      if (!touched) $('#tot').value = est.toFixed(2);
      $('#est').textContent = `Suma de la lista con precios de ${store.name}: ${euros(est)}`;
    };
    $('#st').onchange = () => { store = S.get($('#st').value); refresh(); };
    $('#tot').oninput = () => { touched = true; };
    m.querySelectorAll('[data-payer]').forEach(b => b.onclick = () => { paidBy = b.dataset.payer; refresh(); });
    $('#cancel').onclick = App.closeSheet;
    $('#ok').onclick = () => {
      const total = App.num($('#tot').value);
      if (!(total > 0)) { App.toast('Pon el total del ticket'); return; }
      const date = $('#date').value || App.today();
      const lines = checked.map(i => ({ product: i.product || null, name: i.name, section: i.section, amount: i.amount, price: i.price, cost: itemCost(i, pById, store) }));
      const estTotal = estAt(store);
      const ref = SL.purchaseReference(lines, App.compareStores(), pById);
      const purchase = { id: 'pu-' + App.uid(), date, store: store.id, total: SL.round2(total), estTotal, items: lines, ref,
        saving: SL.round2(ref.avg - estTotal), paidBy, createdAt: Date.now() };
      const changes = [];
      if ($('#mkExp').checked) {
        const split = {}; ps.forEach(p => { split[p.id] = true; });
        const exp = { id: App.uid(), description: 'Compra ' + store.name, amount: SL.round2(total), currency: 'EUR', rate: 1, paidBy, date,
          group: S.get('g-casa') ? 'g-casa' : (App.groups()[0] || {}).id, category: S.get('c-super') ? 'c-super' : (App.categories()[0] || {}).id,
          mode: 'equal', split, createdAt: Date.now(), purchase: purchase.id };
        purchase.expense = exp.id;
        changes.push({ kind: 'expense', data: exp });
      }
      changes.push({ kind: 'purchase', data: purchase });
      // Lo comprado entra en la despensa: los productos nuevos empiezan a controlarse desde esta compra.
      const tracked = new Set();
      checked.forEach(i => {
        if (!i.product || tracked.has(i.product) || S.get(App.stockId(i.product))) return;
        tracked.add(i.product);
        changes.push({ kind: 'stock', data: { id: App.stockId(i.product), product: i.product, qty: 0, at: purchase.createdAt - 1 } });
      });
      checked.forEach(i => changes.push({ kind: 'shopitem', data: i, deleted: true }));
      S.putMany(changes);
      App.setCurrentStore(store.id);
      if (App.modules.chores) App.modules.chores.shopDone(paidBy, date); // tarea «Hacer la compra» hecha
      App.closeSheet();
      const sv = purchase.saving;
      App.toast(sv > 0.5 ? `Compra guardada y a la despensa. Ahorráis ${euros(sv)} frente a la media 🎉` : 'Compra guardada y a la despensa');
    };
    refresh();
  }

  // ---------- Comparar ----------
  function renderCompare() {
    const view = App.view, pById = App.productsById(), stores = App.compareStores();
    const habitual = App.habitualStore();
    const all = App.shopItems();
    const items = compareScope === 'pending' ? all.filter(i => !i.checked) : all;
    let h = `<div class="seg"><button data-scope="all" class="${compareScope === 'all' ? 'on' : ''}">Toda la lista</button><button data-scope="pending" class="${compareScope === 'pending' ? 'on' : ''}">Lo que falta</button></div>`;
    if (!items.length || stores.length < 2) {
      h += `<div class="card empty">${stores.length < 2 ? 'Activa al menos 2 súpers para comparar (Ajustes → Supermercados).' : 'Añade productos a la lista para comparar precios entre súpers.'}</div>`;
      view.innerHTML = h; bindScope(); return;
    }
    const cmp = SL.compareStores(items, stores, pById);
    const best = cmp[0], worst = cmp[cmp.length - 1];
    const hab = cmp.find(r => habitual && r.store.id === habitual.id) || null;
    const real = cmp.reduce((a, r) => a + r.real, 0), est = cmp.reduce((a, r) => a + r.estimated, 0);
    const save = hab ? SL.round2(hab.total - best.total) : SL.round2(worst.total - best.total);
    h += `<div class="card hero">
      <div class="muted">Lo más barato: ${App.storeDot(best.store)} <b>${esc(best.store.name)}</b></div>
      <div class="big">${euros(best.total)}</div>
      ${save > 0.004 ? `<div class="pill pos">Ahorras ${euros(save)} (${Math.round(save / (hab ? hab.total : worst.total) * 100)}%) frente a ${esc(hab ? hab.store.name : worst.store.name)}</div>`
        : `<div class="muted">${hab && hab.store.id === best.store.id ? 'Tu súper habitual ya es el más barato 👍' : ''}</div>`}
      ${store() && store().id !== best.store.id ? `<button class="small primary" id="buyBest" style="margin-top:10px">Comprar en ${esc(best.store.name)}</button>` : ''}
    </div>`;
    if (est > real) h += `<div class="note">ℹ️ ${est} de ${est + real} precios son orientativos. Cuantos más precios reales apuntéis (al comprar o en Precios), más fiable es la comparación.</div>`;
    const maxT = worst.total || 1;
    h += `<h2>Total en cada súper</h2><div class="card">${cmp.map(r => `<div class="barrow"><div class="row">${App.storeDot(r.store)}<div class="grow">${esc(r.store.name)}${habitual && r.store.id === habitual.id ? ' <span class="pill zero">habitual</span>' : ''}</div>
      <div class="amount">${euros(r.total)}${r.store.id !== best.store.id ? `<div class="muted">+${euros(r.total - best.total)}</div>` : ''}</div></div>
      <div class="bar"><span style="width:${(r.total / maxT * 100).toFixed(1)}%;background:${esc(r.store.color)}"></span></div></div>`).join('')}</div>`;

    // Repartir entre dos súpers
    const pair = SL.bestPair(items, stores, pById);
    const thr = App.settings().pairThreshold || 3;
    h += `<h2>¿Compensa ir a dos súpers?</h2>`;
    if (pair && best.total - pair.total >= thr) {
      const lineList = idx => idx.map(i => esc(items[i].name)).join(', ');
      const sumOf = (idx, st) => idx.reduce((a, i) => a + (itemCost(items[i], pById, st) || 0), 0);
      h += `<div class="card"><div><b>Sí:</b> repartiendo la compra pagaríais <b>${euros(pair.total)}</b>, <span class="pos"><b>${euros(best.total - pair.total)} menos</b></span> que todo en ${esc(best.store.name)}.</div>
        <div class="pairbox">${App.storeDot(pair.a)} <b>${esc(pair.a.name)}</b> · ${pair.inA.length} productos · ${euros(sumOf(pair.inA, pair.a))}<div class="muted">${lineList(pair.inA)}</div></div>
        <div class="pairbox">${App.storeDot(pair.b)} <b>${esc(pair.b.name)}</b> · ${pair.inB.length} productos · ${euros(sumOf(pair.inB, pair.b))}<div class="muted">${lineList(pair.inB)}</div></div></div>`;
    } else {
      const diff = pair ? SL.round2(best.total - pair.total) : 0;
      h += `<div class="card muted">No compensa: ${diff > 0.004 ? `ir a dos súpers solo ahorraría ${euros(diff)}` : 'no ahorraríais nada'} (umbral: ${euros(thr)}, cámbialo en Ajustes).</div>`;
    }

    // Alternativas producto a producto
    const ref = store() || habitual;
    const alts = SL.alternatives(items, stores, pById, ref).slice(0, 20);
    h += `<h2>Más barato en otro súper</h2>`;
    h += alts.length ? `<div class="card list tight"><div class="muted" style="padding-bottom:6px">Comparado con ${esc(ref.name)}</div>${alts.map(a => `<div class="item"><div class="grow"><div class="ellipsis">${esc(a.line.name)}</div>
        <div class="muted">${euros(a.refCost)} en ${esc(ref.name)} → ${App.storeDot(a.cheapest.store)} ${euros(a.cheapest.cost)} en ${esc(a.cheapest.store.name)}</div></div>
        <div class="amount pos">−${euros(a.saving)}</div></div>`).join('')}</div>`
      : `<div class="card muted">Todo está al mejor precio en ${esc(ref.name)}.</div>`;
    view.innerHTML = h;
    bindScope();
    const bb = view.querySelector('#buyBest');
    if (bb) bb.onclick = () => { App.setCurrentStore(best.store.id); App.toast('Ahora compras en ' + best.store.name); App.go('shop', 'list'); };
    function bindScope() { view.querySelectorAll('[data-scope]').forEach(b => b.onclick = () => { compareScope = b.dataset.scope; App.render(); }); }
    function store() { return App.currentStore(); }
  }

  // ---------- Precios ----------
  // ---------- Productos: catálogo completo, editable ----------
  function renderPrices(partial) {
    const view = App.view, habitual = App.habitualStore(), stores = App.compareStores();
    const ql = priceQuery.trim().toLowerCase();
    const all = App.products();
    const ps = all.filter(p => (!ql || p.name.toLowerCase().includes(ql)) && (!priceSection || p.section === priceSection))
      .sort((a, b) => App.section(a.section).order - App.section(b.section).order || a.name.localeCompare(b.name, 'es'));
    const pan = App.pantry();
    const inList = new Set(App.shopItems().filter(i => !i.checked).map(i => i.product));
    const head = `<input id="pq" class="search" type="search" autocomplete="off" placeholder="🔍 Buscar producto" value="${esc(priceQuery)}">
      <div class="chips scroll-x" style="margin-top:8px"><button data-sec="" class="${!priceSection ? 'on' : ''}">Todo</button>
      ${App.sections().map(s => `<button data-sec="${s.id}" class="${priceSection === s.id ? 'on' : ''}">${s.emoji} ${esc(s.name)}</button>`).join('')}</div>`;
    let h = `<div class="row" style="margin-top:8px"><div class="grow muted">${ps.length === all.length ? `${all.length} productos` : `${ps.length} de ${all.length} productos`}${habitual ? ` · precio en ${esc(habitual.name)}` : ''}</div>
      ${pSel ? '' : '<button class="small ghost" id="selP">☑️ Elegir varios</button>'}</div>`;
    let lastSec = null;
    ps.forEach(p => {
      const sec = App.section(p.section);
      if (sec.id !== lastSec) { if (lastSec !== null) h += `</div>`; h += `<div class="sechdr">${esc(sec.emoji)} ${esc(sec.name)}</div><div class="card list tight">`; lastSec = sec.id; }
      const hi = habitual ? SL.priceInfo(p, habitual) : null;
      let min = null;
      stores.forEach(s => { const i = SL.priceInfo(p, s); if (i && (!min || i.p < min.info.p)) min = { s, info: i }; });
      const tags = [];
      if (pan[p.id]) tags.push(`🏠 ${esc(SL.fmtAmount(p.unit, pan[p.id].qty))}`);
      if (p.essential) tags.push('🧂 esencial');
      if (min && habitual && min.s.id !== habitual.id) tags.push(`más barato en ${esc(min.s.name)}: ${euros(min.info.p)}`);
      else if (p.bulk) tags.push('a granel, precio por kg/l');
      const on = pSel && pSel.has(p.id);
      h += `<div class="item${on ? ' selected' : ''}">${pSel ? `<span class="chk tap${on ? ' on' : ''}" data-p="${p.id}">${on ? '✓' : ''}</span>` : ''}
        <div class="grow tap" data-p="${p.id}"><div class="ellipsis">${esc(p.name)}</div><div class="muted ellipsis">${tags.join(' · ')}</div></div>
        <div class="amount tap" data-p="${p.id}">${hi ? euros(hi.p) + ' ' + App.srcBadge(hi.src) : '—'}</div>
        ${pSel ? '' : `<button class="qbtn${inList.has(p.id) ? ' inlist' : ''}" data-addp="${p.id}" aria-label="Añadir a la lista">${inList.has(p.id) ? '✓' : '🛒'}</button>`}</div>`;
    });
    if (lastSec !== null) h += `</div>`;
    if (!ps.length) h += `<div class="card empty">Sin productos${ql ? ` con «${esc(priceQuery.trim())}»` : ''}. Pulsa <b>+</b> para crear uno.</div>`;
    if (pSel) {
      h += `<div style="height:64px"></div><div class="selbar"><div class="grow"><b>${pSel.size}</b> elegido${pSel.size === 1 ? '' : 's'}</div>
        <button class="small" id="pSec" ${pSel.size ? '' : 'disabled'}>Sección</button><button class="small" id="pEss" ${pSel.size ? '' : 'disabled'}>🧂</button>
        <button class="small danger" id="pDel" ${pSel.size ? '' : 'disabled'}>Borrar</button><button class="small" id="pCancel" aria-label="Terminar">✕</button></div>`;
    }
    const body = view.querySelector('#pbody');
    if (partial) { if (!body) return; body.innerHTML = h; }
    else {
      view.innerHTML = head + `<div id="pbody">${h}</div>`;
      const pq = view.querySelector('#pq');
      pq.oninput = () => { priceQuery = pq.value; clearTimeout(pq._t); pq._t = setTimeout(() => renderPrices(true), 120); };
      view.querySelectorAll('[data-sec]').forEach(b => b.onclick = () => { priceSection = b.dataset.sec; App.render(); });
    }
    const b = view.querySelector('#pbody'), $ = x => b.querySelector(x);
    b.querySelectorAll('[data-p]').forEach(el => el.onclick = () => {
      if (!pSel) { openProduct(S.get(el.dataset.p)); return; }
      const id = el.dataset.p;
      if (pSel.has(id)) pSel.delete(id); else pSel.add(id);
      renderPrices(true);
    });
    b.querySelectorAll('[data-addp]').forEach(el => el.onclick = () => addProduct(S.get(el.dataset.addp)));
    if ($('#selP')) $('#selP').onclick = () => { pSel = new Set(); App.render(); };
    if ($('#pCancel')) $('#pCancel').onclick = () => { pSel = null; App.render(); };
    if ($('#pSec')) $('#pSec').onclick = bulkSection;
    if ($('#pEss')) $('#pEss').onclick = bulkEssential;
    if ($('#pDel')) $('#pDel').onclick = bulkDelete;
  }

  const selProducts = () => [...(pSel || [])].map(id => S.get(id)).filter(Boolean);
  function bulkSection() {
    const ps = selProducts();
    const m = App.sheet(`<h3>Mover ${ps.length} producto${ps.length === 1 ? '' : 's'} a…</h3>
      <div class="list">${App.sections().map(s => `<div class="item tap" data-to="${s.id}"><div class="emoji">${esc(s.emoji)}</div><div class="grow">${esc(s.name)}</div></div>`).join('')}</div>
      <div class="actions"><button id="cancel">Cancelar</button></div>`);
    m.querySelector('#cancel').onclick = App.closeSheet;
    m.querySelectorAll('[data-to]').forEach(el => el.onclick = () => {
      const to = el.dataset.to, ids = new Set(ps.map(p => p.id));
      pSel = null; // antes de guardar: el redibujado ya sale sin selección
      S.putMany([...ps.map(p => ({ kind: 'product', data: Object.assign({}, p, { section: to }) })),
        ...App.shopItems().filter(i => ids.has(i.product)).map(i => ({ kind: 'shopitem', data: Object.assign({}, i, { section: to }) }))]);
      App.closeSheet(); App.toast(`Movidos a ${App.section(to).name}`);
    });
  }
  function bulkEssential() {
    const ps = selProducts();
    const m = App.sheet(`<h3>🧂 Esenciales</h3><div class="muted">${ps.length} producto${ps.length === 1 ? '' : 's'} elegido${ps.length === 1 ? '' : 's'}.</div>
      <div class="actions"><button id="off">Quitar de esenciales</button><button class="primary" id="on">Marcar como esenciales</button></div>`);
    const apply = on => {
      pSel = null;
      S.putMany(ps.map(p => ({ kind: 'product', data: Object.assign({}, p, on ? { essential: true, every: p.every || 30, essentialQty: p.essentialQty || defaultAmount(p) } : { essential: false }) })));
      App.closeSheet(); App.toast(on ? 'Marcados como esenciales' : 'Quitados de esenciales');
    };
    m.querySelector('#on').onclick = () => apply(true);
    m.querySelector('#off').onclick = () => apply(false);
  }
  async function bulkDelete() {
    const ps = selProducts();
    const inRecipes = App.recipes().filter(r => (r.ingredients || []).some(i => pSel.has(i.product))).length;
    if (!await App.confirmDelete(`¿Eliminar ${ps.length} producto${ps.length === 1 ? '' : 's'}?${inRecipes ? `\nSe usan en ${inRecipes} receta(s), que se quedarán sin ellos.` : ''}`)) return;
    pSel = null;
    S.putMany(ps.map(p => ({ kind: 'product', data: p, deleted: true })));
    App.toast(`Eliminados ${ps.length} productos`, { undo: () => S.putMany(ps.map(p => ({ kind: 'product', data: p }))) });
  }

  // ---------- Ficha de producto ----------
  function openProduct(existing, opts) {
    opts = opts || {};
    const isNew = !existing;
    const p = existing ? JSON.parse(JSON.stringify(existing))
      : opts.copyFrom ? Object.assign(JSON.parse(JSON.stringify(opts.copyFrom)), { id: 'p-' + App.uid(), name: opts.copyFrom.name + ' (copia)', log: [] })
      : { id: 'p-' + App.uid(), name: opts.name || '', section: 'otros', unit: 'ud', pack: 1, price: 0, bulk: false, staple: false, prices: {} };
    const uses = isNew ? [] : App.recipes().filter(r => (r.ingredients || []).some(i => i.product === p.id));
    const stLvl = isNew ? null : App.pantry()[p.id];
    const stores = App.stores();
    const m = App.sheet(`<h3>${opts.copyFrom ? 'Copia de producto' : isNew ? 'Nuevo producto' : 'Producto'}</h3>
      ${isNew ? '' : `<div class="btnrow" style="margin-top:6px"><button id="addL">🛒 A la lista</button><button id="stockEdit">🏠 ${stLvl ? esc(SL.fmtAmount(p.unit, stLvl.qty)) + ' en casa' : 'A la despensa'}</button><button id="dup">📋 Duplicar</button></div>`}
      <label>Nombre</label><input id="nm" value="${esc(p.name)}" maxlength="60" autocomplete="off" placeholder="Ej: Yogur griego (4 ud)">
      <label>Sección</label><select id="sec">${App.sections().map(s => `<option value="${s.id}" ${s.id === p.section ? 'selected' : ''}>${s.emoji} ${esc(s.name)}</option>`).join('')}</select>
      <label class="row check-line"><input type="checkbox" id="bulk" ${p.bulk ? 'checked' : ''}> Se compra a granel (precio por kg o litro)</label>
      <div class="row" id="packRow"><div class="grow"><label>Tamaño del envase</label><input id="pack" type="text" inputmode="decimal" autocomplete="off" value="${p.pack}"></div>
        <div style="width:110px"><label>Unidad</label><select id="unit">${[['g', 'gramos'], ['ml', 'ml'], ['ud', 'unidades']].map(([u, n]) => `<option value="${u}" ${u === p.unit ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
      <label class="row check-line"><input type="checkbox" id="staple" ${p.staple ? 'checked' : ''}> De despensa (al crear la lista desde el menú sale desmarcado)</label>
      <label class="row check-line"><input type="checkbox" id="essential" ${p.essential ? 'checked' : ''}> Esencial: lo compramos aunque no esté en el menú</label>
      <div class="row" id="everyRow" style="margin-top:6px"><span class="grow muted">Se suele reponer cada</span><input id="every" type="text" inputmode="numeric" autocomplete="off" step="1" class="every-input" value="${p.every || 30}"><span class="muted">días</span></div>
      <div id="nutBox"><label>🥗 Información nutricional <span class="muted" id="nutPer"></span></label>
        <div class="nutin">${NUT_FIELDS.map(([k, l]) => `<div><label>${l}</label><input data-nut="${k}" type="text" inputmode="decimal" autocomplete="off" value="${p.nut && p.nut[k] != null ? p.nut[k] : ''}"></div>`).join('')}</div>
        <div class="muted" style="margin-top:4px">Viene en la etiqueta («por 100 g»). Se usa para calcular la nutrición por persona de las recetas.</div></div>
      <label id="priceLbl">Precios</label>
      <div class="list tight">${stores.map(s => {
        const r = p.prices && p.prices[s.id];
        const est = p.price > 0 ? SL.round2(p.price * (s.factor || 1)) : null;
        return `<div class="item">${App.storeDot(s)}<div class="grow">${esc(s.name)}<div class="muted">${r ? `${r.src === 'web' ? 'web' : r.src === 'ticket' ? 'ticket' : 'apuntado'} ${new Date(r.t || Date.now()).toLocaleDateString('es-ES')}` : est != null ? `estimado ${euros(est)}` : 'sin precio'}</div></div>
          <input type="text" inputmode="decimal" autocomplete="off" class="price-input" data-ps="${s.id}" value="${r ? r.p : ''}" placeholder="${est != null ? est.toFixed(2) : '0,00'}">${r ? `<button class="xbtn" data-clr="${s.id}" aria-label="Quitar precio">✕</button>` : '<span class="xbtn"></span>'}</div>`;
      }).join('')}</div>
      <label>Precio orientativo (para súpers sin precio apuntado)</label><input id="base" type="text" inputmode="decimal" autocomplete="off" value="${p.price || ''}">
      ${(p.log || []).length ? `<label>Historial de precios</label><div class="list tight">${p.log.slice().reverse().slice(0, 10).map(l => {
        const s = S.get(l.s) || { name: '¿?' };
        return `<div class="item"><div class="grow">${esc(s.name)} <span class="muted">${new Date(l.t).toLocaleDateString('es-ES')}</span></div><div class="amount">${euros(l.p)}</div></div>`;
      }).join('')}</div>` : ''}
      ${uses.length ? `<label>Usado en ${uses.length} receta${uses.length === 1 ? '' : 's'}</label><div class="chips">${uses.map(r => `<button data-rcp="${r.id}">${esc(r.emoji)} ${esc(r.name)}</button>`).join('')}</div>` : ''}
      <div class="actions">${isNew ? '' : '<button class="danger" id="del">Eliminar</button>'}<button id="cancel">Cancelar</button><button class="primary" id="ok">Guardar</button></div>`, { stack: !!opts.stack || !!opts.onSaved });
    const $ = s => m.querySelector(s);
    const syncBulk = () => {
      const bulk = $('#bulk').checked;
      $('#packRow').querySelector('label').textContent = bulk ? 'Se pesa en' : 'Tamaño del envase';
      $('#pack').disabled = bulk;
      if (bulk) { if ($('#unit').value === 'ud') $('#unit').value = 'g'; $('#pack').value = 1000; }
      $('#priceLbl').textContent = bulk ? 'Precio por kg / litro' : 'Precio por envase';
    };
    $('#bulk').onchange = syncBulk;
    const syncNut = () => {
      const u = $('#unit').value;
      $('#nutPer').textContent = u === 'ud' ? '(por unidad)' : u === 'ml' ? '(por 100 ml)' : '(por 100 g)';
      $('#nutBox').style.display = NON_FOOD.includes($('#sec').value) ? 'none' : '';
    };
    $('#unit').addEventListener('change', syncNut); $('#sec').addEventListener('change', syncNut); syncNut();
    const syncEss = () => { $('#everyRow').style.display = $('#essential').checked ? '' : 'none'; };
    $('#essential').onchange = syncEss; syncEss();
    const cleared = new Set();
    m.querySelectorAll('[data-clr]').forEach(b => b.onclick = () => {
      cleared.add(b.dataset.clr);
      const inp = m.querySelector(`[data-ps="${b.dataset.clr}"]`); inp.value = ''; inp.placeholder = 'se quitará';
    });
    $('#cancel').onclick = App.closeSheet;
    if ($('#addL')) $('#addL').onclick = () => addProduct(S.get(p.id) || existing);
    if ($('#stockEdit')) $('#stockEdit').onclick = () => App.modules.pantry.openStock(S.get(p.id) || existing, { stack: true });
    if ($('#dup')) $('#dup').onclick = () => { App.closeSheet(); openProduct(null, { copyFrom: S.get(p.id) || existing }); };
    m.querySelectorAll('[data-rcp]').forEach(b => b.onclick = () => App.modules.menu.openRecipeCard(S.get(b.dataset.rcp)));
    $('#ok').onclick = () => App.safely('guardar el producto', () => {
      p.name = $('#nm').value.trim();
      if (!p.name) { App.toast('Ponle un nombre'); return; }
      // Antes de tocar nada, comprueba que todos los números se entienden.
      const bad = [...m.querySelectorAll('[data-ps]')].find(inp => inp.value.trim() && !(App.num(inp.value) >= 0));
      if (bad) { App.toast(`Precio no válido en ${(S.get(bad.dataset.ps) || {}).name || 'un súper'}`); bad.focus(); return; }
      if ($('#base').value.trim() && !(App.num($('#base').value) >= 0)) { App.toast('Precio orientativo no válido'); return; }
      if (!$('#bulk').checked && $('#pack').value.trim() && !(App.num($('#pack').value) > 0)) { App.toast('Tamaño del envase no válido'); return; }
      const nutIns = [...m.querySelectorAll('[data-nut]')];
      const badNut = nutIns.find(inp => inp.value.trim() && !(App.num(inp.value) >= 0));
      if (badNut) { App.toast('Valor nutricional no válido'); badNut.focus(); return; }
      if (nutIns.some(inp => inp.value.trim())) { p.nut = {}; nutIns.forEach(inp => { p.nut[inp.dataset.nut] = App.num(inp.value) || 0; }); }
      else delete p.nut;
      p.section = $('#sec').value; p.bulk = $('#bulk').checked; p.unit = $('#unit').value; p.staple = $('#staple').checked;
      p.essential = $('#essential').checked; p.every = Math.round(App.num($('#every').value)) || p.every || 30;
      p.pack = p.bulk ? (p.unit === 'ud' ? 1 : 1000) : (App.num($('#pack').value) || 1);
      const base = App.num($('#base').value); p.price = base > 0 ? base : 0;
      p.prices = p.prices || {}; p.log = p.log || [];
      m.querySelectorAll('[data-ps]').forEach(inp => {
        const v = App.num(inp.value), sid = inp.dataset.ps, old = p.prices[sid];
        if (v > 0) {
          if (!old || Math.abs(old.p - v) > 0.004) { p.prices[sid] = { p: SL.round2(v), t: Date.now(), src: 'manual' }; p.log.push({ s: sid, p: SL.round2(v), t: Date.now(), src: 'manual' }); }
        } else if (cleared.has(sid)) delete p.prices[sid]; // solo se borra con la ✕
      });
      p.log = p.log.slice(-30);
      S.put('product', p);
      // Mantiene el nombre y la sección en las líneas de la lista.
      S.putMany(App.shopItems().filter(i => i.product === p.id && (i.name !== p.name || i.section !== p.section))
        .map(i => ({ kind: 'shopitem', data: Object.assign({}, i, { name: p.name, section: p.section }) })));
      App.closeSheet();
      App.toast('Producto guardado');
      if (opts.onSaved) opts.onSaved(p);
    });
    const del = $('#del');
    if (del) del.onclick = async () => {
      const inRecipes = App.recipes().filter(r => (r.ingredients || []).some(i => i.product === p.id)).length;
      if (!await App.confirmDelete(inRecipes ? `Está en ${inRecipes} receta(s), que se quedarán sin este ingrediente. ¿Eliminar ${p.name}?` : `¿Eliminar ${p.name}?`)) return;
      App.closeSheet();
      App.removeWithUndo('product', existing, 'Producto eliminado');
    };
    syncBulk(); syncNut();
    if (isNew && !opts.name) setTimeout(() => $('#nm').focus(), 80);
  }

  // Selector de producto reutilizable (lista y recetas).
  App.pickProduct = function (cb) {
    let q = '';
    const m = App.sheet(`<div class="sheethead"><h3>Elegir producto</h3><input id="q" class="search" type="search" enterkeyhint="done" placeholder="🔍 Buscar o escribir uno nuevo" autocomplete="off"></div>
      <div class="list tight" id="res" style="margin-top:8px"></div><div class="actions"><button id="cancel">Cerrar</button></div>`, { stack: true });
    const $ = s => m.querySelector(s);
    const draw = () => {
      const ql = q.trim().toLowerCase();
      const ps = App.products().filter(p => !ql || p.name.toLowerCase().includes(ql))
        .sort((a, b) => App.section(a.section).order - App.section(b.section).order || a.name.localeCompare(b.name, 'es')).slice(0, 60);
      $('#res').innerHTML = (ql ? `<div class="item tap new" data-new><div class="emoji">＋</div><div class="grow">Crear «${esc(q.trim())}»</div></div>` : '')
        + ps.map(p => `<div class="item tap" data-p="${p.id}"><div class="emoji">${esc(App.section(p.section).emoji)}</div><div class="grow ellipsis">${esc(p.name)}</div></div>`).join('');
      m.querySelectorAll('[data-p]').forEach(el => el.onclick = () => { App.closeSheet(); cb(S.get(el.dataset.p)); });
      const nw = m.querySelector('[data-new]');
      if (nw) nw.onclick = () => { App.closeSheet(); openProduct(null, { name: q.trim(), onSaved: cb }); };
    };
    $('#q').oninput = ev => { q = ev.target.value; draw(); };
    $('#q').onkeydown = ev => { if (ev.key === 'Enter') { const f = m.querySelector('#res .item'); if (f) f.click(); } };
    $('#cancel').onclick = App.closeSheet;
    draw();
    setTimeout(() => $('#q').focus(), 80);
  };

  // ---------- Ahorro ----------
  function renderSavings() {
    const view = App.view, pus = App.purchases();
    const totalSaving = pus.reduce((a, p) => a + (p.saving || 0), 0);
    const thisM = App.monthOf(App.today());
    const monthPus = pus.filter(p => App.monthOf(p.date) === thisM);
    let h = `<div class="card hero"><div class="muted">Ahorro acumulado</div><div class="big ${totalSaving >= 0 ? 'pos' : 'neg'}">${euros(totalSaving)}</div>
      <div class="muted">en ${pus.length} compra${pus.length === 1 ? '' : 's'} · frente a la media de los súpers que comparáis</div></div>
      <div class="grid2"><div class="card stat"><div class="muted">Súper este mes</div><b>${euros(monthPus.reduce((a, p) => a + p.total, 0))}</b></div>
      <div class="card stat"><div class="muted">Ahorro este mes</div><b class="pos">${euros(monthPus.reduce((a, p) => a + (p.saving || 0), 0))}</b></div></div>`;
    if (!pus.length) {
      h += `<div class="card empty">Cuando terminéis una compra desde la lista, aquí veréis lo gastado y lo ahorrado.</div>`;
      view.innerHTML = h; return;
    }
    const byM = {};
    pus.forEach(p => { const k = App.monthOf(p.date); byM[k] = byM[k] || { spent: 0, saving: 0, n: 0 }; byM[k].spent += p.total; byM[k].saving += p.saving || 0; byM[k].n++; });
    h += `<h2>Por mes</h2><div class="card list tight">${Object.keys(byM).sort().reverse().slice(0, 12).map(k => `<div class="item"><div class="grow">${esc(App.fmtMonth(k))}<div class="muted">${byM[k].n} compra${byM[k].n === 1 ? '' : 's'} · ${euros(byM[k].spent)}</div></div>
      <div class="amount ${byM[k].saving >= 0 ? 'pos' : 'neg'}">${byM[k].saving >= 0 ? '+' : ''}${euros(byM[k].saving)}</div></div>`).join('')}</div>`;
    const byStore = {};
    pus.forEach(p => { byStore[p.store] = (byStore[p.store] || 0) + p.total; });
    h += `<h2>Gasto por súper</h2><div class="card">${Object.entries(byStore).sort((a, b) => b[1] - a[1]).map(([sid, v]) => {
      const s = S.get(sid) || { name: '¿?', color: '#999' };
      const max = Math.max(...Object.values(byStore));
      return `<div class="barrow"><div class="row">${App.storeDot(s)}<div class="grow">${esc(s.name)}</div><div class="amount">${euros(v)}</div></div><div class="bar"><span style="width:${v / max * 100}%;background:${esc(s.color)}"></span></div></div>`;
    }).join('')}</div>`;
    h += `<h2>Compras</h2><div class="card list">${pus.map(p => {
      const s = S.get(p.store) || { name: '¿?', color: '#999' };
      return `<div class="item tap" data-pu="${p.id}">${App.storeDot(s)}<div class="grow">${esc(s.name)}<div class="muted">${esc(App.fmtDate(p.date))} · ${(p.items || []).length} productos</div></div>
        <div class="amount">${euros(p.total)}<div class="muted ${(p.saving || 0) >= 0 ? 'pos' : 'neg'}">${(p.saving || 0) >= 0 ? 'ahorro ' : ''}${euros(p.saving || 0)}</div></div></div>`;
    }).join('')}</div>`;
    view.innerHTML = h;
    view.querySelectorAll('[data-pu]').forEach(el => el.onclick = () => openPurchase(S.get(el.dataset.pu)));
  }

  function openPurchase(pu) {
    const s = S.get(pu.store) || { name: '¿?' };
    const m = App.sheet(`<h3>🛒 ${esc(s.name)} · ${esc(App.fmtDate(pu.date))}</h3>
      <div class="grid2"><div class="stat"><div class="muted">Ticket</div><b>${euros(pu.total)}</b></div><div class="stat"><div class="muted">Ahorro vs media</div><b class="${(pu.saving || 0) >= 0 ? 'pos' : 'neg'}">${euros(pu.saving || 0)}</b></div></div>
      <div class="muted">Misma compra de media: ${euros(pu.ref ? pu.ref.avg : 0)} · en el más caro: ${euros(pu.ref ? pu.ref.max : 0)}</div>
      <div class="list tight" style="margin-top:8px">${(pu.items || []).map(i => {
        const p = i.product ? S.get(i.product) : null;
        return `<div class="item"><div class="grow ellipsis">${esc(i.name)}<div class="muted">${p ? esc(qtyLabel(p, i.amount)) : esc(i.amount + ' ud')}</div></div><div class="amount">${i.cost != null ? euros(i.cost) : '—'}</div></div>`;
      }).join('')}</div>
      <div class="actions"><button class="danger" id="del">Eliminar</button>${pu.expense && S.get(pu.expense) ? '<button id="exp">Ver gasto</button>' : ''}<button id="cancel">Cerrar</button></div>`);
    const $ = x => m.querySelector(x);
    $('#cancel').onclick = App.closeSheet;
    if ($('#exp')) $('#exp').onclick = () => { App.closeSheet(); App.modules.split.openExpense(S.get(pu.expense)); };
    $('#del').onclick = async () => {
      if (!await App.confirmDelete('¿Eliminar esta compra del historial? El gasto en Split no se borra (bórralo desde Gastos si quieres).')) return;
      App.closeSheet(); App.removeWithUndo('purchase', pu, 'Compra eliminada');
    };
  }

  App.modules.shop = { render, openProduct, addProduct, essentialsStatus, newEssentialItem, itemCost, defaultAmount, essLabel };
})();
