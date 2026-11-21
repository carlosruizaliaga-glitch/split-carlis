// Módulo Ajustes: personas, grupos, categorías, monedas, súpers, menú, sincronización y copias.
(function () {
  'use strict';
  const App = window.App, S = App.S, L = App.L, C = App.C;
  const esc = App.esc;
  const COLORS = ['#3b5bdb', '#c2255c', '#d9822b', '#2e8b57', '#1f7a8c', '#7048e8', '#c9a227', '#e03131', '#5c5f66', '#8d6e63'];
  const putSettings = patch => S.put('settings', Object.assign({}, S.get('settings') || App.D.settings, patch));

  function render() {
    const view = App.view, ps = App.people(), me = S.me(), st = App.settings();
    const last = S.lastSync() ? new Date(S.lastSync()).toLocaleString('es-ES') : 'nunca';
    const r = App.rates();
    const habitual = App.habitualStore();
    const enabledMeals = st.meals || C.MEALS.map(m => m.id);
    let h = `<h2>En este móvil eres</h2><div class="seg">${ps.map(p => `<button data-me="${p.id}" class="${p.id === me ? 'on' : ''}">${esc(p.name)}</button>`).join('')}</div>

      <h2>🛒 Supermercados</h2><div class="card list tight">${App.stores().map(s => `<div class="item tap" data-store="${s.id}">${App.storeDot(s)}<div class="grow">${esc(s.name)}
        ${habitual && s.id === habitual.id ? '<span class="pill pos">habitual</span>' : ''}${s.compare === false ? ' <span class="pill zero">no compara</span>' : ''}</div>›</div>`).join('')}</div>
      <button class="block small ghost" id="addStore">＋ Añadir súper</button>
      <div class="card"><label style="margin-top:0">Recomendar ir a dos súpers si se ahorra al menos (€)</label>
        <input id="thr" type="number" inputmode="decimal" step="0.5" min="0" value="${st.pairThreshold || 3}"></div>

      <h2>🍽️ Menú</h2><div class="card"><label style="margin-top:0">Comidas que planificáis</label>
        <div class="chips">${C.MEALS.map(m => `<button data-meal="${m.id}" class="${enabledMeals.includes(m.id) ? 'on' : ''}">${m.emoji} ${m.name}</button>`).join('')}</div>
        <label>Raciones por defecto</label>
        <div class="row"><button class="qbtn" id="servMinus">−</button><b class="qval">${App.defaultServings()}</b><button class="qbtn" id="servPlus">+</button></div></div>

      <h2>👥 Personas</h2><div class="card list">${ps.map(p => `<div class="item tap" data-person="${p.id}">${App.avatar(p)}<div class="grow"><b>${esc(p.name)}</b></div>›</div>`).join('')}</div>
      <button class="block small ghost" id="addPerson">＋ Añadir persona</button>
      <h2>🗂️ Grupos de gastos</h2><div class="card list">${App.groups().map(g => `<div class="item tap" data-group="${g.id}"><div class="emoji">${esc(g.emoji)}</div><div class="grow">${esc(g.name)}${g.archived ? ' <span class="muted">(archivado)</span>' : ''}</div>›</div>`).join('')}</div>
      <button class="block small ghost" id="addGroup">＋ Añadir grupo (p. ej. un viaje)</button>
      <h2>🏷️ Categorías de gastos</h2><div class="card list">${App.categories().map(c => `<div class="item tap" data-cat="${c.id}"><div class="emoji">${esc(c.emoji)}</div><div class="grow">${esc(c.name)}<div class="muted">${c.group ? esc(App.group(c.group).name) : 'Todos los grupos'}</div></div>›</div>`).join('')}</div>
      <button class="block small ghost" id="addCat">＋ Añadir categoría</button>
      <h2>💱 Monedas (unidades por 1 €)</h2><div class="card">
        <div class="rates">${Object.keys(r).sort().map(c => `<label class="row"><span style="width:44px">${c}</span><input data-rate="${c}" type="number" inputmode="decimal" step="any" value="${r[c]}"></label>`).join('')}</div>
        <div class="row" style="margin-top:10px"><input id="newCur" placeholder="Otra (código, p. ej. AUD)" maxlength="3" style="text-transform:uppercase"><button class="small" id="addCur">Añadir</button></div>
        <button class="primary block" id="saveRates" style="margin-top:10px">Guardar tipos de cambio</button></div>
      <h2>🔄 Sincronización</h2><div class="card">
        <div>Última sincronización: <b>${esc(last)}</b></div>
        <div class="muted">Cambios pendientes de subir: ${S.pending()}</div>
        <button class="block" id="syncNow" style="margin-top:10px">🔄 Sincronizar ahora</button>
        <button class="block" id="hardReload" style="margin-top:8px">⬇️ Forzar actualización de la app</button>
        <button class="block danger" id="logout" style="margin-top:8px">Cerrar sesión en este móvil</button></div>
      <h2>💾 Copia de seguridad</h2><div class="card">
        <div class="muted">Los datos están en la nube y en cada móvil. Aun así, puedes guardar una copia.</div>
        <button class="block" id="exp" style="margin-top:10px">📤 Exportar copia (JSON)</button>
        <button class="block" id="csv" style="margin-top:8px">📊 Exportar gastos a CSV (Excel)</button>
        <button class="block" id="imp" style="margin-top:8px">📥 Importar copia</button>
        <input type="file" id="file" accept="application/json,.json" style="display:none"></div>
      <div class="muted center" style="margin-top:18px">Split Carlis 🐱 · con la supervisión de Monchi</div>`;
    view.innerHTML = h;
    const $ = s => view.querySelector(s);
    view.querySelectorAll('[data-me]').forEach(b => b.onclick = () => { S.setMe(b.dataset.me); App.render(); });
    view.querySelectorAll('[data-store]').forEach(el => el.onclick = () => openStoreForm(S.get(el.dataset.store)));
    $('#addStore').onclick = () => openStoreForm();
    $('#thr').onchange = () => { const v = App.num($('#thr').value); if (v >= 0) { putSettings({ pairThreshold: v }); App.toast('Guardado'); } };
    view.querySelectorAll('[data-meal]').forEach(b => b.onclick = () => {
      const id = b.dataset.meal;
      const next = enabledMeals.includes(id) ? enabledMeals.filter(x => x !== id) : C.MEALS.map(m => m.id).filter(x => enabledMeals.includes(x) || x === id);
      if (!next.length) { App.toast('Deja al menos una comida'); return; }
      putSettings({ meals: next });
    });
    $('#servMinus').onclick = () => putSettings({ servings: Math.max(1, App.defaultServings() - 1) });
    $('#servPlus').onclick = () => putSettings({ servings: Math.min(12, App.defaultServings() + 1) });
    view.querySelectorAll('[data-person]').forEach(el => el.onclick = () => openPersonForm(S.get(el.dataset.person)));
    $('#addPerson').onclick = () => openPersonForm();
    view.querySelectorAll('[data-group]').forEach(el => el.onclick = () => openGroupForm(S.get(el.dataset.group)));
    $('#addGroup').onclick = () => openGroupForm();
    view.querySelectorAll('[data-cat]').forEach(el => el.onclick = () => openCategoryForm(S.get(el.dataset.cat)));
    $('#addCat').onclick = () => openCategoryForm();
    $('#addCur').onclick = () => {
      const c = $('#newCur').value.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(c)) { App.toast('Escribe un código de 3 letras'); return; }
      try { new Intl.NumberFormat('es-ES', { style: 'currency', currency: c }); } catch (e) { App.toast('Moneda no reconocida'); return; }
      putSettings({ rates: Object.assign({}, App.rates(), { [c]: App.rates()[c] || 1 }) });
      App.toast('Añadida ' + c + '. Ajusta su tipo de cambio.');
    };
    $('#saveRates').onclick = () => {
      const nr = {};
      for (const inp of view.querySelectorAll('[data-rate]')) {
        const v = parseFloat(inp.value);
        if (!(v > 0)) { App.toast('Tipo no válido en ' + inp.dataset.rate); return; }
        nr[inp.dataset.rate] = v;
      }
      putSettings({ rates: nr }); App.toast('Tipos de cambio guardados');
    };
    $('#syncNow').onclick = () => { S.syncNow(); App.toast('Sincronizando…'); };
    $('#hardReload').onclick = App.hardReload;
    $('#logout').onclick = async () => {
      const pend = S.pending();
      const msg = pend ? `Hay ${pend} cambio(s) sin subir a la nube que se perderán.\n¿Cerrar sesión igualmente?` : '¿Cerrar sesión en este móvil? Los datos siguen en la nube; para volver a entrar necesitarás el código.';
      if (!await App.ask(msg, { ok: 'Cerrar sesión', danger: true })) return;
      S.logout(); App.render();
    };
    $('#exp').onclick = exportBackup;
    $('#csv').onclick = exportCsv;
    $('#imp').onclick = () => $('#file').click();
    $('#file').onchange = ev => importBackup(ev.target.files[0]);
  }

  function personInUse(id) {
    return App.expenses().some(e => e.paidBy === id || (e.split && e.split[id])) || App.payments().some(p => p.from === id || p.to === id);
  }

  function colorPicker(m, current, onPick) {
    m.querySelectorAll('[data-c]').forEach(b => b.onclick = () => {
      onPick(b.dataset.c); m.querySelectorAll('[data-c]').forEach(x => x.classList.toggle('on', x === b));
    });
    return `<div class="colors">${COLORS.map(c => `<button data-c="${c}" style="background:${c}" class="${c === current ? 'on' : ''}"></button>`).join('')}</div>`;
  }

  function openStoreForm(s) {
    const isNew = !s;
    s = s ? Object.assign({}, s) : { id: 's-' + App.uid(), name: '', color: COLORS[App.stores().length % COLORS.length], factor: 1, order: App.stores().length, compare: true };
    const isHabitual = App.settings().habitualStore === s.id;
    let color = s.color;
    const m = App.sheet(`<h3>${isNew ? 'Nuevo súper' : 'Editar súper'}</h3>
      <label>Nombre</label><input id="nm" value="${esc(s.name)}" maxlength="30" autocomplete="off">
      <label>Color</label><div id="colors"></div>
      <label>Nivel de precios estimado</label>
      <div class="row"><input id="factor" type="range" min="0.80" max="1.25" step="0.01" value="${s.factor || 1}" class="grow"><b id="fval" style="width:64px;text-align:right"></b></div>
      <div class="muted">Se usa solo para productos sin precio real en este súper (100% = como Mercadona).</div>
      <label class="row check-line"><input type="checkbox" id="cmp" ${s.compare !== false ? 'checked' : ''}> Incluir en las comparaciones</label>
      <label class="row check-line"><input type="checkbox" id="hab" ${isHabitual ? 'checked' : ''}> Es nuestro súper habitual</label>
      <div class="actions">${isNew ? '' : '<button class="danger" id="del">Eliminar</button>'}<button id="cancel">Cancelar</button><button class="primary" id="ok">Guardar</button></div>`);
    const $ = x => m.querySelector(x);
    $('#colors').innerHTML = colorPicker(m, color, c => { color = c; });
    colorPicker(m, color, c => { color = c; });
    const fv = () => { $('#fval').textContent = Math.round(App.num($('#factor').value) * 100) + '%'; };
    $('#factor').oninput = fv; fv();
    $('#cancel').onclick = App.closeSheet;
    $('#ok').onclick = () => {
      const name = $('#nm').value.trim();
      if (!name) { App.toast('Escribe un nombre'); return; }
      S.put('store', Object.assign(s, { name, color, factor: App.num($('#factor').value) || 1, compare: $('#cmp').checked }));
      if ($('#hab').checked && !isHabitual) putSettings({ habitualStore: s.id });
      App.closeSheet();
    };
    const del = $('#del');
    if (del) del.onclick = async () => {
      if (isHabitual) { App.notify('Es vuestro súper habitual. Marca otro como habitual antes de eliminarlo.'); return; }
      if (!await App.confirmDelete(`¿Eliminar ${s.name}? Sus precios apuntados dejarán de usarse.`)) return;
      App.closeSheet(); App.removeWithUndo('store', s, 'Súper eliminado');
    };
  }

  function openPersonForm(p) {
    const isNew = !p;
    p = p ? Object.assign({}, p) : { id: 'p-' + App.uid(), name: '', color: COLORS[App.people().length % COLORS.length] };
    let color = p.color;
    const m = App.sheet(`<h3>${isNew ? 'Nueva persona' : 'Editar persona'}</h3>
      <label>Nombre</label><input id="nm" value="${esc(p.name)}" maxlength="30" autocomplete="off">
      <label>Color</label><div id="colors"></div>
      <div class="actions">${isNew ? '' : '<button class="danger" id="del">Eliminar</button>'}<button id="cancel">Cancelar</button><button class="primary" id="ok">Guardar</button></div>`);
    m.querySelector('#colors').innerHTML = colorPicker(m, color, c => { color = c; });
    colorPicker(m, color, c => { color = c; });
    m.querySelector('#cancel').onclick = App.closeSheet;
    m.querySelector('#ok').onclick = () => {
      const name = m.querySelector('#nm').value.trim();
      if (!name) { App.toast('Escribe un nombre'); return; }
      S.put('person', Object.assign(p, { name, color })); App.closeSheet();
    };
    const del = m.querySelector('#del');
    if (del) del.onclick = async () => {
      if (personInUse(p.id)) { App.notify('No se puede eliminar: aparece en gastos o pagos.'); return; }
      if (p.id === S.me()) { App.notify('No puedes eliminarte a ti mismo en este móvil.'); return; }
      if (!await App.confirmDelete('¿Eliminar a ' + p.name + '?')) return;
      App.closeSheet(); App.removeWithUndo('person', p, 'Persona eliminada');
    };
  }

  function openGroupForm(g) {
    const isNew = !g;
    g = g ? Object.assign({}, g) : { id: 'g-' + App.uid(), name: '', emoji: '🧳', order: App.groups().length + 1 };
    const m = App.sheet(`<h3>${isNew ? 'Nuevo grupo' : 'Editar grupo'}</h3>
      <div class="muted">Por ejemplo "Viaje Japón 2026" para ver lo que cuesta cada viaje.</div>
      <div class="row"><div style="width:80px"><label>Emoji</label><input id="em" value="${esc(g.emoji)}" maxlength="8" class="center"></div>
      <div class="grow"><label>Nombre</label><input id="nm" value="${esc(g.name)}" maxlength="30" autocomplete="off"></div></div>
      ${isNew ? '' : `<label class="row check-line"><input type="checkbox" id="arch" ${g.archived ? 'checked' : ''}> Archivado (no aparece al añadir gastos)</label>`}
      <div class="actions">${isNew ? '' : '<button class="danger" id="del">Eliminar</button>'}<button id="cancel">Cancelar</button><button class="primary" id="ok">Guardar</button></div>`);
    m.querySelector('#cancel').onclick = App.closeSheet;
    m.querySelector('#ok').onclick = () => {
      const name = m.querySelector('#nm').value.trim();
      if (!name) { App.toast('Escribe un nombre'); return; }
      const arch = m.querySelector('#arch');
      S.put('group', Object.assign(g, { name, emoji: m.querySelector('#em').value.trim() || '🧳', archived: arch ? arch.checked : false }));
      App.closeSheet();
    };
    const del = m.querySelector('#del');
    if (del) del.onclick = async () => {
      if (App.expenses().some(e => e.group === g.id)) { App.notify('Este grupo tiene gastos. Puedes archivarlo en lugar de eliminarlo.'); return; }
      if (!await App.confirmDelete('¿Eliminar el grupo ' + g.name + '?')) return;
      App.closeSheet(); App.removeWithUndo('group', g, 'Grupo eliminado');
    };
  }

  function openCategoryForm(c) {
    const isNew = !c;
    c = c ? Object.assign({}, c) : { id: 'c-' + App.uid(), name: '', emoji: '🏷️', group: null, order: App.categories().length + 1 };
    const m = App.sheet(`<h3>${isNew ? 'Nueva categoría' : 'Editar categoría'}</h3>
      <div class="row"><div style="width:80px"><label>Emoji</label><input id="em" value="${esc(c.emoji)}" maxlength="8" class="center"></div>
      <div class="grow"><label>Nombre</label><input id="nm" value="${esc(c.name)}" maxlength="30" autocomplete="off"></div></div>
      <label>Aparece en el grupo</label><select id="gr"><option value="">Todos los grupos</option>
        ${App.groups().map(g => `<option value="${g.id}" ${g.id === c.group ? 'selected' : ''}>${esc(g.emoji)} ${esc(g.name)}</option>`).join('')}</select>
      <div class="actions">${isNew ? '' : '<button class="danger" id="del">Eliminar</button>'}<button id="cancel">Cancelar</button><button class="primary" id="ok">Guardar</button></div>`);
    m.querySelector('#cancel').onclick = App.closeSheet;
    m.querySelector('#ok').onclick = () => {
      const name = m.querySelector('#nm').value.trim();
      if (!name) { App.toast('Escribe un nombre'); return; }
      S.put('category', Object.assign(c, { name, emoji: m.querySelector('#em').value.trim() || '🏷️', group: m.querySelector('#gr').value || null }));
      App.closeSheet();
    };
    const del = m.querySelector('#del');
    if (del) del.onclick = async () => {
      const n = App.expenses().filter(e => e.category === c.id).length;
      if (!await App.confirmDelete(n ? `Hay ${n} gasto(s) con esta categoría; quedarán como "Sin categoría". ¿Eliminar ${c.name}?` : `¿Eliminar la categoría ${c.name}?`)) return;
      App.closeSheet(); App.removeWithUndo('category', c, 'Categoría eliminada');
    };
  }

  // ---------- Exportar / importar ----------
  function exportBackup() {
    App.shareOrDownload(`split-carlis-${App.today()}.json`, JSON.stringify({ app: 'split-carlis', version: 2, items: S.exportAll() }), 'application/json');
  }
  function importBackup(file) {
    if (!file) return;
    const r = new FileReader();
    r.onload = async () => {
      try {
        const data = JSON.parse(r.result);
        if (data.app !== 'split-carlis' || !Array.isArray(data.items)) throw new Error('No es una copia de Split Carlis');
        const n = data.items.filter(i => i.kind === 'expense' && !i.deleted).length;
        if (!await App.ask(`¿Importar la copia (${n} gastos)? Se combinará con los datos actuales y se subirá a la nube.`, { ok: 'Importar' })) return;
        S.importAll(data.items); App.toast('Copia importada');
      } catch (e) { App.notify('No se pudo importar: ' + e.message); }
    };
    r.readAsText(file);
  }
  function exportCsv() {
    const ps = App.people();
    const q = v => '"' + String(v).replace(/"/g, '""') + '"';
    const num = c => (c / 100).toFixed(2).replace('.', ',');
    const rows = [['Fecha', 'Tipo', 'Descripción', 'Grupo', 'Categoría', 'Importe', 'Moneda', 'Total €', 'Pagado por', ...ps.map(p => 'Parte ' + p.name + ' €')].map(q).join(';')];
    App.expenses().sort((a, b) => a.date.localeCompare(b.date)).forEach(e => {
      const { total, shares } = L.expenseShares(e);
      rows.push([e.date, 'Gasto', e.description, App.group(e.group).name, App.category(e.category).name, String(e.amount).replace('.', ','), e.currency, num(total), App.person(e.paidBy).name,
        ...ps.map(p => num(shares[p.id] || 0))].map(q).join(';'));
    });
    App.payments().sort((a, b) => a.date.localeCompare(b.date)).forEach(p => {
      rows.push([p.date, 'Pago', `${App.person(p.from).name} → ${App.person(p.to).name}${p.note ? ' (' + p.note + ')' : ''}`, '', '', String(p.amount).replace('.', ','), 'EUR',
        num(Math.round(p.amount * 100)), App.person(p.from).name, ...ps.map(() => '')].map(q).join(';'));
    });
    App.shareOrDownload('split-carlis.csv', '﻿' + rows.join('\r\n'), 'text/csv');
  }

  App.modules.settings = { render };
})();
