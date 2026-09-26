(function () {
  'use strict';
  const L = window.Logic, S = window.Store, D = window.DEFAULTS;
  const COLORS = ['#3b5bdb', '#c2255c', '#d9822b', '#2e8b57', '#1f7a8c', '#7048e8', '#c9a227', '#e03131', '#5c5f66', '#8d6e63'];

  // ---------- Acceso a datos ----------
  const byOrder = (a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name);
  const people = () => S.list('person').sort((a, b) => a.name.localeCompare(b.name));
  const groups = () => S.list('group').sort(byOrder);
  const categories = () => S.list('category').sort(byOrder);
  const expenses = () => S.list('expense');
  const payments = () => S.list('payment');
  const settings = () => S.get('settings') || D.settings;
  const rates = () => Object.assign({}, D.settings.rates, settings().rates);
  const person = id => S.get(id) || { id, name: '¿?', color: '#999' };
  const group = id => S.get(id) || { id, name: 'Sin grupo', emoji: '❔' };
  const category = id => S.get(id) || { id, name: 'Sin categoría', emoji: '📦' };
  const state = () => ({ people: people(), expenses: expenses(), payments: payments() });

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const monthOf = d => (d || '').slice(0, 7);

  function ensureSeed() {
    // Solo tras haber descargado lo que hay en la nube, para no pisar datos existentes.
    if (!S.lastSync() || S.has('p-carlos') || S.list('person').length) return;
    D.people.forEach(p => S.put('person', p));
    D.groups.forEach(g => S.put('group', g));
    D.categories.forEach(c => S.put('category', c));
    if (!S.has('settings')) S.put('settings', D.settings);
  }

  // ---------- Formato ----------
  const eurFmt = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
  const eur = cents => eurFmt.format(cents / 100);
  const money = (amount, cur) => {
    try {
      return new Intl.NumberFormat('es-ES', { style: 'currency', currency: cur || 'EUR', currencyDisplay: 'narrowSymbol',
        maximumFractionDigits: L.decimalsOf(cur), minimumFractionDigits: L.decimalsOf(cur) }).format(amount);
    } catch (e) { return amount + ' ' + cur; }
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initials = n => (n || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const avatar = (p, sm) => `<div class="avatar${sm ? ' sm' : ''}" style="background:${esc(p.color)}">${esc(initials(p.name))}</div>`;
  const fmtDate = d => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: d.slice(0, 4) === today().slice(0, 4) ? undefined : 'numeric' });
  const fmtMonth = m => { const s = new Date(m + '-15T12:00:00').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }); return s[0].toUpperCase() + s.slice(1); };
  const balPill = c => c > 0 ? `<span class="pill pos">le deben ${eur(c)}</span>`
    : c < 0 ? `<span class="pill neg">debe ${eur(-c)}</span>` : `<span class="pill zero">en paz</span>`;

  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2400);
  }

  // Diálogo propio (confirm/alert del navegador fallan en apps instaladas).
  function ask(msg, opts) {
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
  }
  const confirmDelete = msg => ask(msg, { ok: 'Eliminar', danger: true });
  const notify = msg => ask(msg, { cancel: null });

  // ---------- Hoja modal ----------
  let sheetEl = null;
  function sheet(html) {
    closeSheet();
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `<div class="sheet" role="dialog">${html}</div>`;
    ov.addEventListener('click', ev => { if (ev.target === ov) closeSheet(); });
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
    sheetEl = ov;
    return ov.querySelector('.sheet');
  }
  function closeSheet() {
    if (sheetEl) sheetEl.remove();
    sheetEl = null;
    document.body.style.overflow = '';
  }

  // ---------- Navegación y cabecera ----------
  let tab = 'balance';
  const filters = { group: '', month: '', text: '', statsMonth: monthOf(today()) };
  const view = document.getElementById('view');
  document.querySelectorAll('nav.tabs button').forEach(b => b.addEventListener('click', () => {
    tab = b.dataset.tab; render(); window.scrollTo(0, 0);
  }));
  document.getElementById('fab').addEventListener('click', () => openExpense());
  document.getElementById('syncBtn').addEventListener('click', () => { S.syncNow(); toast('Sincronizando…'); });

  function renderHeader() {
    const st = S.status(), pend = S.pending();
    const dot = document.getElementById('syncDot'), txt = document.getElementById('syncTxt');
    let cls = '', t = '';
    if (st === 'syncing') { cls = 'warn'; t = 'Sincronizando…'; }
    else if (st === 'bad_secret') { cls = 'err'; t = 'Código no válido'; }
    else if (st === 'offline') { cls = 'warn'; t = pend ? `Sin conexión · ${pend} pend.` : 'Sin conexión'; }
    else if (st === 'error') { cls = 'err'; t = pend ? `Error · ${pend} pend.` : 'Error de conexión'; }
    else if (pend) { cls = 'warn'; t = `${pend} pendiente${pend > 1 ? 's' : ''}`; }
    else if (st === 'ok') { cls = 'ok'; t = 'Sincronizado'; }
    else { t = '…'; }
    dot.className = 'dot ' + cls; txt.textContent = t;
    const me = S.me() && person(S.me());
    document.getElementById('subtitle').textContent = me ? 'Hola, ' + me.name : '';
  }

  let lastVersion = -1;
  S.onChange(() => {
    renderHeader();
    if (S.version() !== lastVersion) render();
  });

  function render() {
    lastVersion = S.version();
    if (!S.loggedIn()) { document.body.classList.add('noapp'); return renderLogin(); }
    ensureSeed();
    if (!S.me() || !S.get(S.me())) { document.body.classList.add('noapp'); return renderWhoAmI(); }
    document.body.classList.remove('noapp');
    renderHeader();
    document.querySelectorAll('nav.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    ({ balance: renderBalance, moves: renderMoves, stats: renderStats, settings: renderSettings })[tab]();
    if (S.status() === 'bad_secret') {
      view.insertAdjacentHTML('afterbegin', `<div class="banner">El código de casa ya no es válido. Ve a Ajustes → Cerrar sesión y vuelve a entrar con el código correcto.</div>`);
    }
  }

  // ---------- Entrada con código ----------
  let serverState = null;
  async function renderLogin() {
    view.innerHTML = `<div class="login"><img src="icon-512.png" alt="Monchi"><h1>Split Carlis</h1>
      <div class="muted">Gastos compartidos de casa, ocio y viajes</div><div class="card" id="loginCard"><div class="muted">Conectando…</div></div></div>`;
    const card = view.querySelector('#loginCard');
    try {
      serverState = await S.serverStatus();
    } catch (e) {
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
    const submit = async () => {
      const c1 = card.querySelector('#c1').value;
      if (creating) {
        if (c1.length < 6) { toast('Mínimo 6 caracteres'); return; }
        if (c1 !== card.querySelector('#c2').value) { toast('Los códigos no coinciden'); return; }
      } else if (!c1) return;
      go.disabled = true; go.textContent = 'Comprobando…';
      try {
        const r = await S.login(c1, creating);
        if (r === 'created') { render(); notify('Código creado. Dáselo a Amparo para que entre desde su móvil.'); }
        else if (r === 'ok') { render(); }
        else if (r === 'not_configured') { renderLogin(); }
        else { toast(r === 'too_short' ? 'Mínimo 6 caracteres' : 'Código incorrecto'); go.disabled = false; go.textContent = creating ? 'Crear y entrar' : 'Entrar'; }
      } catch (e) {
        toast(/too_many/.test(e.message) ? 'Demasiados intentos. Espera 10 minutos.' : 'Sin conexión. Inténtalo de nuevo.');
        go.disabled = false; go.textContent = creating ? 'Crear y entrar' : 'Entrar';
      }
    };
    go.onclick = submit;
    card.querySelectorAll('input').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); }));
  }

  function renderWhoAmI() {
    const ps = people();
    view.innerHTML = `<div class="login"><img src="icon-512.png" alt="Monchi"><h1>¿Quién eres?</h1>
      <div class="muted">Así la app sabe quién paga por defecto en este móvil.</div>
      <div class="card list">${ps.length ? ps.map(p => `<div class="item tap" data-me="${p.id}">${avatar(p)}<div class="grow"><b>${esc(p.name)}</b></div>›</div>`).join('')
        : '<div class="muted">Cargando…</div>'}</div></div>`;
    view.querySelectorAll('[data-me]').forEach(el => el.onclick = () => { S.setMe(el.dataset.me); render(); });
  }

  // ---------- Saldo ----------
  function renderBalance() {
    const ps = people(), me = S.me();
    const { bal, paid, owed } = L.computeBalances(state());
    const plan = L.settleUp(bal);
    let hero;
    if (ps.length === 2) {
      const other = ps.find(p => p.id !== me), b = bal[me] || 0;
      hero = b > 0 ? `<div class="muted">${esc(other.name)} te debe</div><div class="big pos">${eur(b)}</div>`
        : b < 0 ? `<div class="muted">Le debes a ${esc(other.name)}</div><div class="big neg">${eur(-b)}</div>`
        : `<div class="big">Estáis en paz 🐱</div><div class="muted">Nadie debe nada</div>`;
    } else {
      const b = bal[me] || 0;
      hero = b > 0 ? `<div class="muted">Te deben</div><div class="big pos">${eur(b)}</div>`
        : b < 0 ? `<div class="muted">Debes</div><div class="big neg">${eur(-b)}</div>` : `<div class="big">En paz 🐱</div>`;
    }
    let h = `<div class="card hero">${hero}</div>`;
    if (plan.length) {
      h += `<h2>Para quedar en paz</h2><div class="card list">`;
      plan.forEach((t, i) => {
        const a = person(t.from), b = person(t.to);
        h += `<div class="item">${avatar(a, 1)}<div class="grow"><b>${esc(a.name)}</b> → <b>${esc(b.name)}</b><div class="muted">${eur(t.cents)}</div></div>
          <button class="small primary" data-settle="${i}">Saldar</button></div>`;
      });
      h += `</div>`;
    }
    h += `<h2>Cada uno</h2><div class="card list">`;
    ps.forEach(p => {
      h += `<div class="item">${avatar(p)}<div class="grow"><b>${esc(p.name)}</b>
        <div class="muted">Ha pagado ${eur(paid[p.id] || 0)} · Su parte ${eur(owed[p.id] || 0)}</div></div>${balPill(bal[p.id] || 0)}</div>`;
    });
    h += `</div>`;
    // Este mes por grupo
    const m = monthOf(today());
    const byGroup = {};
    let totalMonth = 0;
    expenses().filter(e => monthOf(e.date) === m).forEach(e => {
      const t = L.expenseShares(e).total; totalMonth += t;
      byGroup[e.group] = (byGroup[e.group] || 0) + t;
    });
    h += `<h2>${esc(fmtMonth(m))}</h2><div class="card list">`;
    if (!totalMonth) h += `<div class="muted">Aún no hay gastos este mes.</div>`;
    else {
      Object.entries(byGroup).sort((a, b) => b[1] - a[1]).forEach(([g, c]) => {
        const gg = group(g);
        h += `<div class="item"><div class="emoji">${esc(gg.emoji)}</div><div class="grow">${esc(gg.name)}</div><div class="amount">${eur(c)}</div></div>`;
      });
      h += `<div class="item"><div class="emoji">Σ</div><div class="grow"><b>Total</b></div><div class="amount">${eur(totalMonth)}</div></div>`;
    }
    h += `</div><button class="block" id="addPayment" style="margin-top:6px">💸 Registrar un pago entre vosotros</button>`;
    view.innerHTML = h;
    view.querySelectorAll('[data-settle]').forEach(el => el.onclick = () => {
      const t = plan[+el.dataset.settle];
      openPayment({ from: t.from, to: t.to, amount: t.cents / 100, note: 'Saldar cuentas' });
    });
    view.querySelector('#addPayment').onclick = () => openPayment();
  }

  // ---------- Movimientos ----------
  function renderMoves() {
    const gs = groups();
    const allMonths = [...new Set([...expenses(), ...payments()].map(x => monthOf(x.date)))].sort().reverse();
    const txt = filters.text.trim().toLowerCase();
    const items = [
      ...expenses().map(e => ({ kind: 'exp', d: e.date, t: e.createdAt || 0, e })),
      ...payments().map(p => ({ kind: 'pay', d: p.date, t: p.createdAt || 0, p }))
    ].filter(it => {
      if (filters.month && monthOf(it.d) !== filters.month) return false;
      if (filters.group) { if (it.kind !== 'exp' || it.e.group !== filters.group) return false; }
      if (txt) {
        const hay = it.kind === 'exp' ? (it.e.description + ' ' + category(it.e.category).name) : ('pago ' + (it.p.note || ''));
        if (!hay.toLowerCase().includes(txt)) return false;
      }
      return true;
    }).sort((a, b) => (b.d || '').localeCompare(a.d || '') || b.t - a.t);

    let h = `<div class="chips scroll-x" style="margin-top:4px"><button data-g="" class="${!filters.group ? 'on' : ''}">Todo</button>`;
    gs.forEach(g => { h += `<button data-g="${g.id}" class="${filters.group === g.id ? 'on' : ''}">${esc(g.emoji)} ${esc(g.name)}</button>`; });
    h += `</div><div class="row" style="margin-top:8px"><select id="month" class="grow"><option value="">Todos los meses</option>
      ${allMonths.map(m => `<option value="${m}" ${filters.month === m ? 'selected' : ''}>${esc(fmtMonth(m))}</option>`).join('')}</select>
      <input id="q" class="grow" placeholder="🔍 Buscar" value="${esc(filters.text)}"></div>`;
    const total = items.filter(i => i.kind === 'exp').reduce((a, i) => a + L.expenseShares(i.e).total, 0);
    if (items.length) h += `<div class="muted" style="margin-top:8px">${items.length} movimiento${items.length > 1 ? 's' : ''} · gastos ${eur(total)}</div>`;
    if (!items.length) {
      h += `<div class="card empty">No hay movimientos${filters.group || filters.month || txt ? ' con estos filtros' : '. Pulsa <b>+</b> para añadir un gasto'}.</div>`;
    } else {
      let lastDate = null;
      items.forEach(it => {
        if (it.d !== lastDate) {
          if (lastDate !== null) h += `</div>`;
          h += `<div class="datehdr">${esc(fmtDate(it.d))}</div><div class="card list">`;
          lastDate = it.d;
        }
        if (it.kind === 'exp') {
          const e = it.e, c = category(e.category), g = group(e.group), payer = person(e.paidBy);
          const { total } = L.expenseShares(e);
          h += `<div class="item tap" data-exp="${e.id}"><div class="emoji">${esc(c.emoji)}</div>
            <div class="grow"><div class="ellipsis"><b>${esc(e.description)}</b></div>
            <div class="muted ellipsis">${esc(g.emoji)} ${esc(c.name)} · pagó ${esc(payer.name)}${splitLabel(e)}</div></div>
            <div class="amount">${money(e.amount, e.currency)}${e.currency !== 'EUR' ? `<div class="muted">${eur(total)}</div>` : ''}</div></div>`;
        } else {
          const p = it.p, a = person(p.from), b = person(p.to);
          h += `<div class="item tap" data-pay="${p.id}"><div class="emoji">💸</div>
            <div class="grow"><div class="ellipsis"><b>${esc(a.name)}</b> pagó a <b>${esc(b.name)}</b></div>
            <div class="muted ellipsis">${esc(p.note || 'Pago')}</div></div>
            <div class="amount pos">${money(p.amount, p.currency || 'EUR')}</div></div>`;
        }
      });
      h += `</div>`;
    }
    view.innerHTML = h;
    view.querySelectorAll('[data-g]').forEach(el => el.onclick = () => { filters.group = el.dataset.g; render(); });
    view.querySelector('#month').onchange = ev => { filters.month = ev.target.value; render(); };
    const q = view.querySelector('#q');
    q.oninput = () => { filters.text = q.value; clearTimeout(q._t); q._t = setTimeout(() => { render(); const n = view.querySelector('#q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 350); };
    view.querySelectorAll('[data-exp]').forEach(el => el.onclick = () => openExpense(S.get(el.dataset.exp)));
    view.querySelectorAll('[data-pay]').forEach(el => el.onclick = () => openPayment(S.get(el.dataset.pay)));
  }

  function splitLabel(e) {
    const ids = Object.keys(L.expenseShares(e).shares);
    if (ids.length === 1) return ' · solo ' + esc(person(ids[0]).name);
    if (e.mode === 'percent') return ' · ' + ids.map(id => esc(person(id).name[0]) + ' ' + (+e.split[id]) + '%').join('/');
    if (e.mode === 'exact') return ' · importes';
    return '';
  }

  // ---------- Resumen ----------
  function renderStats() {
    const allMonths = [...new Set(expenses().map(x => monthOf(x.date)))];
    if (!allMonths.includes(monthOf(today()))) allMonths.push(monthOf(today()));
    allMonths.sort().reverse();
    const m = filters.statsMonth;
    const exps = expenses().filter(e => !m || monthOf(e.date) === m);
    const byGroup = {}, byCat = {}, paid = {}, owed = {};
    let total = 0;
    exps.forEach(e => {
      const { total: t, shares } = L.expenseShares(e);
      total += t;
      byGroup[e.group] = (byGroup[e.group] || 0) + t;
      byCat[e.category] = (byCat[e.category] || 0) + t;
      paid[e.paidBy] = (paid[e.paidBy] || 0) + t;
      Object.entries(shares).forEach(([id, c]) => { owed[id] = (owed[id] || 0) + c; });
    });
    const bars = (obj, lookup) => {
      const max = Math.max(1, ...Object.values(obj));
      return Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, v]) => {
        const x = lookup(k);
        return `<div style="margin:8px 0"><div class="row"><div class="grow ellipsis">${esc(x.emoji)} ${esc(x.name)}</div><div class="amount">${eur(v)}</div></div>
          <div class="bar"><span style="width:${(v / max * 100).toFixed(1)}%"></span></div></div>`;
      }).join('');
    };
    let h = `<select id="smonth" style="margin-top:4px"><option value="">Todo el tiempo</option>
      ${allMonths.map(x => `<option value="${x}" ${m === x ? 'selected' : ''}>${esc(fmtMonth(x))}</option>`).join('')}</select>
      <div class="card hero"><div class="muted">Total gastado</div><div class="big">${eur(total)}</div>
      <div class="muted">${exps.length} gasto${exps.length === 1 ? '' : 's'}</div></div>`;
    if (total) {
      h += `<h2>Por grupo</h2><div class="card">${bars(byGroup, group)}</div>`;
      h += `<h2>Por categoría</h2><div class="card">${bars(byCat, category)}</div>`;
      h += `<h2>Por persona</h2><div class="card list">`;
      people().forEach(p => {
        h += `<div class="item">${avatar(p, 1)}<div class="grow">${esc(p.name)}</div><div class="amount">
          <div>Pagó ${eur(paid[p.id] || 0)}</div><div class="muted">Su parte ${eur(owed[p.id] || 0)}</div></div></div>`;
      });
      h += `</div>`;
    }
    // Evolución: últimos 12 meses
    const months = [];
    const d = new Date(today() + 'T12:00:00'); d.setDate(15);
    for (let i = 0; i < 12; i++) { months.unshift(d.toISOString().slice(0, 7)); d.setMonth(d.getMonth() - 1); }
    const perMonth = {};
    expenses().forEach(e => { const k = monthOf(e.date); if (months.includes(k)) perMonth[k] = (perMonth[k] || 0) + L.expenseShares(e).total; });
    const maxM = Math.max(1, ...Object.values(perMonth));
    h += `<h2>Últimos 12 meses</h2><div class="card"><div style="display:flex;align-items:flex-end;gap:4px;height:120px">
      ${months.map(k => `<div title="${esc(fmtMonth(k))}: ${eur(perMonth[k] || 0)}" data-m="${k}" style="flex:1;cursor:pointer;background:${k === m ? 'var(--accent)' : 'var(--accent-soft)'};border-radius:4px 4px 0 0;height:${Math.max(2, (perMonth[k] || 0) / maxM * 100)}%"></div>`).join('')}
      </div><div style="display:flex;gap:4px;margin-top:4px">${months.map(k => `<div class="muted" style="flex:1;text-align:center;font-size:10px">${new Date(k + '-15').toLocaleDateString('es-ES', { month: 'narrow' })}</div>`).join('')}</div></div>`;
    view.innerHTML = h;
    view.querySelector('#smonth').onchange = ev => { filters.statsMonth = ev.target.value; render(); };
    view.querySelectorAll('[data-m]').forEach(el => el.onclick = () => { filters.statsMonth = el.dataset.m; render(); });
  }

  // ---------- Formulario de gasto ----------
  function openExpense(existing) {
    const ps = people();
    const isNew = !existing;
    const lastGroup = (() => { try { return localStorage.getItem('splitcarlis.lastGroup'); } catch (e) { return null; } })();
    const e = existing ? JSON.parse(JSON.stringify(existing)) : {
      id: uid(), description: '', amount: '', currency: 'EUR', rate: 1, paidBy: S.me() || ps[0].id,
      date: today(), group: (lastGroup && S.get(lastGroup)) ? lastGroup : 'g-casa', category: '', mode: 'equal', split: {}, createdAt: Date.now()
    };
    let showAllCats = false;
    const vals = { equal: {}, exact: {}, percent: {} };
    ps.forEach(p => { vals.equal[p.id] = true; vals.exact[p.id] = ''; vals.percent[p.id] = ''; });
    if (!isNew) {
      if (e.mode === 'equal') ps.forEach(p => { vals.equal[p.id] = !!e.split[p.id]; });
      else Object.entries(e.split).forEach(([k, v]) => { vals[e.mode][k] = v; });
    }
    const curs = ['EUR', ...Object.keys(rates()).sort()];
    if (!curs.includes(e.currency)) curs.push(e.currency);

    const m = sheet(`<h3>${isNew ? 'Nuevo gasto' : 'Editar gasto'}</h3>
      <label>Descripción</label><input id="desc" value="${esc(e.description)}" placeholder="Ej: Mercadona" maxlength="60" autocomplete="off">
      <label>Importe</label>
      <div class="row"><input id="amt" type="number" inputmode="decimal" step="any" min="0" value="${esc(e.amount)}" placeholder="0" class="grow">
        <select id="cur" style="width:105px">${curs.map(c => `<option ${c === e.currency ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
      <div id="rateBox"><label id="rateLbl"></label><input id="rate" type="number" inputmode="decimal" step="any" value="${esc(e.currency === 'EUR' ? '' : e.rate)}">
        <div class="muted" id="conv" style="margin-top:4px"></div></div>
      <label>Pagado por</label><div class="seg" id="payer">${ps.map(p => `<button data-payer="${p.id}">${esc(p.name)}</button>`).join('')}</div>
      <label>Fecha</label><input id="date" type="date" value="${esc(e.date)}">
      <label>Grupo</label><div class="chips" id="groups"></div>
      <label>Categoría</label><div class="chips" id="cats"></div>
      <label>¿Cómo se reparte?</label>
      <div class="seg"><button data-mode="equal">A partes iguales</button><button data-mode="percent">%</button><button data-mode="exact">Importes</button></div>
      <div id="splitBox"></div><div class="hint" id="splitHint"></div>
      <div class="actions">${isNew ? '' : '<button class="danger" id="del">Eliminar</button>'}<button id="cancel">Cancelar</button><button class="primary" id="ok">Guardar</button></div>`);
    const $ = s => m.querySelector(s);
    const readAmount = () => parseFloat($('#amt').value) || 0;
    const readRate = () => e.currency === 'EUR' ? 1 : (parseFloat($('#rate').value) || 0);

    function build() {
      const split = {};
      ps.forEach(p => {
        if (e.mode === 'equal') { if (vals.equal[p.id]) split[p.id] = true; }
        else { const v = parseFloat(vals[e.mode][p.id]); if (v > 0) split[p.id] = v; }
      });
      return Object.assign({}, e, { description: $('#desc').value.trim(), amount: readAmount(), rate: readRate(),
        date: $('#date').value || today(), split });
    }

    function renderGroupsCats() {
      const gs = groups().filter(g => !g.archived || g.id === e.group);
      $('#groups').innerHTML = gs.map(g => `<button data-grp="${g.id}" class="${g.id === e.group ? 'on' : ''}">${esc(g.emoji)} ${esc(g.name)}</button>`).join('');
      const all = categories();
      let cs = showAllCats ? all : all.filter(c => !c.group || c.group === e.group || c.id === e.category);
      $('#cats').innerHTML = cs.map(c => `<button data-cat="${c.id}" class="${c.id === e.category ? 'on' : ''}">${esc(c.emoji)} ${esc(c.name)}</button>`).join('')
        + (cs.length < all.length ? `<button data-allcats>Ver todas…</button>` : '');
      m.querySelectorAll('[data-grp]').forEach(b => b.onclick = () => { e.group = b.dataset.grp; showAllCats = false; renderGroupsCats(); });
      m.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { e.category = b.dataset.cat; renderGroupsCats(); });
      const allBtn = m.querySelector('[data-allcats]');
      if (allBtn) allBtn.onclick = () => { showAllCats = true; renderGroupsCats(); };
    }

    function refreshTop() {
      m.querySelectorAll('[data-payer]').forEach(b => b.classList.toggle('on', b.dataset.payer === e.paidBy));
      m.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === e.mode));
      $('#rateBox').style.display = e.currency === 'EUR' ? 'none' : '';
      $('#rateLbl').textContent = `Tipo de cambio (1 € = ? ${e.currency})`;
      const a = readAmount(), r = readRate();
      $('#conv').textContent = e.currency !== 'EUR' && a > 0 && r > 0 ? `≈ ${eur(L.toEurCents(a, e.currency, r))}` : '';
    }

    function renderSplit() {
      const box = $('#splitBox');
      const step = L.decimalsOf(e.currency) ? '0.01' : '1';
      box.innerHTML = ps.map(p => {
        const ctl = e.mode === 'equal'
          ? `<input type="checkbox" data-sp="${p.id}" ${vals.equal[p.id] ? 'checked' : ''}>`
          : `<input type="number" inputmode="decimal" step="${e.mode === 'percent' ? 'any' : step}" min="0" data-sp="${p.id}" value="${esc(vals[e.mode][p.id])}" placeholder="0"><span>${e.mode === 'percent' ? '%' : esc(e.currency)}</span>`;
        return `<label class="split-row">${avatar(p, 1)}<span class="grow ellipsis">${esc(p.name)}</span><span class="muted" data-share="${p.id}"></span>${ctl}</label>`;
      }).join('');
      if (e.mode === 'percent' && ps.length === 2) {
        box.insertAdjacentHTML('beforeend', `<div class="chips" style="margin-top:8px">${[[50, 50], [60, 40], [40, 60], [70, 30], [30, 70]].map(([a, b]) =>
          `<button data-pct="${a}">${esc(ps[0].name[0])} ${a} / ${esc(ps[1].name[0])} ${b}</button>`).join('')}</div>`);
        box.querySelectorAll('[data-pct]').forEach(b => b.onclick = ev => {
          ev.preventDefault(); vals.percent[ps[0].id] = b.dataset.pct; vals.percent[ps[1].id] = String(100 - b.dataset.pct); renderSplit();
        });
      } else if (e.mode === 'equal' && ps.length === 2) {
        box.insertAdjacentHTML('beforeend', `<div class="chips" style="margin-top:8px"><button data-only="">A medias</button>${ps.map(p => `<button data-only="${p.id}">Solo ${esc(p.name)}</button>`).join('')}</div>`);
        box.querySelectorAll('[data-only]').forEach(b => b.onclick = ev => {
          ev.preventDefault(); ps.forEach(p => { vals.equal[p.id] = !b.dataset.only || b.dataset.only === p.id; }); renderSplit();
        });
      } else if (e.mode === 'exact') {
        box.insertAdjacentHTML('beforeend', `<button class="small" id="fillRest" style="margin-top:8px">Poner lo que falta en los vacíos</button>`);
        $('#fillRest').onclick = ev => { ev.preventDefault(); fillRest(); };
      }
      box.querySelectorAll('[data-sp]').forEach(inp => {
        inp.addEventListener(inp.type === 'checkbox' ? 'change' : 'input', () => {
          vals[e.mode][inp.dataset.sp] = inp.type === 'checkbox' ? inp.checked : inp.value;
          // Con dos personas en %, completa automáticamente la otra parte.
          if (e.mode === 'percent' && ps.length === 2 && inp.value !== '') {
            const other = ps.find(p => p.id !== inp.dataset.sp).id;
            const v = parseFloat(inp.value);
            if (v >= 0 && v <= 100) { vals.percent[other] = String(+(100 - v).toFixed(2)); const o = box.querySelector(`[data-sp="${other}"]`); if (o) o.value = vals.percent[other]; }
          }
          refreshShares();
        });
      });
      refreshShares();
    }

    function fillRest() {
      const target = readAmount();
      const empty = ps.map(p => p.id).filter(id => !(parseFloat(vals.exact[id]) > 0));
      if (!empty.length || !(target > 0)) return;
      const used = ps.reduce((a, p) => a + (parseFloat(vals.exact[p.id]) || 0), 0);
      const rest = target - used;
      if (rest <= 0) { toast('No queda nada por repartir'); return; }
      const unit = Math.pow(10, L.decimalsOf(e.currency));
      const parts = L.distribute(Math.round(rest * unit), empty.map(() => 1));
      empty.forEach((id, i) => { vals.exact[id] = String(parts[i] / unit); });
      renderSplit();
    }

    function refreshShares() {
      const exp = build();
      const hint = $('#splitHint');
      let msg = '', ok = true;
      if (e.mode === 'equal') {
        const n = Object.keys(exp.split).length;
        msg = n ? (n === ps.length ? 'A partes iguales entre todos' : `Solo ${Object.keys(exp.split).map(id => person(id).name).join(', ')}`) : 'Marca al menos a una persona';
        ok = n > 0;
      } else {
        const sum = Object.values(exp.split).reduce((a, b) => a + b, 0);
        const target = e.mode === 'percent' ? 100 : exp.amount;
        const diff = +(target - sum).toFixed(2);
        const fmt = v => e.mode === 'percent' ? (+v.toFixed(2)) + '%' : money(v, e.currency);
        if (Math.abs(diff) < (e.mode === 'exact' && !L.decimalsOf(e.currency) ? 0.5 : 0.005)) msg = '✔ Cuadra';
        else { ok = false; msg = diff > 0 ? `Faltan ${fmt(diff)} por asignar` : `Te pasas en ${fmt(-diff)}`; }
      }
      const valid = exp.amount > 0 && exp.rate > 0;
      const shares = valid ? L.expenseShares(exp).shares : {};
      m.querySelectorAll('[data-share]').forEach(el => { const c = shares[el.dataset.share]; el.textContent = c ? eur(c) : ''; });
      hint.textContent = msg;
      hint.className = 'hint ' + (ok ? 'pos' : 'neg');
    }

    m.querySelectorAll('[data-payer]').forEach(b => b.onclick = () => { e.paidBy = b.dataset.payer; refreshTop(); });
    m.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { e.mode = b.dataset.mode; refreshTop(); renderSplit(); });
    $('#cur').onchange = () => {
      e.currency = $('#cur').value;
      $('#rate').value = e.currency === 'EUR' ? '' : (rates()[e.currency] || '');
      refreshTop(); renderSplit();
    };
    ['#amt', '#rate'].forEach(s => $(s).addEventListener('input', () => { refreshTop(); refreshShares(); }));
    $('#cancel').onclick = closeSheet;
    $('#ok').onclick = () => {
      const exp = build();
      if (!exp.category) { toast('Elige una categoría'); return; }
      const err = L.validateExpense(exp);
      if (err) { toast(err); return; }
      S.put('expense', exp);
      if (exp.currency !== 'EUR' && rates()[exp.currency] !== exp.rate) {
        const st = Object.assign({}, settings()); st.rates = Object.assign({}, rates(), { [exp.currency]: exp.rate });
        S.put('settings', st);
      }
      try { localStorage.setItem('splitcarlis.lastGroup', exp.group); } catch (x) {}
      closeSheet(); toast('Gasto guardado');
    };
    const del = $('#del');
    if (del) del.onclick = async () => {
      if (!await confirmDelete('¿Eliminar este gasto?')) return;
      S.remove('expense', existing);
      closeSheet(); toast('Gasto eliminado');
    };
    renderGroupsCats(); refreshTop(); renderSplit();
    if (isNew) setTimeout(() => $('#desc').focus(), 80);
  }

  // ---------- Formulario de pago ----------
  function openPayment(existing) {
    const ps = people(), me = S.me();
    const isNew = !existing || !existing.id;
    const other = (ps.find(p => p.id !== me) || ps[0]).id;
    const p = Object.assign({ id: uid(), from: me, to: other, amount: '', currency: 'EUR', rate: 1, date: today(), note: '', createdAt: Date.now() }, existing || {});
    const opts = sel => ps.map(x => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
    const m = sheet(`<h3>${isNew ? 'Registrar pago' : 'Editar pago'}</h3>
      <div class="muted">Dinero que uno le da al otro para saldar cuentas.</div>
      <label>Quién paga</label><select id="from">${opts(p.from)}</select>
      <label>A quién</label><select id="to">${opts(p.to)}</select>
      <label>Importe (€)</label><input id="amt" type="number" inputmode="decimal" step="any" value="${esc(p.amount === '' ? '' : +(+p.amount).toFixed(2))}">
      <label>Fecha</label><input id="date" type="date" value="${esc(p.date)}">
      <label>Nota</label><input id="note" value="${esc(p.note)}" maxlength="60" placeholder="Opcional (Bizum, transferencia…)">
      <div class="actions">${isNew ? '' : '<button class="danger" id="del">Eliminar</button>'}<button id="cancel">Cancelar</button><button class="primary" id="ok">Guardar</button></div>`);
    const $ = s => m.querySelector(s);
    $('#cancel').onclick = closeSheet;
    $('#ok').onclick = () => {
      const np = Object.assign({}, p, { from: $('#from').value, to: $('#to').value, amount: parseFloat($('#amt').value) || 0,
        currency: 'EUR', rate: 1, date: $('#date').value || today(), note: $('#note').value.trim() });
      if (np.from === np.to) { toast('Quien paga y quien recibe deben ser distintos'); return; }
      if (!(np.amount > 0)) { toast('Importe no válido'); return; }
      S.put('payment', np);
      closeSheet(); toast('Pago registrado');
    };
    const del = $('#del');
    if (del) del.onclick = async () => {
      if (!await confirmDelete('¿Eliminar este pago?')) return;
      S.remove('payment', existing);
      closeSheet(); toast('Pago eliminado');
    };
  }

  // ---------- Ajustes ----------
  function renderSettings() {
    const ps = people(), me = S.me();
    const last = S.lastSync() ? new Date(S.lastSync()).toLocaleString('es-ES') : 'nunca';
    const r = rates();
    let h = `<h2>En este móvil eres</h2><div class="seg">${ps.map(p => `<button data-me="${p.id}" class="${p.id === me ? 'on' : ''}">${esc(p.name)}</button>`).join('')}</div>
      <h2>Personas</h2><div class="card list">${ps.map(p => `<div class="item tap" data-person="${p.id}">${avatar(p)}<div class="grow"><b>${esc(p.name)}</b></div>›</div>`).join('')}</div>
      <button class="block small" id="addPerson">＋ Añadir persona</button>
      <h2>Grupos</h2><div class="card list">${groups().map(g => `<div class="item tap" data-group="${g.id}"><div class="emoji">${esc(g.emoji)}</div><div class="grow">${esc(g.name)}${g.archived ? ' <span class="muted">(archivado)</span>' : ''}</div>›</div>`).join('')}</div>
      <button class="block small" id="addGroup">＋ Añadir grupo (p. ej. un viaje)</button>
      <h2>Categorías</h2><div class="card list">${categories().map(c => `<div class="item tap" data-cat="${c.id}"><div class="emoji">${esc(c.emoji)}</div><div class="grow">${esc(c.name)}<div class="muted">${c.group ? esc(group(c.group).name) : 'Todos los grupos'}</div></div>›</div>`).join('')}</div>
      <button class="block small" id="addCat">＋ Añadir categoría</button>
      <h2>Monedas (unidades por 1 €)</h2><div class="card">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px">
        ${Object.keys(r).sort().map(c => `<label class="row" style="margin:0;color:var(--text)"><span style="width:44px">${c}</span><input data-rate="${c}" type="number" inputmode="decimal" step="any" value="${r[c]}"></label>`).join('')}</div>
        <div class="row" style="margin-top:10px"><input id="newCur" placeholder="Otra (código, p. ej. AUD)" maxlength="3" style="text-transform:uppercase"><button class="small" id="addCur">Añadir</button></div>
        <button class="primary block" id="saveRates" style="margin-top:10px">Guardar tipos de cambio</button></div>
      <h2>Sincronización</h2><div class="card">
        <div>Última sincronización: <b>${esc(last)}</b></div>
        <div class="muted">Cambios pendientes de subir: ${S.pending()}</div>
        <button class="block" id="syncNow" style="margin-top:10px">🔄 Sincronizar ahora</button>
        <button class="block danger" id="logout" style="margin-top:8px">Cerrar sesión en este móvil</button></div>
      <h2>Copia de seguridad</h2><div class="card">
        <div class="muted">Los datos están en la nube y en cada móvil. Aun así, puedes guardar una copia.</div>
        <button class="block" id="exp" style="margin-top:10px">📤 Exportar copia (JSON)</button>
        <button class="block" id="csv" style="margin-top:8px">📊 Exportar gastos a CSV (Excel)</button>
        <button class="block" id="imp" style="margin-top:8px">📥 Importar copia</button>
        <input type="file" id="file" accept="application/json,.json" style="display:none"></div>
      <div class="muted" style="text-align:center;margin-top:18px">Split Carlis 🐱 · con la supervisión de Monchi</div>`;
    view.innerHTML = h;
    const $ = s => view.querySelector(s);
    view.querySelectorAll('[data-me]').forEach(b => b.onclick = () => { S.setMe(b.dataset.me); render(); });
    view.querySelectorAll('[data-person]').forEach(el => el.onclick = () => openPersonForm(S.get(el.dataset.person)));
    $('#addPerson').onclick = () => openPersonForm();
    view.querySelectorAll('[data-group]').forEach(el => el.onclick = () => openGroupForm(S.get(el.dataset.group)));
    $('#addGroup').onclick = () => openGroupForm();
    view.querySelectorAll('[data-cat]').forEach(el => el.onclick = () => openCategoryForm(S.get(el.dataset.cat)));
    $('#addCat').onclick = () => openCategoryForm();
    $('#addCur').onclick = () => {
      const c = $('#newCur').value.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(c)) { toast('Escribe un código de 3 letras'); return; }
      try { new Intl.NumberFormat('es-ES', { style: 'currency', currency: c }); } catch (e) { toast('Moneda no reconocida'); return; }
      const st = Object.assign({}, settings()); st.rates = Object.assign({}, rates(), { [c]: rates()[c] || 1 });
      S.put('settings', st); toast('Añadida ' + c + '. Ajusta su tipo de cambio.');
    };
    $('#saveRates').onclick = () => {
      const nr = {};
      for (const inp of view.querySelectorAll('[data-rate]')) {
        const v = parseFloat(inp.value);
        if (!(v > 0)) { toast('Tipo no válido en ' + inp.dataset.rate); return; }
        nr[inp.dataset.rate] = v;
      }
      const st = Object.assign({}, settings(), { rates: nr });
      S.put('settings', st); toast('Tipos de cambio guardados');
    };
    $('#syncNow').onclick = () => { S.syncNow(); toast('Sincronizando…'); };
    $('#logout').onclick = async () => {
      const pend = S.pending();
      const msg = pend ? `Hay ${pend} cambio(s) sin subir a la nube que se perderán.\n¿Cerrar sesión igualmente?` : '¿Cerrar sesión en este móvil? Los datos siguen en la nube; para volver a entrar necesitarás el código.';
      if (!await ask(msg, { ok: 'Cerrar sesión', danger: true })) return;
      S.logout(); render();
    };
    $('#exp').onclick = exportBackup;
    $('#csv').onclick = exportCsv;
    $('#imp').onclick = () => $('#file').click();
    $('#file').onchange = ev => importBackup(ev.target.files[0]);
  }

  function inUse(field, id) { return expenses().some(e => e[field] === id); }
  function personInUse(id) {
    return expenses().some(e => e.paidBy === id || (e.split && e.split[id])) || payments().some(p => p.from === id || p.to === id);
  }

  function openPersonForm(p) {
    const isNew = !p;
    p = p ? Object.assign({}, p) : { id: 'p-' + uid(), name: '', color: COLORS[people().length % COLORS.length] };
    let color = p.color;
    const m = sheet(`<h3>${isNew ? 'Nueva persona' : 'Editar persona'}</h3>
      <label>Nombre</label><input id="nm" value="${esc(p.name)}" maxlength="30" autocomplete="off">
      <label>Color</label><div class="colors">${COLORS.map(c => `<button data-c="${c}" style="background:${c}" class="${c === color ? 'on' : ''}"></button>`).join('')}</div>
      <div class="actions">${isNew ? '' : '<button class="danger" id="del">Eliminar</button>'}<button id="cancel">Cancelar</button><button class="primary" id="ok">Guardar</button></div>`);
    m.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { color = b.dataset.c; m.querySelectorAll('[data-c]').forEach(x => x.classList.toggle('on', x === b)); });
    m.querySelector('#cancel').onclick = closeSheet;
    m.querySelector('#ok').onclick = () => {
      const name = m.querySelector('#nm').value.trim();
      if (!name) { toast('Escribe un nombre'); return; }
      S.put('person', Object.assign(p, { name, color })); closeSheet();
    };
    const del = m.querySelector('#del');
    if (del) del.onclick = async () => {
      if (personInUse(p.id)) { notify('No se puede eliminar: aparece en gastos o pagos.'); return; }
      if (p.id === S.me()) { notify('No puedes eliminarte a ti mismo en este móvil.'); return; }
      if (!await confirmDelete('¿Eliminar a ' + p.name + '?')) return;
      S.remove('person', p); closeSheet();
    };
  }

  function openGroupForm(g) {
    const isNew = !g;
    g = g ? Object.assign({}, g) : { id: 'g-' + uid(), name: '', emoji: '🧳', order: groups().length + 1 };
    const m = sheet(`<h3>${isNew ? 'Nuevo grupo' : 'Editar grupo'}</h3>
      <div class="muted">Por ejemplo "Viaje Japón 2026" para ver lo que cuesta cada viaje.</div>
      <div class="row"><div style="width:80px"><label>Emoji</label><input id="em" value="${esc(g.emoji)}" maxlength="8" style="text-align:center"></div>
      <div class="grow"><label>Nombre</label><input id="nm" value="${esc(g.name)}" maxlength="30" autocomplete="off"></div></div>
      ${isNew ? '' : `<label class="row" style="margin-top:14px;color:var(--text);font-weight:400"><input type="checkbox" id="arch" style="width:22px;height:22px" ${g.archived ? 'checked' : ''}> Archivado (no aparece al añadir gastos)</label>`}
      <div class="actions">${isNew ? '' : '<button class="danger" id="del">Eliminar</button>'}<button id="cancel">Cancelar</button><button class="primary" id="ok">Guardar</button></div>`);
    m.querySelector('#cancel').onclick = closeSheet;
    m.querySelector('#ok').onclick = () => {
      const name = m.querySelector('#nm').value.trim();
      if (!name) { toast('Escribe un nombre'); return; }
      const arch = m.querySelector('#arch');
      S.put('group', Object.assign(g, { name, emoji: m.querySelector('#em').value.trim() || '🧳', archived: arch ? arch.checked : false }));
      closeSheet();
    };
    const del = m.querySelector('#del');
    if (del) del.onclick = async () => {
      if (inUse('group', g.id)) { notify('Este grupo tiene gastos. Puedes archivarlo en lugar de eliminarlo.'); return; }
      if (!await confirmDelete('¿Eliminar el grupo ' + g.name + '?')) return;
      S.remove('group', g); closeSheet();
    };
  }

  function openCategoryForm(c) {
    const isNew = !c;
    c = c ? Object.assign({}, c) : { id: 'c-' + uid(), name: '', emoji: '🏷️', group: null, order: categories().length + 1 };
    const m = sheet(`<h3>${isNew ? 'Nueva categoría' : 'Editar categoría'}</h3>
      <div class="row"><div style="width:80px"><label>Emoji</label><input id="em" value="${esc(c.emoji)}" maxlength="8" style="text-align:center"></div>
      <div class="grow"><label>Nombre</label><input id="nm" value="${esc(c.name)}" maxlength="30" autocomplete="off"></div></div>
      <label>Aparece en el grupo</label><select id="gr"><option value="">Todos los grupos</option>
        ${groups().map(g => `<option value="${g.id}" ${g.id === c.group ? 'selected' : ''}>${esc(g.emoji)} ${esc(g.name)}</option>`).join('')}</select>
      <div class="actions">${isNew ? '' : '<button class="danger" id="del">Eliminar</button>'}<button id="cancel">Cancelar</button><button class="primary" id="ok">Guardar</button></div>`);
    m.querySelector('#cancel').onclick = closeSheet;
    m.querySelector('#ok').onclick = () => {
      const name = m.querySelector('#nm').value.trim();
      if (!name) { toast('Escribe un nombre'); return; }
      S.put('category', Object.assign(c, { name, emoji: m.querySelector('#em').value.trim() || '🏷️', group: m.querySelector('#gr').value || null }));
      closeSheet();
    };
    const del = m.querySelector('#del');
    if (del) del.onclick = async () => {
      const n = expenses().filter(e => e.category === c.id).length;
      if (!await confirmDelete(n ? `Hay ${n} gasto(s) con esta categoría; quedarán como "Sin categoría". ¿Eliminar ${c.name}?` : `¿Eliminar la categoría ${c.name}?`)) return;
      S.remove('category', c); closeSheet();
    };
  }

  // ---------- Exportar / importar ----------
  async function shareOrDownload(filename, text, mime) {
    const blob = new Blob([text], { type: mime });
    try {
      const file = new File([blob], filename, { type: mime });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: filename }); return; }
    } catch (err) { if (err && err.name === 'AbortError') return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  function exportBackup() {
    const stamp = today();
    shareOrDownload(`split-carlis-${stamp}.json`, JSON.stringify({ app: 'split-carlis', version: 1, items: S.exportAll() }), 'application/json');
  }
  function importBackup(file) {
    if (!file) return;
    const r = new FileReader();
    r.onload = async () => {
      try {
        const data = JSON.parse(r.result);
        if (data.app !== 'split-carlis' || !Array.isArray(data.items)) throw new Error('No es una copia de Split Carlis');
        const n = data.items.filter(i => i.kind === 'expense' && !i.deleted).length;
        if (!await ask(`¿Importar la copia (${n} gastos)? Se combinará con los datos actuales y se subirá a la nube.`, { ok: 'Importar' })) return;
        S.importAll(data.items); toast('Copia importada');
      } catch (e) { notify('No se pudo importar: ' + e.message); }
    };
    r.readAsText(file);
  }
  function exportCsv() {
    const ps = people();
    const q = v => '"' + String(v).replace(/"/g, '""') + '"';
    const num = c => (c / 100).toFixed(2).replace('.', ',');
    const rows = [['Fecha', 'Tipo', 'Descripción', 'Grupo', 'Categoría', 'Importe', 'Moneda', 'Total €', 'Pagado por', ...ps.map(p => 'Parte ' + p.name + ' €')].map(q).join(';')];
    expenses().sort((a, b) => a.date.localeCompare(b.date)).forEach(e => {
      const { total, shares } = L.expenseShares(e);
      rows.push([e.date, 'Gasto', e.description, group(e.group).name, category(e.category).name, String(e.amount).replace('.', ','), e.currency, num(total), person(e.paidBy).name,
        ...ps.map(p => num(shares[p.id] || 0))].map(q).join(';'));
    });
    payments().sort((a, b) => a.date.localeCompare(b.date)).forEach(p => {
      rows.push([p.date, 'Pago', `${person(p.from).name} → ${person(p.to).name}${p.note ? ' (' + p.note + ')' : ''}`, '', '', String(p.amount).replace('.', ','), 'EUR',
        num(Math.round(p.amount * 100)), person(p.from).name, ...ps.map(() => '')].map(q).join(';'));
    });
    shareOrDownload('split-carlis.csv', '﻿' + rows.join('\r\n'), 'text/csv');
  }

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  render();
})();
