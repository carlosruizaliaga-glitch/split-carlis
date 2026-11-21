// Núcleo compartido: utilidades, datos, navegación entre módulos, entrada y catálogo.
(function () {
  'use strict';
  const L = window.Logic, S = window.Store, D = window.DEFAULTS, C = window.CATALOG, SL = window.ShopLogic;
  const App = window.App = { L, S, D, C, SL, modules: {} };

  // ---------- Datos ----------
  const byOrder = (a, b) => (a.order || 0) - (b.order || 0) || (a.name || '').localeCompare(b.name || '');
  App.byOrder = byOrder;
  App.people = () => S.list('person').sort((a, b) => a.name.localeCompare(b.name));
  App.groups = () => S.list('group').sort(byOrder);
  App.categories = () => S.list('category').sort(byOrder);
  App.expenses = () => S.list('expense');
  App.payments = () => S.list('payment');
  App.settings = () => Object.assign({}, D.settings, S.get('settings') || {});
  App.rates = () => Object.assign({}, D.settings.rates, App.settings().rates);
  App.person = id => S.get(id) || { id, name: '¿?', color: '#999' };
  App.group = id => S.get(id) || { id, name: 'Sin grupo', emoji: '❔' };
  App.category = id => S.get(id) || { id, name: 'Sin categoría', emoji: '📦' };
  App.splitState = () => ({ people: App.people(), expenses: App.expenses(), payments: App.payments() });

  App.stores = () => S.list('store').sort(byOrder);
  App.compareStores = () => App.stores().filter(s => s.compare !== false);
  App.products = () => S.list('product').sort((a, b) => a.name.localeCompare(b.name, 'es'));
  App.productsById = () => { const m = {}; App.products().forEach(p => { m[p.id] = p; }); return m; };
  App.recipes = () => S.list('recipe').sort((a, b) => a.name.localeCompare(b.name, 'es'));
  App.recipesById = () => { const m = {}; App.recipes().forEach(r => { m[r.id] = r; }); return m; };
  App.meals = () => S.list('meal');
  App.shopItems = () => S.list('shopitem');
  App.purchases = () => S.list('purchase').sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));
  App.section = id => C.SECTIONS.find(s => s.id === id) || C.SECTIONS[C.SECTIONS.length - 1];
  App.mealDef = id => C.MEALS.find(m => m.id === id) || { id, emoji: '🍴', name: id };
  App.enabledMeals = () => { const on = App.settings().meals || C.MEALS.map(m => m.id); return C.MEALS.filter(m => on.includes(m.id)); };
  App.defaultServings = () => App.settings().servings || 2;
  App.habitualStore = () => { const st = App.stores(); return st.find(s => s.id === App.settings().habitualStore) || st[0] || null; };
  // Súper en el que estás comprando (por móvil).
  App.currentStore = () => {
    let id = null; try { id = localStorage.getItem('splitcarlis.store'); } catch (e) {}
    return (id && S.get(id)) || App.habitualStore();
  };
  App.setCurrentStore = id => { try { localStorage.setItem('splitcarlis.store', id); } catch (e) {} };

  App.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  App.today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  App.monthOf = d => (d || '').slice(0, 7);
  App.addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  App.mondayOf = iso => { const d = new Date(iso + 'T12:00:00'); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return d.toISOString().slice(0, 10); };

  // ---------- Formato ----------
  const eurFmt = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
  App.eur = cents => eurFmt.format(cents / 100);
  App.euros = x => eurFmt.format(x || 0);
  App.money = (amount, cur) => {
    try {
      return new Intl.NumberFormat('es-ES', { style: 'currency', currency: cur || 'EUR', currencyDisplay: 'narrowSymbol',
        maximumFractionDigits: L.decimalsOf(cur), minimumFractionDigits: L.decimalsOf(cur) }).format(amount);
    } catch (e) { return amount + ' ' + cur; }
  };
  App.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const esc = App.esc;
  App.initials = n => (n || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  App.avatar = (p, sm) => `<div class="avatar${sm ? ' sm' : ''}" style="background:${esc(p.color)}">${esc(App.initials(p.name))}</div>`;
  App.fmtDate = d => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: d.slice(0, 4) === App.today().slice(0, 4) ? undefined : 'numeric' });
  App.fmtMonth = m => { const s = new Date(m + '-15T12:00:00').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }); return s[0].toUpperCase() + s.slice(1); };
  App.balPill = c => c > 0 ? `<span class="pill pos">le deben ${App.eur(c)}</span>`
    : c < 0 ? `<span class="pill neg">debe ${App.eur(-c)}</span>` : `<span class="pill zero">en paz</span>`;
  App.storeDot = s => `<span class="sdot" style="background:${esc(s.color || '#999')}"></span>`;
  App.srcBadge = src => src === 'estimado' ? '<span class="badge est" title="Precio orientativo">est.</span>'
    : src === 'web' ? '<span class="badge web">web</span>' : src === 'ticket' ? '<span class="badge real">ticket</span>' : '<span class="badge real">real</span>';
  // Lee números escritos a la española o a la inglesa: "0,89", "0.89", "1.234,56", "3 €".
  App.num = v => {
    let s = String(v == null ? '' : v).trim().replace(/[€\s]/g, '');
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return isFinite(n) ? n : NaN;
  };

  // ---------- Avisos, diálogos y hojas ----------
  App.toast = function (msg, opts) {
    opts = opts || {};
    document.querySelectorAll('.toast').forEach(t => t.remove());
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<span>${esc(msg)}</span>${opts.undo ? '<button class="toast-undo">Deshacer</button>' : ''}`;
    document.body.appendChild(t);
    if (opts.undo) t.querySelector('.toast-undo').onclick = () => { t.remove(); opts.undo(); };
    setTimeout(() => t.remove(), opts.undo ? 5000 : 2400);
  };
  // Diálogo propio (confirm/alert del navegador fallan en apps instaladas).
  App.ask = function (msg, opts) {
    opts = Object.assign({ ok: 'Aceptar', cancel: 'Cancelar', danger: false }, opts);
    return new Promise(resolve => {
      const root = document.createElement('div');
      root.className = 'overlay dialog';
      root.innerHTML = `<div class="dlg" role="alertdialog"><div>${esc(msg).replace(/\n/g, '<br>')}</div>
        <div class="actions">${opts.cancel ? `<button data-no>${esc(opts.cancel)}</button>` : ''}
        <button data-yes class="${opts.danger ? 'danger-solid' : 'primary'}">${esc(opts.ok)}</button></div></div>`;
      document.body.appendChild(root);
      const done = v => { root.remove(); resolve(v); };
      root.querySelector('[data-yes]').onclick = () => done(true);
      const no = root.querySelector('[data-no]');
      if (no) no.onclick = () => done(false);
      root.addEventListener('click', ev => { if (ev.target === root) done(false); });
    });
  };
  App.confirmDelete = msg => App.ask(msg, { ok: 'Eliminar', danger: true });
  App.notify = msg => App.ask(msg, { cancel: null });

  // Hojas apilables (p. ej. elegir producto encima del formulario de receta).
  const sheets = [];
  App.sheet = function (html, opts) {
    opts = opts || {};
    if (!opts.stack) App.closeAllSheets();
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.style.zIndex = 20 + sheets.length * 2;
    ov.innerHTML = `<div class="sheet" role="dialog"><div class="grabber"></div>${html}</div>`;
    ov.addEventListener('click', ev => { if (ev.target === ov) App.closeSheet(); });
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
    sheets.push(ov);
    return ov.querySelector('.sheet');
  };
  App.closeSheet = function () {
    const ov = sheets.pop();
    if (ov) ov.remove();
    if (!sheets.length) document.body.style.overflow = '';
  };
  App.closeAllSheets = function () { while (sheets.length) App.closeSheet(); };

  // Elimina un dato con opción de deshacer.
  App.removeWithUndo = function (kind, data, msg) {
    S.remove(kind, data);
    App.toast(msg || 'Eliminado', { undo: () => S.put(kind, data) });
  };

  // ---------- Navegación ----------
  const MODS = [
    { id: 'split', icon: '💶', name: 'Gastos', title: 'Gastos', subs: [['balance', 'Saldo'], ['moves', 'Movimientos'], ['stats', 'Resumen']] },
    { id: 'menu', icon: '📅', name: 'Menú', title: 'Menú semanal', subs: [] },
    { id: 'recipes', icon: '🍳', name: 'Recetas', title: 'Recetas', subs: [] },
    { id: 'shop', icon: '🛒', name: 'Compra', title: 'Compra', subs: [['list', 'Lista'], ['compare', 'Comparar'], ['prices', 'Precios'], ['savings', 'Ahorro']] },
    { id: 'settings', icon: '⚙️', name: 'Ajustes', title: 'Ajustes', subs: [] }
  ];
  const nav = (() => { try { return JSON.parse(localStorage.getItem('splitcarlis.nav')) || {}; } catch (e) { return {}; } })();
  App.nav = { mod: nav.mod || 'split', sub: Object.assign({ split: 'balance', menu: 'week', shop: 'list' }, nav.sub || {}) };
  const saveNav = () => { try { localStorage.setItem('splitcarlis.nav', JSON.stringify(App.nav)); } catch (e) {} };
  App.go = function (mod, sub) {
    App.nav.mod = mod;
    if (sub) App.nav.sub[mod] = sub;
    saveNav(); App.render(); window.scrollTo(0, 0);
  };

  const view = App.view = document.getElementById('view');
  const navEl = document.getElementById('nav');
  navEl.innerHTML = MODS.map(m => `<button data-mod="${m.id}"><span class="ic">${m.icon}</span>${m.name}</button>`).join('');
  navEl.querySelectorAll('[data-mod]').forEach(b => b.addEventListener('click', () => App.go(b.dataset.mod)));
  document.getElementById('syncBtn').addEventListener('click', () => { S.syncNow(); App.toast('Sincronizando…'); });
  const fab = document.getElementById('fab');
  fab.addEventListener('click', () => { if (App.fabAction) App.fabAction(); });

  function renderHeader() {
    const st = S.status(), pend = S.pending();
    const dot = document.getElementById('syncDot'), txt = document.getElementById('syncTxt');
    let cls = '', t = '';
    if (S.persistError && S.persistError()) { cls = 'err'; t = 'No se guarda en el móvil'; }
    else if (st === 'syncing') { cls = 'warn'; t = 'Sincronizando'; }
    else if (st === 'bad_secret') { cls = 'err'; t = 'Código no válido'; }
    else if (st === 'offline') { cls = 'warn'; t = pend ? `Sin conexión · ${pend}` : 'Sin conexión'; }
    else if (st === 'error') { cls = 'err'; t = pend ? `Error · ${pend}` : 'Error'; }
    else if (pend) { cls = 'warn'; t = `${pend} pendiente${pend > 1 ? 's' : ''}`; }
    else if (st === 'ok') { cls = 'ok'; t = 'Al día'; }
    else { t = '…'; }
    dot.className = 'dot ' + cls; txt.textContent = t;
    const mod = MODS.find(m => m.id === App.nav.mod) || MODS[0];
    document.getElementById('title').textContent = mod.title;
    const me = S.me() && App.person(S.me());
    document.getElementById('subtitle').textContent = me ? 'Hola, ' + me.name : 'Split Carlis';
  }
  App.renderHeader = renderHeader;

  function renderSubtabs(mod) {
    const el = document.getElementById('subtabs');
    if (!mod.subs.length) { el.innerHTML = ''; el.hidden = true; return; }
    el.hidden = false;
    const cur = App.nav.sub[mod.id];
    el.innerHTML = `<div class="seg">${mod.subs.map(([id, name]) => `<button data-sub="${id}" class="${id === cur ? 'on' : ''}">${name}</button>`).join('')}</div>`;
    el.querySelectorAll('[data-sub]').forEach(b => b.onclick = () => App.go(mod.id, b.dataset.sub));
  }

  let lastVersion = -1;
  S.onChange(() => {
    renderHeader();
    if (S.version() !== lastVersion) App.render();
  });

  // Si una pantalla falla, se muestra el error con un botón para recargar
  // (en lugar de que la app parezca no hacer nada).
  App.render = function () {
    try { renderInner(); } catch (e) { showFailure(e); }
  };
  function showFailure(e) {
    console.error(e);
    document.body.classList.remove('noapp');
    view.innerHTML = `<div class="card"><b>⚠️ Algo ha fallado al abrir esta sección.</b>
      <div class="muted" style="margin-top:6px">Suele arreglarse recargando la app. Si se repite, avisa con este mensaje:</div>
      <div class="note" style="word-break:break-word">${esc(e && (e.stack || e.message) || e).slice(0, 400)}</div>
      <button class="primary block" id="hardReload">🔄 Recargar la app</button></div>`;
    view.querySelector('#hardReload').onclick = App.hardReload;
  }
  // Recarga borrando la caché de la app (los datos no se tocan).
  App.hardReload = async function () {
    try {
      if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
      if (navigator.serviceWorker) for (const r of await navigator.serviceWorker.getRegistrations()) await r.update();
    } catch (e) { console.warn(e); }
    location.reload();
  };
  // Cualquier error inesperado se enseña (antes podía fallar un botón sin que se notara).
  const reportError = err => {
    console.error(err);
    if (!view.innerHTML.trim()) return showFailure(err);
    App.toast('⚠️ Algo ha fallado: ' + ((err && err.message) || err));
  };
  window.addEventListener('error', ev => reportError(ev.error || ev.message));
  window.addEventListener('unhandledrejection', ev => reportError(ev.reason));
  // Ejecuta una acción de guardar y, si falla, lo dice claramente.
  App.safely = function (what, fn) {
    try { return fn(); } catch (e) {
      console.error(e);
      App.notify(`No se ha podido ${what}.
${(e && e.message) || e}

Prueba Ajustes → Forzar actualización de la app y vuelve a intentarlo.`);
    }
  };

  function renderInner() {
    lastVersion = S.version();
    if (!S.loggedIn()) { document.body.classList.add('noapp'); return renderLogin(); }
    ensureSeed();
    if (!S.me() || !S.get(S.me())) { document.body.classList.add('noapp'); return renderWhoAmI(); }
    document.body.classList.remove('noapp');
    const mod = MODS.find(m => m.id === App.nav.mod) || MODS[0];
    if (mod.subs.length && !mod.subs.some(s => s[0] === App.nav.sub[mod.id])) App.nav.sub[mod.id] = mod.subs[0][0];
    renderHeader();
    renderSubtabs(mod);
    navEl.querySelectorAll('[data-mod]').forEach(b => b.classList.toggle('active', b.dataset.mod === mod.id));
    App.fabAction = null;
    // Conserva la posición de scroll al refrescar por sincronización.
    const y = window.scrollY;
    App.modules[mod.id].render(App.nav.sub[mod.id]);
    window.scrollTo(0, y);
    fab.hidden = !App.fabAction;
    if (S.status() === 'bad_secret') {
      view.insertAdjacentHTML('afterbegin', `<div class="banner">El código de casa ya no es válido. Ve a Ajustes → Cerrar sesión y vuelve a entrar con el código correcto.</div>`);
    }
  };

  // ---------- Datos iniciales ----------
  // v1: personas, grupos y categorías. v2: súpers, productos y recetas.
  // Solo tras haber descargado lo que hay en la nube, para no pisar datos existentes.
  function ensureSeed() {
    if (!S.lastSync()) return;
    const changes = [];
    if (!S.has('p-carlos') && !S.list('person').length) {
      D.people.forEach(p => changes.push({ kind: 'person', data: p }));
      D.groups.forEach(g => changes.push({ kind: 'group', data: g }));
      D.categories.forEach(c => changes.push({ kind: 'category', data: c }));
    }
    const st = App.settings();
    if ((st.catalogVersion || 1) < C.VERSION) {
      C.STORES.forEach(s => { if (!S.has(s.id)) changes.push({ kind: 'store', data: s }); });
      C.PRODUCTS.forEach(p => {
        const cur = S.get(p.id);
        if (!S.has(p.id)) changes.push({ kind: 'product', data: p });
        // v3: marca como esenciales los productos que ya existían (sin tocar los que hayáis decidido).
        else if (cur && p.essential && cur.essential === undefined) {
          changes.push({ kind: 'product', data: Object.assign({}, cur, { essential: true, every: p.every, essentialQty: p.essentialQty }) });
        }
      });
      C.RECIPES.forEach(r => { if (!S.has(r.id)) changes.push({ kind: 'recipe', data: r }); });
      changes.push({ kind: 'settings', data: Object.assign({}, S.get('settings') || D.settings, {
        catalogVersion: C.VERSION, habitualStore: st.habitualStore || 's-mercadona',
        meals: st.meals || C.MEALS.map(m => m.id), servings: st.servings || 2, pairThreshold: st.pairThreshold || 3
      }) });
    } else if (!S.has('settings')) changes.push({ kind: 'settings', data: D.settings });
    S.putMany(changes); // avisa una vez; el render que provoca ya ve todo creado
  }

  // ---------- Entrada con código ----------
  async function renderLogin() {
    document.getElementById('subtabs').hidden = true;
    view.innerHTML = `<div class="login"><img src="cats-wide.jpg?v=5" alt="Monchi y Hierba"><h1>Split Carlis</h1>
      <div class="muted">Gastos, menú y compra de casa · con Monchi y Hierba 🐱🐈‍⬛</div><div class="card" id="loginCard"><div class="muted">Conectando…</div></div></div>`;
    const card = view.querySelector('#loginCard');
    let serverState;
    try { serverState = await S.serverStatus(); } catch (e) {
      card.innerHTML = `<div>No hay conexión. La primera vez necesitas internet para entrar.</div>
        <button class="primary block" id="retry" style="margin-top:12px">Reintentar</button>`;
      card.querySelector('#retry').onclick = renderLogin;
      return;
    }
    const creating = serverState === 'new';
    card.innerHTML = creating
      ? `<b>Crea el código de casa</b><div class="muted" style="margin-top:4px">Es la contraseña que compartiréis Amparo y tú. Mínimo 6 caracteres. Apúntala: sin ella no se puede entrar.</div>
         <label>Código</label><input id="c1" type="password" autocomplete="new-password">
         <label>Repite el código</label><input id="c2" type="password" autocomplete="new-password">
         <button class="primary block" id="go" style="margin-top:14px">Crear y entrar</button>`
      : `<b>Introduce el código de casa</b><div class="muted" style="margin-top:4px">El mismo en los dos móviles.</div>
         <label>Código</label><input id="c1" type="password" autocomplete="current-password">
         <button class="primary block" id="go" style="margin-top:14px">Entrar</button>`;
    const go = card.querySelector('#go');
    const label = creating ? 'Crear y entrar' : 'Entrar';
    const submit = async () => {
      const c1 = card.querySelector('#c1').value;
      if (creating) {
        if (c1.length < 6) { App.toast('Mínimo 6 caracteres'); return; }
        if (c1 !== card.querySelector('#c2').value) { App.toast('Los códigos no coinciden'); return; }
      } else if (!c1) return;
      go.disabled = true; go.textContent = 'Comprobando…';
      try {
        const r = await S.login(c1, creating);
        if (r === 'created') { App.render(); App.notify('Código creado. Dáselo a Amparo para que entre desde su móvil.'); }
        else if (r === 'ok') App.render();
        else if (r === 'not_configured') renderLogin();
        else { App.toast(r === 'too_short' ? 'Mínimo 6 caracteres' : 'Código incorrecto'); go.disabled = false; go.textContent = label; }
      } catch (e) {
        App.toast(/too_many/.test(e.message) ? 'Demasiados intentos. Espera 10 minutos.' : 'Sin conexión. Inténtalo de nuevo.');
        go.disabled = false; go.textContent = label;
      }
    };
    go.onclick = submit;
    card.querySelectorAll('input').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); }));
  }

  function renderWhoAmI() {
    document.getElementById('subtabs').hidden = true;
    const ps = App.people();
    view.innerHTML = `<div class="login"><img src="cats-wide.jpg?v=5" alt="Monchi y Hierba"><h1>¿Quién eres?</h1>
      <div class="muted">Así la app sabe quién paga por defecto en este móvil.</div>
      <div class="card list">${ps.length ? ps.map(p => `<div class="item tap" data-me="${p.id}">${App.avatar(p)}<div class="grow"><b>${esc(p.name)}</b></div>›</div>`).join('')
        : '<div class="muted">Cargando…</div>'}</div></div>`;
    view.querySelectorAll('[data-me]').forEach(el => el.onclick = () => { S.setMe(el.dataset.me); App.render(); });
  }

  // ---------- Exportar ----------
  App.shareOrDownload = async function (filename, text, mime) {
    const blob = new Blob([text], { type: mime });
    try {
      const file = new File([blob], filename, { type: mime });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: filename }); return; }
    } catch (err) { if (err && err.name === 'AbortError') return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  App.start = function () {
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
    App.render();
  };
})();
