// Editores de lo que antes venía fijo: secciones del súper, plantillas de la lista y del menú, y esenciales.
// Se muestran como apartados de Ajustes y también se abren desde Compra y Menú.
(function () {
  'use strict';
  const App = window.App, S = App.S, SL = App.SL, C = App.C;
  const esc = App.esc;
  const DAY_SHORT = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const unitLbl = p => p.unit === 'ud' ? 'ud' : p.unit;
  const shortName = n => n.replace(/\s*\(.*\)\s*$/, '');

  // ---------- Secciones del súper ----------
  function sectionsPage() {
    return {
      html() {
        const secs = S.list('section').sort(App.byOrder), ps = App.products();
        return `<div class="muted" style="margin:4px 4px 0">El orden de las secciones es el orden de la lista de la compra: ponlas como estén en vuestro súper.</div>
          <div class="card list">${secs.map((s, i) => `<div class="item"><div class="emoji">${esc(s.emoji)}</div>
            <div class="grow tap" data-sec="${s.id}"><b>${esc(s.name)}</b><div class="muted">${ps.filter(p => p.section === s.key).length} productos</div></div>
            <button class="qbtn" data-mv="${i}|-1" ${i === 0 ? 'disabled' : ''} aria-label="Subir">↑</button><button class="qbtn" data-mv="${i}|1" ${i === secs.length - 1 ? 'disabled' : ''} aria-label="Bajar">↓</button></div>`).join('')}</div>
          <button class="block small ghost" id="addSec">＋ Añadir sección</button>`;
      },
      bind(view, $, on) {
        const secs = S.list('section').sort(App.byOrder);
        view.querySelectorAll('[data-sec]').forEach(el => el.onclick = () => openSection(S.get(el.dataset.sec)));
        view.querySelectorAll('[data-mv]').forEach(b => b.onclick = () => {
          const [i, d] = b.dataset.mv.split('|').map(Number);
          const arr = secs.slice(); const [x] = arr.splice(i, 1); arr.splice(i + d, 0, x);
          S.putMany(arr.map((s, k) => ({ kind: 'section', data: Object.assign({}, s, { order: k }) })));
        });
        on('#addSec', () => openSection(null));
      }
    };
  }
  function openSection(sec) {
    const isNew = !sec;
    sec = sec ? Object.assign({}, sec) : { id: 'sec-' + App.uid(), key: 's' + App.uid(), emoji: '🛍️', name: '', order: S.list('section').length };
    const n = App.products().filter(p => p.section === sec.key).length;
    const m = App.sheet(`<h3>${isNew ? 'Nueva sección' : 'Editar sección'}</h3>
      <div class="row"><div style="width:76px"><label>Emoji</label><input id="em" value="${esc(sec.emoji)}" maxlength="8" class="center"></div>
        <div class="grow"><label>Nombre</label><input id="nm" value="${esc(sec.name)}" maxlength="40" autocomplete="off"></div></div>
      <div class="actions">${isNew || sec.key === 'otros' ? '' : '<button class="danger" id="del">Eliminar</button>'}<button id="cancel">Cancelar</button><button class="primary" id="ok">Guardar</button></div>`);
    const $ = s => m.querySelector(s);
    $('#cancel').onclick = App.closeSheet;
    $('#ok').onclick = () => {
      const name = $('#nm').value.trim();
      if (!name) { App.toast('Ponle un nombre'); return; }
      S.put('section', Object.assign(sec, { name, emoji: $('#em').value.trim() || '🛍️' }));
      App.closeSheet();
    };
    if ($('#del')) $('#del').onclick = async () => {
      if (!await App.confirmDelete(n ? `Sus ${n} productos pasarán a «Otros». ¿Eliminar ${sec.name}?` : `¿Eliminar ${sec.name}?`)) return;
      const ps = App.products().filter(p => p.section === sec.key), items = App.shopItems().filter(i => i.section === sec.key);
      S.putMany([{ kind: 'section', data: sec, deleted: true },
        ...ps.map(p => ({ kind: 'product', data: Object.assign({}, p, { section: 'otros' }) })),
        ...items.map(i => ({ kind: 'shopitem', data: Object.assign({}, i, { section: 'otros' }) }))]);
      App.closeSheet(); App.toast('Sección eliminada');
    };
    if (isNew) setTimeout(() => $('#nm').focus(), 80);
  }

  // ---------- Plantillas de la lista ----------
  function shopTplPage() {
    return {
      html: () => `<div class="muted" style="margin:4px 4px 0">Se añaden a la lista desde Compra → Plantillas, sin duplicar lo que ya está.</div>
        <div class="card list">${App.shopTemplates().map(t => `<div class="item tap" data-tpl="${t.id}"><div class="emoji">${esc(t.emoji)}</div><div class="grow"><b>${esc(t.name)}</b>
          <div class="muted">${(t.items || []).length} productos</div></div>›</div>`).join('') || '<div class="muted">No hay plantillas.</div>'}</div>
        <button class="block small ghost" id="addTpl">＋ Nueva plantilla</button>`,
      bind(view, $, on) {
        view.querySelectorAll('[data-tpl]').forEach(el => el.onclick = () => openShopTemplate(S.get(el.dataset.tpl)));
        on('#addTpl', () => openShopTemplate(null));
      }
    };
  }
  function openShopTemplate(t, opts) {
    opts = opts || {};
    const isNew = !t;
    t = t ? JSON.parse(JSON.stringify(t)) : { id: 'tpl-s-' + App.uid(), emoji: '📋', name: '', items: opts.items || [], order: App.shopTemplates().length };
    const m = App.sheet(`<h3>${isNew ? 'Nueva plantilla de lista' : 'Editar plantilla'}</h3>
      <div class="row"><div style="width:76px"><label>Emoji</label><input id="em" value="${esc(t.emoji)}" maxlength="8" class="center"></div>
        <div class="grow"><label>Nombre</label><input id="nm" value="${esc(t.name)}" maxlength="40" autocomplete="off" placeholder="Ej: Compra del finde"></div></div>
      <label>Productos y cantidad</label><div class="list tight" id="its"></div>
      <button class="small block" id="addIt">＋ Añadir producto</button>
      <div class="actions">${isNew ? '' : '<button class="danger" id="del">Eliminar</button>'}<button id="cancel">Cancelar</button><button class="primary" id="ok">Guardar</button></div>`);
    const $ = s => m.querySelector(s);
    function draw() {
      const pById = App.productsById();
      $('#its').innerHTML = t.items.map(([pid, amount], i) => {
        const p = pById[pid];
        return `<div class="item"><div class="grow ellipsis">${p ? esc(p.name) : '<span class="muted">Producto borrado</span>'}</div>
          <input type="text" inputmode="decimal" autocomplete="off" class="qty-input" data-ia="${i}" value="${amount}"><span class="unit">${p ? esc(unitLbl(p)) : ''}</span>
          <button class="xbtn" data-ix="${i}" aria-label="Quitar">✕</button></div>`;
      }).join('') || '<div class="muted" style="padding:8px 0">Sin productos todavía.</div>';
      m.querySelectorAll('[data-ia]').forEach(inp => inp.oninput = () => { t.items[+inp.dataset.ia][1] = App.num(inp.value) || 0; });
      m.querySelectorAll('[data-ix]').forEach(b => b.onclick = () => { t.items.splice(+b.dataset.ix, 1); draw(); });
    }
    $('#addIt').onclick = () => App.pickProduct(p => {
      if (t.items.some(x => x[0] === p.id)) { App.toast('Ya está en la plantilla'); return; }
      t.items.push([p.id, App.modules.shop.defaultAmount(p)]); draw();
    });
    $('#cancel').onclick = App.closeSheet;
    $('#ok').onclick = () => {
      t.name = $('#nm').value.trim(); t.emoji = $('#em').value.trim() || '📋';
      if (!t.name) { App.toast('Ponle un nombre'); return; }
      t.items = t.items.filter(x => x[1] > 0);
      if (!t.items.length) { App.toast('Añade al menos un producto'); return; }
      S.put('shoptpl', t); App.closeSheet(); App.toast('Plantilla guardada');
    };
    if ($('#del')) $('#del').onclick = async () => {
      if (!await App.confirmDelete(`¿Eliminar la plantilla ${t.name}?`)) return;
      App.closeSheet(); App.removeWithUndo('shoptpl', S.get(t.id), 'Plantilla eliminada');
    };
    draw();
  }
  function saveListAsTemplate() {
    const items = [];
    App.shopItems().forEach(i => { if (i.product && !items.some(x => x[0] === i.product)) items.push([i.product, i.amount]); });
    if (!items.length) { App.toast('La lista no tiene productos del catálogo'); return; }
    openShopTemplate(null, { items });
  }

  // ---------- Plantillas del menú ----------
  function menuTplPage() {
    return {
      html: () => `<div class="muted" style="margin:4px 4px 0">Rellenan los huecos vacíos de la semana desde Menú → Plantillas. También puedes guardar una semana como plantilla.</div>
        <div class="card list">${App.menuTemplates().map(t => {
          const n = Object.values(t.plan || {}).reduce((a, l) => a + l.filter(Boolean).length, 0);
          return `<div class="item tap" data-tpl="${t.id}"><div class="emoji">${esc(t.emoji)}</div><div class="grow"><b>${esc(t.name)}</b><div class="muted">${n} comidas</div></div>›</div>`;
        }).join('') || '<div class="muted">No hay plantillas.</div>'}</div>
        <button class="block small ghost" id="addTpl">＋ Nueva plantilla</button>`,
      bind(view, $, on) {
        view.querySelectorAll('[data-tpl]').forEach(el => el.onclick = () => openMenuTemplate(S.get(el.dataset.tpl)));
        on('#addTpl', () => openMenuTemplate(null));
      }
    };
  }
  function openMenuTemplate(t, opts) {
    opts = opts || {};
    const isNew = !t;
    t = t ? JSON.parse(JSON.stringify(t)) : { id: 'tpl-m-' + App.uid(), emoji: '📅', name: '', plan: opts.plan || {}, order: App.menuTemplates().length };
    const meals = App.enabledMeals(), recipes = App.recipes();
    const sel = (meal, i) => {
      const cur = (t.plan[meal.id] || [])[i] || '';
      const fit = recipes.filter(r => (r.meals || []).includes(meal.id)), rest = recipes.filter(r => !(r.meals || []).includes(meal.id));
      const opt = r => `<option value="${r.id}" ${r.id === cur ? 'selected' : ''}>${esc(r.emoji)} ${esc(r.name)}</option>`;
      return `<select data-pl="${meal.id}|${i}"><option value="">—</option>${fit.map(opt).join('')}${rest.length ? `<optgroup label="Otras">${rest.map(opt).join('')}</optgroup>` : ''}</select>`;
    };
    const m = App.sheet(`<h3>${isNew ? 'Nueva plantilla de menú' : 'Editar plantilla'}</h3>
      <div class="row"><div style="width:76px"><label>Emoji</label><input id="em" value="${esc(t.emoji)}" maxlength="8" class="center"></div>
        <div class="grow"><label>Nombre</label><input id="nm" value="${esc(t.name)}" maxlength="40" autocomplete="off" placeholder="Ej: Semana de invierno"></div></div>
      ${DAY_SHORT.map((d, i) => `<div class="section-label">${d}</div>${meals.map(meal => `<div class="row tplrow"><span class="slotmeal">${meal.emoji} ${esc(meal.name)}</span><div class="grow">${sel(meal, i)}</div></div>`).join('')}`).join('')}
      <div class="actions">${isNew ? '' : '<button class="danger" id="del">Eliminar</button>'}<button id="cancel">Cancelar</button><button class="primary" id="ok">Guardar</button></div>`);
    const $ = s => m.querySelector(s);
    $('#cancel').onclick = App.closeSheet;
    $('#ok').onclick = () => {
      t.name = $('#nm').value.trim(); t.emoji = $('#em').value.trim() || '📅';
      if (!t.name) { App.toast('Ponle un nombre'); $('#nm').focus(); return; }
      const plan = {};
      // Se conservan las comidas que no se planifican ahora (p. ej. tupper desactivado).
      Object.entries(t.plan || {}).forEach(([k, l]) => { if (!meals.some(x => x.id === k)) plan[k] = l; });
      m.querySelectorAll('[data-pl]').forEach(s => {
        const [meal, i] = s.dataset.pl.split('|');
        if (!s.value) return;
        plan[meal] = plan[meal] || [null, null, null, null, null, null, null];
        plan[meal][+i] = s.value;
      });
      if (!Object.keys(plan).length) { App.toast('Elige al menos una comida'); return; }
      t.plan = plan;
      S.put('menutpl', t); App.closeSheet(); App.toast('Plantilla guardada');
    };
    if ($('#del')) $('#del').onclick = async () => {
      if (!await App.confirmDelete(`¿Eliminar la plantilla ${t.name}?`)) return;
      App.closeSheet(); App.removeWithUndo('menutpl', S.get(t.id), 'Plantilla eliminada');
    };
    if (isNew) setTimeout(() => $('#nm').focus(), 80);
  }

  // ---------- Esenciales ----------
  function essentialsPage() {
    return {
      html() {
        const st = App.modules.shop.essentialsStatus();
        let lastSec = null, h = `<div class="muted" style="margin:4px 4px 0">Lo que se compra aunque no esté en el menú. Si está en la despensa, baja solo cada día: lo que soléis comprar entre los días que dura.</div>`;
        st.forEach(e => {
          const sec = App.section(e.p.section);
          if (sec.id !== lastSec) { h += `${lastSec !== null ? '</div>' : ''}<div class="sechdr">${esc(sec.emoji)} ${esc(sec.name)}</div><div class="card list tight">`; lastSec = sec.id; }
          const lbl = App.modules.shop.essLabel(e);
          h += `<div class="item essrow"><div class="grow"><div class="ellipsis tap" data-ep="${e.p.id}">${esc(e.p.name)}</div>
              <div class="muted">${e.stock ? 'en casa: ' + lbl : e.never ? 'aún sin comprar' : 'última compra ' + lbl}${e.due ? ' · <span class="neg">toca reponer</span>' : ''}</div>
              <div class="row essin"><span class="muted">compráis</span><input type="text" inputmode="decimal" autocomplete="off" data-eq="${e.p.id}" value="${e.p.essentialQty || App.modules.shop.defaultAmount(e.p)}"><span class="muted">${esc(unitLbl(e.p))} cada</span>
                <input type="text" inputmode="numeric" autocomplete="off" data-ev="${e.p.id}" value="${e.p.every || 30}"><span class="muted">días</span></div></div>
            <button class="xbtn" data-eu="${e.p.id}" aria-label="Quitar de esenciales">✕</button></div>`;
        });
        if (lastSec !== null) h += '</div>';
        if (!st.length) h += '<div class="card empty">No hay esenciales.</div>';
        return h + '<button class="block small ghost" id="addEss">＋ Añadir esencial</button>';
      },
      bind(view, $, on) {
        const save = (inp, field, int) => {
          const v = int ? Math.round(App.num(inp.value)) : App.num(inp.value);
          const cur = S.get(inp.dataset[field === 'every' ? 'ev' : 'eq']);
          if (!(v > 0) || !cur || cur[field] === v) return;
          S.put('product', Object.assign({}, cur, { [field]: v }));
        };
        view.querySelectorAll('[data-ev]').forEach(inp => { inp.onchange = () => save(inp, 'every', true); });
        view.querySelectorAll('[data-eq]').forEach(inp => { inp.onchange = () => save(inp, 'essentialQty', false); });
        view.querySelectorAll('[data-ep]').forEach(el => el.onclick = () => App.modules.shop.openProduct(S.get(el.dataset.ep)));
        view.querySelectorAll('[data-eu]').forEach(b => b.onclick = () => {
          const p = S.get(b.dataset.eu);
          S.put('product', Object.assign({}, p, { essential: false }));
          App.toast(`${shortName(p.name)} ya no es esencial`, { undo: () => S.put('product', Object.assign({}, S.get(p.id), { essential: true })) });
        });
        on('#addEss', () => App.pickProduct(p => {
          S.put('product', Object.assign({}, p, { essential: true, every: p.every || 30, essentialQty: p.essentialQty || App.modules.shop.defaultAmount(p) }));
          App.toast(`${shortName(p.name)} añadido a esenciales`);
        }));
      }
    };
  }

  App.settingsTitles = Object.assign(App.settingsTitles || {}, { sections: 'Secciones del súper', shoptpl: 'Plantillas de la lista', menutpl: 'Plantillas del menú', essentials: 'Esenciales' });
  App.settingsPages = Object.assign(App.settingsPages || {}, { sections: sectionsPage(), shoptpl: shopTplPage(), menutpl: menuTplPage(), essentials: essentialsPage() });
  App.edit = { openSection, openShopTemplate, openMenuTemplate, saveListAsTemplate };
})();
