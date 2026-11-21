// Inicio: lo que toca hoy y mañana del menú, cómo va la semana, qué falta comprar y cómo están las cuentas.
(function () {
  'use strict';
  const App = window.App, S = App.S, L = App.L, SL = App.SL;
  const esc = App.esc;
  const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const shortName = n => n.replace(/\s*\(.*\)\s*$/, '');
  const listNames = (arr, n) => arr.slice(0, n).map(x => esc(shortName(x))).join(', ') + (arr.length > n ? '…' : '');

  function dayCard(date, title) {
    const menu = App.modules.menu, rById = App.recipesById();
    const rows = App.enabledMeals().map(meal => {
      const slot = S.get(menu.mealId(date, meal.id));
      const r = slot && slot.recipe && rById[slot.recipe];
      const label = r ? `${esc(r.emoji)} ${esc(r.name)}` : slot && slot.text ? `📝 ${esc(slot.text)}` : '';
      const serv = slot && (slot.servings || 2) !== App.defaultServings() ? ` <span class="pill zero">${slot.servings} pers.</span>` : '';
      return `<div class="mealrow" data-slot="${date}|${meal.id}"><span class="when">${meal.emoji} ${esc(meal.name)}</span>
        <span class="grow what ${label ? '' : 'none'}">${label || '＋ Elegir'}${serv}</span>${r ? '<span class="muted">›</span>' : ''}</div>`;
    }).join('');
    return `<div class="card"><div class="hhead"><span class="grow">${title}</span><button class="small ghost" data-go="menu">Ver semana ›</button></div>${rows}</div>`;
  }

  function render() {
    const view = App.view, me = S.me() && App.person(S.me());
    const today = App.today(), tomorrow = App.addDays(today, 1);
    const d = new Date(today + 'T12:00:00');
    const dateTxt = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    const hour = new Date().getHours();
    const hi = hour < 6 ? 'Buenas noches' : hour < 14 ? 'Buenos días' : hour < 21 ? 'Buenas tardes' : 'Buenas noches';

    let h = `<div class="hello"><b>${hi}${me ? ', ' + esc(me.name) : ''}</b><div class="muted">${esc(dateTxt[0].toUpperCase() + dateTxt.slice(1))} · Monchi y Hierba vigilan 🐱🐈‍⬛</div></div>
      <div class="quick"><button data-q="exp"><span>💶</span>Gasto</button><button data-q="add"><span>🛒</span>A la lista</button>
        <button data-go="recipes"><span>🍳</span>Recetas</button><button data-go="menu"><span>📅</span>Menú</button></div>`;

    // ---- Comidas de hoy y mañana ----
    h += dayCard(today, `☀️ Hoy · ${DAY_NAMES[(d.getDay() + 6) % 7]}`);
    h += dayCard(tomorrow, `🌙 Mañana · ${DAY_NAMES[(d.getDay() + 7) % 7]}`);

    // ---- Semana: huecos que quedan desde hoy hasta el domingo ----
    const sunday = App.addDays(App.mondayOf(today), 6);
    const enabled = App.enabledMeals();
    let free = 0, total = 0;
    for (let x = today; x <= sunday; x = App.addDays(x, 1)) enabled.forEach(m => { total++; if (!S.get(App.modules.menu.mealId(x, m.id))) free++; });
    h += `<div class="card hcard" data-go="menu"><div class="hhead"><span class="grow">📅 Lo que queda de semana</span><span class="go">›</span></div>
      <div class="muted">${total - free}/${total} comidas planificadas hasta el domingo${free ? ` · faltan ${free}` : ' · ¡todo listo!'}</div>
      <div class="bar"><span style="width:${total ? (total - free) / total * 100 : 0}%"></span></div></div>`;

    // ---- Compra ----
    const store = App.currentStore(), pById = App.productsById(), rById = App.recipesById();
    const pending = App.shopItems().filter(i => !i.checked);
    const cost = pending.reduce((a, i) => a + (App.modules.shop.itemCost(i, pById, store) || 0), 0);
    const inList = new Set(pending.map(i => i.product).filter(Boolean));
    // Lo que piden las comidas de los próximos 7 días y no está en la lista (sin contar despensa).
    const upcoming = App.meals().filter(m => m.date >= today && m.date <= App.addDays(today, 6));
    const need = SL.menuNeeds(upcoming, rById);
    const missing = Object.keys(need).map(id => pById[id]).filter(p => p && !p.staple && !inList.has(p.id));
    const due = App.modules.shop.essentialsStatus().filter(e => e.due && !e.inList);

    h += `<div class="card"><div class="hhead hcard" data-go="shop"><span class="grow">🛒 Compra</span><span class="go">Ver lista ›</span></div>
      <div class="muted">${pending.length ? `${pending.length} producto${pending.length === 1 ? '' : 's'} en la lista${cost ? ` · ≈ ${App.euros(cost)}${store ? ' en ' + esc(store.name) : ''}` : ''}` : 'La lista está vacía.'}</div>`;
    if (missing.length) {
      h += `<div class="alert" id="missing"><div class="emoji">🥕</div><div class="grow"><b>Falta para el menú</b>
        <div class="muted">${missing.length} ingrediente${missing.length === 1 ? '' : 's'} de los próximos 7 días: ${listNames(missing.map(p => p.name), 4)}</div></div><button class="small primary">Revisar</button></div>`;
    } else if (upcoming.some(m => m.recipe)) {
      h += `<div class="alert ok"><div class="emoji">✅</div><div class="grow"><b>Lo del menú ya está en la lista</b><div class="muted">Próximos 7 días</div></div></div>`;
    }
    if (due.length) {
      h += `<div class="alert" id="due"><div class="emoji">🧂</div><div class="grow"><b>Toca reponer</b>
        <div class="muted">${listNames(due.map(e => e.p.name), 4)}</div></div><button class="small primary">Añadir ${due.length}</button></div>`;
    }
    h += `</div>`;

    // ---- Cuentas ----
    const ps = App.people(), myId = S.me();
    const { bal } = L.computeBalances(App.splitState());
    const b = bal[myId] || 0, other = ps.find(p => p.id !== myId);
    const month = App.monthOf(today);
    const spent = App.expenses().filter(e => App.monthOf(e.date) === month).reduce((a, e) => a + L.expenseShares(e).total, 0);
    const balTxt = b > 0 ? `<b class="pos">${other && ps.length === 2 ? esc(other.name) + ' te debe' : 'Te deben'} ${App.eur(b)}</b>`
      : b < 0 ? `<b class="neg">${other && ps.length === 2 ? 'Le debes a ' + esc(other.name) : 'Debes'} ${App.eur(-b)}</b>` : '<b>Estáis en paz 🐱🐈‍⬛</b>';
    h += `<div class="card hcard" data-go="split"><div class="hhead"><span class="grow">💶 Gastos</span><span class="go">›</span></div>
      <div>${balTxt}</div><div class="muted">${esc(App.fmtMonth(month))}: ${App.eur(spent)} en gastos compartidos</div></div>`;

    view.innerHTML = h;
    bind(missing, due, upcoming);
  }

  function bind(missing, due, upcoming) {
    const view = App.view;
    view.querySelectorAll('[data-go]').forEach(el => el.onclick = ev => { ev.stopPropagation(); App.go(el.dataset.go, el.dataset.go === 'shop' ? 'list' : null); });
    view.querySelectorAll('[data-slot]').forEach(el => el.onclick = () => {
      const [d, m] = el.dataset.slot.split('|');
      const slot = S.get(App.modules.menu.mealId(d, m));
      const r = slot && slot.recipe && S.get(slot.recipe);
      if (r) App.modules.menu.openRecipeCard(r, slot.servings, [d, m]); else App.modules.menu.openSlot(d, m);
    });
    view.querySelector('[data-q="exp"]').onclick = () => App.modules.split.openExpense();
    view.querySelector('[data-q="add"]').onclick = () => App.pickProduct(p => App.modules.shop.addProduct(p));
    const mi = view.querySelector('#missing');
    if (mi) mi.onclick = () => App.modules.menu.openNeedsToList({ title: '🥕 Falta para el menú', getMeals: () => upcoming });
    const du = view.querySelector('#due');
    if (du) du.onclick = () => {
      S.putMany(due.map((e, i) => ({ kind: 'shopitem', data: App.modules.shop.newEssentialItem(e.p, i) })));
      App.toast(`Añadidos ${due.length} esenciales a la lista`);
    };
  }

  App.modules.home = { render };
})();
