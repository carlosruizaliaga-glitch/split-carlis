// Automatismos: gastos fijos mensuales, copias de seguridad automáticas en el móvil y recordatorios.
(function () {
  'use strict';
  const App = window.App, S = App.S;
  const esc = App.esc;
  const putSettings = patch => S.put('settings', Object.assign({}, S.get('settings') || App.D.settings, patch));
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  // ---------- Gastos fijos ----------
  // settings.recurring = [{ id, description, amount, category, group, paidBy, day, active, lastMonth }]
  // Cada mes se crea el gasto con id «rec-<id>-<mes>»: aunque los dos móviles lo hagan a la vez, sale uno solo.
  const recurring = () => (App.settings().recurring || []).slice();
  const nextMonth = m => { const d = new Date(m + '-15T12:00:00'); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 7); };
  function runRecurring() {
    const list = recurring(); if (!list.length) return;
    const today = App.today(), cur = App.monthOf(today), changes = [];
    let touched = false;
    list.forEach(r => {
      if (r.active === false) return;
      let m = r.lastMonth ? nextMonth(r.lastMonth) : cur;
      while (m <= cur) {
        const day = String(Math.min(28, Math.max(1, r.day || 1))).padStart(2, '0'), date = `${m}-${day}`;
        if (date > today) break;
        const id = `rec-${r.id}-${m}`;
        if (!S.has(id)) {
          const split = {}; App.people().forEach(p => { split[p.id] = true; });
          changes.push({ kind: 'expense', data: { id, description: r.description, amount: r.amount, currency: 'EUR', rate: 1, paidBy: r.paidBy,
            date, group: r.group, category: r.category, mode: 'equal', split, createdAt: Date.now(), recurring: r.id } });
        }
        r.lastMonth = m; touched = true; m = nextMonth(m);
      }
    });
    if (touched) changes.push({ kind: 'settings', data: Object.assign({}, S.get('settings') || App.D.settings, { recurring: list }) });
    if (changes.length) {
      S.putMany(changes);
      const n = changes.filter(c => c.kind === 'expense').length;
      if (n) App.toast(`🔁 Añadido${n === 1 ? '' : 's'} ${n} gasto${n === 1 ? '' : 's'} fijo${n === 1 ? '' : 's'} del mes`);
    }
  }
  function saveRecurring(r) {
    const list = recurring(), i = list.findIndex(x => x.id === r.id);
    if (i >= 0) list[i] = r; else list.push(r);
    putSettings({ recurring: list });
  }
  App.addRecurringFromExpense = exp => {
    const day = Math.min(28, +exp.date.slice(8));
    saveRecurring({ id: App.uid(), description: exp.description, amount: exp.amount, category: exp.category, group: exp.group, paidBy: exp.paidBy,
      day, active: true, lastMonth: App.monthOf(exp.date) });
    App.toast(`🔁 Se repetirá cada mes el día ${day}`);
  };

  function openRecurring(r) {
    const isNew = !r, ps = App.people();
    r = r ? Object.assign({}, r) : { id: App.uid(), description: '', amount: '', category: 'c-alquiler', group: 'g-casa', paidBy: S.me(), day: 1, active: true, lastMonth: App.monthOf(App.today()) };
    const m = App.sheet(`<h3>${isNew ? 'Nuevo gasto fijo' : 'Gasto fijo'}</h3>
      <div class="muted">Se apunta solo cada mes en el día que elijas, a partes iguales. ${isNew ? "Empieza el mes que viene (el de este mes, apúntalo a mano si hace falta)." : ""}</div>
      <label>Descripción</label><input id="desc" value="${esc(r.description)}" maxlength="60" autocomplete="off" placeholder="Ej: Alquiler">
      <div class="row"><div class="grow"><label>Importe (€)</label><input id="amt" type="text" inputmode="decimal" autocomplete="off" value="${esc(r.amount)}"></div>
        <div style="width:110px"><label>Día del mes</label><input id="day" type="text" inputmode="numeric" autocomplete="off" value="${r.day}"></div></div>
      <label>Paga</label><div class="seg">${ps.map(p => `<button data-payer="${p.id}" class="${p.id === r.paidBy ? 'on' : ''}">${esc(p.name)}</button>`).join('')}</div>
      <label>Grupo</label><select id="grp">${App.groups().map(g => `<option value="${g.id}" ${g.id === r.group ? 'selected' : ''}>${esc(g.emoji)} ${esc(g.name)}</option>`).join('')}</select>
      <label>Categoría</label><select id="cat">${App.categories().map(c => `<option value="${c.id}" ${c.id === r.category ? 'selected' : ''}>${esc(c.emoji)} ${esc(c.name)}</option>`).join('')}</select>
      <label class="row check-line"><input type="checkbox" id="act" ${r.active !== false ? 'checked' : ''}> Activo</label>
      <div class="actions">${isNew ? '' : '<button class="danger" id="del">Eliminar</button>'}<button id="cancel">Cancelar</button><button class="primary" id="ok">Guardar</button></div>`);
    const $ = s => m.querySelector(s);
    m.querySelectorAll('[data-payer]').forEach(b => b.onclick = () => { r.paidBy = b.dataset.payer; m.querySelectorAll('[data-payer]').forEach(x => x.classList.toggle('on', x === b)); });
    $('#cancel').onclick = App.closeSheet;
    $('#ok').onclick = () => {
      const amt = App.num($('#amt').value), day = Math.round(App.num($('#day').value));
      if (!$('#desc').value.trim()) { App.toast('Ponle una descripción'); return; }
      if (!(amt > 0)) { App.toast('Importe no válido'); return; }
      if (!(day >= 1 && day <= 28)) { App.toast('El día tiene que ser del 1 al 28'); return; }
      Object.assign(r, { description: $('#desc').value.trim(), amount: amt, day, group: $('#grp').value, category: $('#cat').value, active: $('#act').checked });
      saveRecurring(r); App.closeSheet(); App.toast('Gasto fijo guardado');
    };
    if ($('#del')) $('#del').onclick = async () => {
      if (!await App.confirmDelete(`¿Dejar de repetir «${r.description}»? Los gastos ya apuntados se quedan.`)) return;
      putSettings({ recurring: recurring().filter(x => x.id !== r.id) }); App.closeSheet();
    };
  }
  const recurringPage = {
    html: () => {
      const list = recurring();
      return `<div class="muted" style="margin:4px 4px 0">Alquiler, luz, internet, seguros… se apuntan solos cada mes. También puedes marcar «Repetir cada mes» al crear un gasto.</div>
        <div class="card list">${list.map(r => `<div class="item tap${r.active === false ? ' off' : ''}" data-rec="${r.id}"><div class="emoji">${esc(App.category(r.category).emoji)}</div>
          <div class="grow"><b>${esc(r.description)}</b><div class="muted">Día ${r.day} · paga ${esc(App.person(r.paidBy).name)}${r.active === false ? ' · pausado' : ''}</div></div>
          <div class="amount">${App.euros(r.amount)}</div></div>`).join('') || '<div class="muted">Aún no hay gastos fijos.</div>'}</div>
        <button class="block small ghost" id="addRec">＋ Añadir gasto fijo</button>`;
    },
    bind(view, $, on) {
      view.querySelectorAll('[data-rec]').forEach(el => el.onclick = () => openRecurring(recurring().find(r => r.id === el.dataset.rec)));
      on('#addRec', () => openRecurring(null));
    }
  };

  // ---------- Copias automáticas (en este móvil) ----------
  // Una por semana, se guardan las 6 últimas en el almacenamiento de la app (Cache Storage).
  const BK = 'splitcarlis-backups';
  async function listBackups() {
    if (!window.caches) return [];
    const c = await caches.open(BK);
    return (await c.keys()).map(r => r.url.split('/').pop()).filter(n => /^backup-\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort().reverse();
  }
  async function autoBackup(force) {
    if (!window.caches || !S.lastSync()) return;
    const last = lsGet('splitcarlis.lastBackup', null), today = App.today();
    if (!force && last && Date.parse(today) - Date.parse(last) < 7 * 86400000) return;
    const c = await caches.open(BK);
    const body = JSON.stringify({ app: 'split-carlis', version: 2, auto: true, items: S.exportAll() });
    await c.put(new Request(`backup-${today}.json`), new Response(body, { headers: { 'Content-Type': 'application/json' } }));
    const all = await listBackups();
    for (const n of all.slice(6)) await c.delete(new Request(n));
    lsSet('splitcarlis.lastBackup', today);
  }
  async function readBackup(name) { const r = await (await caches.open(BK)).match(new Request(name)); return r ? r.text() : null; }
  const backupsPage = {
    html: () => `<div class="muted" style="margin:4px 4px 0">Cada semana se guarda sola una copia en este móvil (las 6 últimas). Además, todo está en la nube.</div>
      <div class="card list" id="bkList"><div class="muted">Cargando…</div></div>
      <button class="block small" id="bkNow">💾 Hacer una copia ahora</button>`,
    bind(view, $, on) {
      on('#bkNow', async () => { await autoBackup(true); App.toast('Copia guardada en el móvil'); App.render(); });
      listBackups().then(list => {
        const box = view.querySelector('#bkList'); if (!box) return;
        box.innerHTML = list.map(n => `<div class="item"><div class="emoji">🗂️</div><div class="grow"><b>${esc(App.fmtDate(n.slice(7, 17)))}</b></div>
          <button class="small" data-bkdl="${n}">Descargar</button><button class="small danger" data-bkre="${n}">Restaurar</button></div>`).join('') || '<div class="muted">Todavía no hay copias.</div>';
        box.querySelectorAll('[data-bkdl]').forEach(b => b.onclick = async () => App.shareOrDownload('split-carlis-' + b.dataset.bkdl.slice(7), await readBackup(b.dataset.bkdl), 'application/json'));
        box.querySelectorAll('[data-bkre]').forEach(b => b.onclick = async () => {
          if (!await App.ask('¿Restaurar esta copia? Lo que contiene sustituirá a lo actual en los dos móviles (lo creado después se mantiene).', { ok: 'Restaurar', danger: true })) return;
          const data = JSON.parse(await readBackup(b.dataset.bkre));
          S.importAll(data.items); App.toast('Copia restaurada');
        });
      });
    }
  };

  // ---------- Recordatorios ----------
  // Sin servidor de avisos: el móvil despierta la app de vez en cuando (sincronización periódica de Chrome)
  // y, si es la hora y quedan tareas, avisa. Además se guarda un resumen para que el aviso tenga datos.
  const REM = 'splitcarlis-reminders';
  const remCfg = () => Object.assign({ on: false, hour: 21, weekly: true }, lsGet('splitcarlis.reminders', {}));
  async function writeSnapshot() {
    if (!window.caches || !S.me() || !remCfg().on) return;
    const me = S.me(), today = App.today(), days = {};
    S.list('chorewk').filter(o => o.date >= today && o.date <= App.addDays(today, 7) && !o.doneAt && !o.skip && o.who === me).forEach(o => {
      const c = S.get(o.chore) || { name: 'Tarea' };
      (days[o.date] = days[o.date] || []).push(c.name);
    });
    const ch = App.modules.chores;
    const last = App.addDays(App.mondayOf(today), -7);
    const snap = { cfg: remCfg(), name: App.person(me).name, days, lastWeek: ch && ch.weekSummary ? ch.weekSummary(last) : null };
    await (await caches.open(REM)).put(new Request('state.json'), new Response(JSON.stringify(snap), { headers: { 'Content-Type': 'application/json' } }));
  }
  async function enableReminders() {
    if (!('Notification' in window)) { App.notify('Este navegador no permite avisos.'); return false; }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { App.notify('Sin permiso para avisos. Puedes darlo en los ajustes del navegador para esta app.'); return false; }
    const reg = await navigator.serviceWorker.ready;
    let periodic = false;
    try {
      if (reg.periodicSync) { await reg.periodicSync.register('reminders', { minInterval: 3 * 3600 * 1000 }); periodic = true; }
    } catch (e) { periodic = false; }
    lsSet('splitcarlis.reminders', Object.assign(remCfg(), { on: true, periodic }));
    await writeSnapshot();
    reg.showNotification('Split Carlis', { body: '🔔 Recordatorios activados. Monchi y Hierba vigilarán las tareas 🐱🐈‍⬛', icon: 'icon-192.png', badge: 'favicon.png', tag: 'rem-test' });
    return true;
  }
  const remindersPage = {
    html() {
      const c = remCfg(), perm = 'Notification' in window ? Notification.permission : 'unsupported';
      return `<div class="card"><label class="row check-line" style="margin-top:0"><input type="checkbox" id="remOn" ${c.on && perm === 'granted' ? 'checked' : ''}> Avisarme de las tareas que me quedan</label>
          <label>A partir de las</label><select id="remHour">${[18, 19, 20, 21, 22].map(h => `<option value="${h}" ${c.hour === h ? 'selected' : ''}>${h}:00</option>`).join('')}</select>
          <label class="row check-line"><input type="checkbox" id="remWeek" ${c.weekly ? 'checked' : ''}> Resumen de la semana el lunes (quién ganó y su premio)</label></div>
        <div class="note">ℹ️ Los avisos llegan cuando el móvil despierta la app (Chrome lo hace varias veces al día si la app está instalada y la usáis a menudo), así que la hora es aproximada. ${perm === 'denied' ? '<br><b>Los avisos están bloqueados</b>: actívalos en los ajustes del navegador para esta app.' : ''}${c.on && c.periodic === false ? '<br>Este móvil no permite despertar la app: el aviso saldrá al abrirla.' : ''}</div>
        <div class="muted" style="margin:4px">Se guarda en este móvil: cada uno elige los suyos.</div>`;
    },
    bind(view, $) {
      $('#remOn').onchange = async () => {
        if ($('#remOn').checked) { if (!await enableReminders()) $('#remOn').checked = false; }
        else lsSet('splitcarlis.reminders', Object.assign(remCfg(), { on: false }));
        App.render();
      };
      $('#remHour').onchange = () => { lsSet('splitcarlis.reminders', Object.assign(remCfg(), { hour: +$('#remHour').value })); writeSnapshot(); };
      $('#remWeek').onchange = () => { lsSet('splitcarlis.reminders', Object.assign(remCfg(), { weekly: $('#remWeek').checked })); writeSnapshot(); };
    }
  };

  // ---------- Arranque y cambios ----------
  let t = null;
  S.onChange(() => {
    clearTimeout(t);
    t = setTimeout(() => {
      if (!App.started || !S.lastSync() || !S.me()) return;
      runRecurring();
      autoBackup(false).catch(() => {});
      writeSnapshot().catch(() => {});
    }, 1500);
  });

  App.settingsTitles = Object.assign(App.settingsTitles || {}, { recurring: 'Gastos fijos', backups: 'Copias automáticas', reminders: 'Recordatorios' });
  App.settingsPages = Object.assign(App.settingsPages || {}, { recurring: recurringPage, backups: backupsPage, reminders: remindersPage });
  App.auto = { runRecurring, autoBackup, writeSnapshot, remCfg, recurring };
})();
