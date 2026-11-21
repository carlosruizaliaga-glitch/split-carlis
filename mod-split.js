// Módulo Gastos: saldo, movimientos, resumen y formularios de gasto y pago.
(function () {
  'use strict';
  const App = window.App, L = App.L, S = App.S;
  const esc = App.esc, eur = App.eur;
  const filters = { group: '', month: '', text: '', statsMonth: App.monthOf(App.today()) };

  function render(sub) {
    App.fabAction = () => openExpense();
    if (sub === 'moves') renderMoves();
    else if (sub === 'stats') renderStats();
    else renderBalance();
  }

  // ---------- Saldo ----------
  function renderBalance() {
    const view = App.view, ps = App.people(), me = S.me();
    const { bal, paid, owed } = L.computeBalances(App.splitState());
    const plan = L.settleUp(bal);
    const b = bal[me] || 0;
    let hero;
    if (ps.length === 2) {
      const other = ps.find(p => p.id !== me);
      hero = b > 0 ? `<div class="muted">${esc(other.name)} te debe</div><div class="big pos">${eur(b)}</div>`
        : b < 0 ? `<div class="muted">Le debes a ${esc(other.name)}</div><div class="big neg">${eur(-b)}</div>`
        : `<div class="big">Estáis en paz 🐱🐈‍⬛</div><div class="muted">Nadie debe nada</div>`;
    } else {
      hero = b > 0 ? `<div class="muted">Te deben</div><div class="big pos">${eur(b)}</div>`
        : b < 0 ? `<div class="muted">Debes</div><div class="big neg">${eur(-b)}</div>` : `<div class="big">En paz 🐱🐈‍⬛</div>`;
    }
    let h = `<div class="card hero">${hero}</div>`;
    if (plan.length) {
      h += `<h2>Para quedar en paz</h2><div class="card list">`;
      plan.forEach((t, i) => {
        const a = App.person(t.from), bb = App.person(t.to);
        h += `<div class="item">${App.avatar(a, 1)}<div class="grow"><b>${esc(a.name)}</b> → <b>${esc(bb.name)}</b><div class="muted">${eur(t.cents)}</div></div>
          <button class="small primary" data-settle="${i}">Saldar</button></div>`;
      });
      h += `</div>`;
    }
    h += `<h2>Cada uno</h2><div class="card list">`;
    ps.forEach(p => {
      h += `<div class="item">${App.avatar(p)}<div class="grow"><b>${esc(p.name)}</b>
        <div class="muted">Ha pagado ${eur(paid[p.id] || 0)} · Su parte ${eur(owed[p.id] || 0)}</div></div>${App.balPill(bal[p.id] || 0)}</div>`;
    });
    h += `</div>`;
    const m = App.monthOf(App.today());
    const byGroup = {};
    let totalMonth = 0;
    App.expenses().filter(e => App.monthOf(e.date) === m).forEach(e => {
      const t = L.expenseShares(e).total; totalMonth += t;
      byGroup[e.group] = (byGroup[e.group] || 0) + t;
    });
    h += `<h2>${esc(App.fmtMonth(m))}</h2><div class="card list">`;
    if (!totalMonth) h += `<div class="muted">Aún no hay gastos este mes.</div>`;
    else {
      Object.entries(byGroup).sort((a, c) => c[1] - a[1]).forEach(([g, c]) => {
        const gg = App.group(g);
        h += `<div class="item"><div class="emoji">${esc(gg.emoji)}</div><div class="grow">${esc(gg.name)}</div><div class="amount">${eur(c)}</div></div>`;
      });
      h += `<div class="item"><div class="emoji">Σ</div><div class="grow"><b>Total</b></div><div class="amount">${eur(totalMonth)}</div></div>`;
    }
    h += `</div><button class="block ghost" id="addPayment">💸 Registrar un pago entre vosotros</button>`;
    view.innerHTML = h;
    view.querySelectorAll('[data-settle]').forEach(el => el.onclick = () => {
      const t = plan[+el.dataset.settle];
      openPayment({ from: t.from, to: t.to, amount: t.cents / 100, note: 'Saldar cuentas' });
    });
    view.querySelector('#addPayment').onclick = () => openPayment();
  }

  // ---------- Movimientos ----------
  function renderMoves(partial) {
    const view = App.view, gs = App.groups();
    const allMonths = [...new Set([...App.expenses(), ...App.payments()].map(x => App.monthOf(x.date)))].sort().reverse();
    const txt = filters.text.trim().toLowerCase();
    const items = [
      ...App.expenses().map(e => ({ kind: 'exp', d: e.date, t: e.createdAt || 0, e })),
      ...App.payments().map(p => ({ kind: 'pay', d: p.date, t: p.createdAt || 0, p }))
    ].filter(it => {
      if (filters.month && App.monthOf(it.d) !== filters.month) return false;
      if (filters.group) { if (it.kind !== 'exp' || it.e.group !== filters.group) return false; }
      if (txt) {
        const hay = it.kind === 'exp' ? (it.e.description + ' ' + App.category(it.e.category).name) : ('pago ' + (it.p.note || ''));
        if (!hay.toLowerCase().includes(txt)) return false;
      }
      return true;
    }).sort((a, b) => (b.d || '').localeCompare(a.d || '') || b.t - a.t);

    let h = `<div class="chips scroll-x"><button data-g="" class="${!filters.group ? 'on' : ''}">Todo</button>`;
    gs.forEach(g => { h += `<button data-g="${g.id}" class="${filters.group === g.id ? 'on' : ''}">${esc(g.emoji)} ${esc(g.name)}</button>`; });
    h += `</div><div class="row" style="margin-top:8px"><select id="month" class="grow"><option value="">Todos los meses</option>
      ${allMonths.map(m => `<option value="${m}" ${filters.month === m ? 'selected' : ''}>${esc(App.fmtMonth(m))}</option>`).join('')}</select>
      <input id="q" class="grow search" type="search" autocomplete="off" placeholder="🔍 Buscar" value="${esc(filters.text)}"></div>`;
    const head = h; h = '';
    const total = items.filter(i => i.kind === 'exp').reduce((a, i) => a + L.expenseShares(i.e).total, 0);
    if (items.length) h += `<div class="muted" style="margin-top:8px">${items.length} movimiento${items.length > 1 ? 's' : ''} · gastos ${eur(total)}</div>`;
    if (!items.length) {
      h += `<div class="card empty">No hay movimientos${filters.group || filters.month || txt ? ' con estos filtros' : '. Pulsa <b>+</b> para añadir un gasto'}.</div>`;
    } else {
      let lastDate = null;
      items.forEach(it => {
        if (it.d !== lastDate) {
          if (lastDate !== null) h += `</div>`;
          h += `<div class="datehdr">${esc(App.fmtDate(it.d))}</div><div class="card list">`;
          lastDate = it.d;
        }
        if (it.kind === 'exp') {
          const e = it.e, c = App.category(e.category), g = App.group(e.group), payer = App.person(e.paidBy);
          const { total: t } = L.expenseShares(e);
          h += `<div class="item tap" data-exp="${e.id}"><div class="emoji">${e.purchase ? '🛒' : esc(c.emoji)}</div>
            <div class="grow"><div class="ellipsis"><b>${esc(e.description)}</b></div>
            <div class="muted ellipsis">${esc(g.emoji)} ${esc(c.name)} · pagó ${esc(payer.name)}${splitLabel(e)}</div></div>
            <div class="amount">${App.money(e.amount, e.currency)}${e.currency !== 'EUR' ? `<div class="muted">${eur(t)}</div>` : ''}</div></div>`;
        } else {
          const p = it.p, a = App.person(p.from), b = App.person(p.to);
          h += `<div class="item tap" data-pay="${p.id}"><div class="emoji">💸</div>
            <div class="grow"><div class="ellipsis"><b>${esc(a.name)}</b> pagó a <b>${esc(b.name)}</b></div>
            <div class="muted ellipsis">${esc(p.note || 'Pago')}</div></div>
            <div class="amount pos">${App.money(p.amount, p.currency || 'EUR')}</div></div>`;
        }
      });
      h += `</div>`;
    }
    const body = view.querySelector('#mbody');
    if (partial) { if (!body) return; body.innerHTML = h; }
    else {
      view.innerHTML = head + `<div id="mbody">${h}</div>`;
      view.querySelectorAll('[data-g]').forEach(el => el.onclick = () => { filters.group = el.dataset.g; App.render(); });
      view.querySelector('#month').onchange = ev => { filters.month = ev.target.value; App.render(); };
      const q = view.querySelector('#q');
      q.oninput = () => { filters.text = q.value; clearTimeout(q._t); q._t = setTimeout(() => renderMoves(true), 150); };
    }
    view.querySelectorAll('[data-exp]').forEach(el => el.onclick = () => openExpense(S.get(el.dataset.exp)));
    view.querySelectorAll('[data-pay]').forEach(el => el.onclick = () => openPayment(S.get(el.dataset.pay)));
  }

  function splitLabel(e) {
    const ids = Object.keys(L.expenseShares(e).shares);
    if (ids.length === 1) return ' · solo ' + esc(App.person(ids[0]).name);
    if (e.mode === 'percent') return ' · ' + ids.map(id => esc(App.person(id).name[0]) + ' ' + (+e.split[id]) + '%').join('/');
    if (e.mode === 'exact') return ' · importes';
    return '';
  }

  // ---------- Resumen ----------
  function renderStats() {
    const view = App.view;
    const allMonths = [...new Set(App.expenses().map(x => App.monthOf(x.date)))];
    if (!allMonths.includes(App.monthOf(App.today()))) allMonths.push(App.monthOf(App.today()));
    allMonths.sort().reverse();
    const m = filters.statsMonth;
    const exps = App.expenses().filter(e => !m || App.monthOf(e.date) === m);
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
        return `<div class="barrow"><div class="row"><div class="grow ellipsis">${esc(x.emoji)} ${esc(x.name)}</div><div class="amount">${eur(v)}</div></div>
          <div class="bar"><span style="width:${(v / max * 100).toFixed(1)}%"></span></div></div>`;
      }).join('');
    };
    let h = `<select id="smonth"><option value="">Todo el tiempo</option>
      ${allMonths.map(x => `<option value="${x}" ${m === x ? 'selected' : ''}>${esc(App.fmtMonth(x))}</option>`).join('')}</select>
      <div class="card hero"><div class="muted">Total gastado</div><div class="big">${eur(total)}</div>
      <div class="muted">${exps.length} gasto${exps.length === 1 ? '' : 's'}</div></div>`;
    if (total) {
      h += `<h2>Por grupo</h2><div class="card">${bars(byGroup, App.group)}</div>`;
      h += `<h2>Por categoría</h2><div class="card">${bars(byCat, App.category)}</div>`;
      h += `<h2>Por persona</h2><div class="card list">`;
      App.people().forEach(p => {
        h += `<div class="item">${App.avatar(p, 1)}<div class="grow">${esc(p.name)}</div><div class="amount">
          <div>Pagó ${eur(paid[p.id] || 0)}</div><div class="muted">Su parte ${eur(owed[p.id] || 0)}</div></div></div>`;
      });
      h += `</div>`;
    }
    const months = [];
    const d = new Date(App.today() + 'T12:00:00'); d.setDate(15);
    for (let i = 0; i < 12; i++) { months.unshift(d.toISOString().slice(0, 7)); d.setMonth(d.getMonth() - 1); }
    const perMonth = {};
    App.expenses().forEach(e => { const k = App.monthOf(e.date); if (months.includes(k)) perMonth[k] = (perMonth[k] || 0) + L.expenseShares(e).total; });
    const maxM = Math.max(1, ...Object.values(perMonth));
    h += `<h2>Últimos 12 meses</h2><div class="card"><div class="mchart">
      ${months.map(k => `<div title="${esc(App.fmtMonth(k))}: ${eur(perMonth[k] || 0)}" data-m="${k}" class="${k === m ? 'on' : ''}" style="height:${Math.max(2, (perMonth[k] || 0) / maxM * 100)}%"></div>`).join('')}
      </div><div class="mlabels">${months.map(k => `<div>${new Date(k + '-15').toLocaleDateString('es-ES', { month: 'narrow' })}</div>`).join('')}</div></div>`;
    view.innerHTML = h;
    view.querySelector('#smonth').onchange = ev => { filters.statsMonth = ev.target.value; App.render(); };
    view.querySelectorAll('[data-m]').forEach(el => el.onclick = () => { filters.statsMonth = el.dataset.m; App.render(); });
  }

  // ---------- Formulario de gasto ----------
  function openExpense(existing, preset) {
    const ps = App.people();
    const isNew = !existing;
    const lastGroup = (() => { try { return localStorage.getItem('splitcarlis.lastGroup'); } catch (e) { return null; } })();
    const e = existing ? JSON.parse(JSON.stringify(existing)) : Object.assign({
      id: App.uid(), description: '', amount: '', currency: 'EUR', rate: 1, paidBy: S.me() || ps[0].id,
      date: App.today(), group: (lastGroup && S.get(lastGroup)) ? lastGroup : 'g-casa', category: '', mode: 'equal', split: {}, createdAt: Date.now()
    }, preset || {});
    let showAllCats = false;
    const vals = { equal: {}, exact: {}, percent: {} };
    ps.forEach(p => { vals.equal[p.id] = true; vals.exact[p.id] = ''; vals.percent[p.id] = ''; });
    if (!isNew) {
      if (e.mode === 'equal') ps.forEach(p => { vals.equal[p.id] = !!e.split[p.id]; });
      else Object.entries(e.split).forEach(([k, v]) => { vals[e.mode][k] = v; });
    }
    const curs = ['EUR', ...Object.keys(App.rates()).sort()];
    if (!curs.includes(e.currency)) curs.push(e.currency);

    const m = App.sheet(`<h3>${isNew ? 'Nuevo gasto' : 'Editar gasto'}</h3>
      ${e.purchase ? `<div class="note">🛒 Viene de una compra. Al cambiar el importe aquí no cambia la compra.</div>` : ''}
      <label>Descripción</label><input id="desc" value="${esc(e.description)}" placeholder="Ej: Mercadona" maxlength="60" autocomplete="off">
      <label>Importe</label>
      <div class="row"><input id="amt" type="text" inputmode="decimal" autocomplete="off" value="${esc(e.amount)}" placeholder="0" class="grow amount-input">
        <select id="cur" style="width:105px">${curs.map(c => `<option ${c === e.currency ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
      <div id="rateBox"><label id="rateLbl"></label><input id="rate" type="text" inputmode="decimal" autocomplete="off" value="${esc(e.currency === 'EUR' ? '' : e.rate)}">
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
    const readAmount = () => App.num($('#amt').value) || 0;
    const readRate = () => e.currency === 'EUR' ? 1 : (App.num($('#rate').value) || 0);

    function build() {
      const split = {};
      ps.forEach(p => {
        if (e.mode === 'equal') { if (vals.equal[p.id]) split[p.id] = true; }
        else { const v = App.num(vals[e.mode][p.id]); if (v > 0) split[p.id] = v; }
      });
      return Object.assign({}, e, { description: $('#desc').value.trim(), amount: readAmount(), rate: readRate(),
        date: $('#date').value || App.today(), split });
    }

    function renderGroupsCats() {
      const gs = App.groups().filter(g => !g.archived || g.id === e.group);
      $('#groups').innerHTML = gs.map(g => `<button data-grp="${g.id}" class="${g.id === e.group ? 'on' : ''}">${esc(g.emoji)} ${esc(g.name)}</button>`).join('');
      const all = App.categories();
      const cs = showAllCats ? all : all.filter(c => !c.group || c.group === e.group || c.id === e.category);
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
          : `<input type="text" inputmode="decimal" autocomplete="off" data-sp="${p.id}" value="${esc(vals[e.mode][p.id])}" placeholder="0"><span>${e.mode === 'percent' ? '%' : esc(e.currency)}</span>`;
        return `<label class="split-row">${App.avatar(p, 1)}<span class="grow ellipsis">${esc(p.name)}</span><span class="muted" data-share="${p.id}"></span>${ctl}</label>`;
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
            const v = App.num(inp.value);
            if (v >= 0 && v <= 100) { vals.percent[other] = String(+(100 - v).toFixed(2)); const o = box.querySelector(`[data-sp="${other}"]`); if (o) o.value = vals.percent[other]; }
          }
          refreshShares();
        });
      });
      refreshShares();
    }

    function fillRest() {
      const target = readAmount();
      const empty = ps.map(p => p.id).filter(id => !(App.num(vals.exact[id]) > 0));
      if (!empty.length || !(target > 0)) return;
      const used = ps.reduce((a, p) => a + (App.num(vals.exact[p.id]) || 0), 0);
      const rest = target - used;
      if (rest <= 0) { App.toast('No queda nada por repartir'); return; }
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
        msg = n ? (n === ps.length ? 'A partes iguales entre todos' : `Solo ${Object.keys(exp.split).map(id => App.person(id).name).join(', ')}`) : 'Marca al menos a una persona';
        ok = n > 0;
      } else {
        const sum = Object.values(exp.split).reduce((a, b) => a + b, 0);
        const target = e.mode === 'percent' ? 100 : exp.amount;
        const diff = +(target - sum).toFixed(2);
        const fmt = v => e.mode === 'percent' ? (+v.toFixed(2)) + '%' : App.money(v, e.currency);
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
      $('#rate').value = e.currency === 'EUR' ? '' : (App.rates()[e.currency] || '');
      refreshTop(); renderSplit();
    };
    ['#amt', '#rate'].forEach(s => $(s).addEventListener('input', () => { refreshTop(); refreshShares(); }));
    $('#cancel').onclick = App.closeSheet;
    $('#ok').onclick = () => {
      const exp = build();
      if (!exp.category) { App.toast('Elige una categoría'); return; }
      const err = L.validateExpense(exp);
      if (err) { App.toast(err); return; }
      S.put('expense', exp);
      if (exp.currency !== 'EUR' && App.rates()[exp.currency] !== exp.rate) {
        const st = Object.assign({}, S.get('settings') || App.D.settings); st.rates = Object.assign({}, App.rates(), { [exp.currency]: exp.rate });
        S.put('settings', st);
      }
      try { localStorage.setItem('splitcarlis.lastGroup', exp.group); } catch (x) {}
      App.closeSheet(); App.toast('Gasto guardado');
    };
    const del = $('#del');
    if (del) del.onclick = async () => {
      if (!await App.confirmDelete('¿Eliminar este gasto?')) return;
      App.closeSheet();
      App.removeWithUndo('expense', existing, 'Gasto eliminado');
    };
    renderGroupsCats(); refreshTop(); renderSplit();
    if (isNew && !preset) setTimeout(() => $('#desc').focus(), 80);
  }

  // ---------- Formulario de pago ----------
  function openPayment(existing) {
    const ps = App.people(), me = S.me();
    const isNew = !existing || !existing.id;
    const other = (ps.find(p => p.id !== me) || ps[0]).id;
    const p = Object.assign({ id: App.uid(), from: me, to: other, amount: '', currency: 'EUR', rate: 1, date: App.today(), note: '', createdAt: Date.now() }, existing || {});
    const opts = sel => ps.map(x => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
    const m = App.sheet(`<h3>${isNew ? 'Registrar pago' : 'Editar pago'}</h3>
      <div class="muted">Dinero que uno le da al otro para saldar cuentas.</div>
      <label>Quién paga</label><select id="from">${opts(p.from)}</select>
      <label>A quién</label><select id="to">${opts(p.to)}</select>
      <label>Importe (€)</label><input id="amt" type="text" inputmode="decimal" autocomplete="off" value="${esc(p.amount === '' ? '' : +(+p.amount).toFixed(2))}">
      <label>Fecha</label><input id="date" type="date" value="${esc(p.date)}">
      <label>Nota</label><input id="note" value="${esc(p.note)}" maxlength="60" placeholder="Opcional (Bizum, transferencia…)">
      <div class="actions">${isNew ? '' : '<button class="danger" id="del">Eliminar</button>'}<button id="cancel">Cancelar</button><button class="primary" id="ok">Guardar</button></div>`);
    const $ = s => m.querySelector(s);
    $('#cancel').onclick = App.closeSheet;
    $('#ok').onclick = () => {
      const np = Object.assign({}, p, { from: $('#from').value, to: $('#to').value, amount: App.num($('#amt').value) || 0,
        currency: 'EUR', rate: 1, date: $('#date').value || App.today(), note: $('#note').value.trim() });
      if (np.from === np.to) { App.toast('Quien paga y quien recibe deben ser distintos'); return; }
      if (!(np.amount > 0)) { App.toast('Importe no válido'); return; }
      S.put('payment', np);
      App.closeSheet(); App.toast('Pago registrado');
    };
    const del = $('#del');
    if (del) del.onclick = async () => {
      if (!await App.confirmDelete('¿Eliminar este pago?')) return;
      App.closeSheet();
      App.removeWithUndo('payment', existing, 'Pago eliminado');
    };
  }

  App.modules.split = { render, openExpense, openPayment };
})();
