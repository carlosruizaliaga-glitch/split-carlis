// Lógica pura de compra y menú (sin DOM): precios, cantidades, comparador y ahorro.
(function (root) {
  'use strict';
  const round2 = x => Math.round(x * 100) / 100;
  const EPS = 1e-9;

  // Precio de un envase (o de 1 kg/l si es a granel) en un súper.
  // Devuelve { p, src, t } o null. src: web | manual | ticket | estimado.
  function priceInfo(product, store) {
    if (!product || !store) return null;
    const r = product.prices && product.prices[store.id];
    if (r && r.p > 0) return { p: r.p, src: r.src || 'manual', t: r.t || null };
    if (product.price > 0) return { p: round2(product.price * (store.factor || 1)), src: 'estimado', t: null };
    return null;
  }

  // Envases que hay que comprar para tener `amount` (a granel: fracción exacta).
  function packsFor(product, amount) {
    if (!product || !(product.pack > 0)) return amount;
    if (product.bulk) return amount / product.pack;
    return Math.max(1, Math.ceil(amount / product.pack - EPS));
  }

  // Coste de una línea de la lista en un súper. null si no hay precio.
  function lineCost(line, product, store) {
    // Producto escrito a mano: precio por unidad, el mismo en todos los súpers.
    if (!product) return line.price > 0 ? round2(line.price * (line.amount || 1)) : null;
    const info = priceInfo(product, store);
    if (!info) return null;
    return round2(packsFor(product, line.amount) * info.p);
  }

  // Cantidad legible: 1,5 kg · 750 g · 2 l · 3 ud.
  function fmtAmount(unit, amount) {
    const n = (v, d) => (+v.toFixed(d)).toLocaleString('es-ES');
    if (unit === 'g') return amount >= 1000 ? n(amount / 1000, 2) + ' kg' : n(amount, 0) + ' g';
    if (unit === 'ml') return amount >= 1000 ? n(amount / 1000, 2) + ' l' : n(amount, 0) + ' ml';
    return n(amount, 2) + ' ud';
  }

  // Paso de los botones −/+: un envase, o 250 g / 250 ml si es a granel por kg/l.
  function stepFor(product) {
    if (!product) return 1;
    if (product.bulk) return product.unit === 'ud' ? 1 : Math.max(50, product.pack / 4);
    return product.pack;
  }

  // Suma los ingredientes de las comidas planificadas: { productId: cantidad }.
  function menuNeeds(meals, recipesById) {
    const need = {};
    meals.forEach(m => {
      const r = m.recipe && recipesById[m.recipe];
      if (!r) return;
      const factor = (m.servings || 2) / (r.servings || 1);
      (r.ingredients || []).forEach(ing => {
        if (!ing.product || !(ing.qty > 0)) return;
        need[ing.product] = (need[ing.product] || 0) + ing.qty * factor;
      });
    });
    return need;
  }

  // Total de la lista en cada súper.
  // lines: [{ product, amount, price? }]. Si un producto no tiene precio en un súper,
  // se usa la media de los súpers que sí lo tienen y se marca como "supuesto".
  function compareStores(lines, stores, productsById) {
    const res = stores.map(s => ({ store: s, total: 0, real: 0, estimated: 0, assumed: 0 }));
    lines.forEach(line => {
      const product = line.product ? productsById[line.product] : null;
      const costs = stores.map(s => lineCost(line, product, s));
      const known = costs.filter(c => c != null);
      if (!known.length) return;
      const avg = known.reduce((a, b) => a + b, 0) / known.length;
      costs.forEach((c, i) => {
        if (c == null) { res[i].total += avg; res[i].assumed++; return; }
        res[i].total += c;
        const info = product ? priceInfo(product, stores[i]) : { src: 'manual' };
        if (info && info.src === 'estimado') res[i].estimated++; else res[i].real++;
      });
    });
    res.forEach(r => { r.total = round2(r.total); });
    return res.sort((a, b) => a.total - b.total || a.store.order - b.store.order);
  }

  // Mejor reparto entre 2 súpers: cada producto donde sea más barato de los dos.
  function costMatrix(lines, stores, productsById) {
    // Sin precio en un súper → media de los que sí lo tienen (igual que compareStores).
    return lines.map(line => {
      const product = line.product ? productsById[line.product] : null;
      const row = stores.map(s => lineCost(line, product, s));
      const known = row.filter(c => c != null);
      if (!known.length) return null;
      const avg = known.reduce((a, b) => a + b, 0) / known.length;
      return row.map(c => c == null ? avg : c);
    });
  }

  function bestPair(lines, stores, productsById) {
    const costs = costMatrix(lines, stores, productsById);
    let best = null;
    for (let a = 0; a < stores.length; a++) {
      for (let b = a + 1; b < stores.length; b++) {
        let total = 0; const inA = [], inB = [];
        costs.forEach((row, i) => {
          if (!row) return;
          if (row[a] <= row[b]) { total += row[a]; inA.push(i); } else { total += row[b]; inB.push(i); }
        });
        total = round2(total);
        if (!best || total < best.total) best = { a: stores[a], b: stores[b], total, inA, inB };
      }
    }
    // Si uno de los dos no recibe nada, no es un reparto real.
    if (best && (!best.inA.length || !best.inB.length)) return null;
    return best;
  }

  // Para cada producto: coste en el súper de referencia, el más barato y el ahorro.
  function alternatives(lines, stores, productsById, ref) {
    return lines.map((line, i) => {
      const product = line.product ? productsById[line.product] : null;
      const refCost = lineCost(line, product, ref);
      let cheapest = null;
      stores.forEach(s => {
        const c = lineCost(line, product, s);
        if (c != null && (!cheapest || c < cheapest.cost)) cheapest = { store: s, cost: c };
      });
      const saving = refCost != null && cheapest ? round2(refCost - cheapest.cost) : 0;
      return { index: i, line, product, refCost, cheapest, saving };
    }).filter(a => a.saving > 0.004).sort((a, b) => b.saving - a.saving);
  }

  // Referencia para medir el ahorro de una compra: lo que habría costado de media
  // y en el súper más caro de los que comparáis.
  function purchaseReference(lines, stores, productsById) {
    const cmp = compareStores(lines, stores, productsById);
    if (!cmp.length) return { avg: 0, max: 0 };
    const avg = round2(cmp.reduce((a, r) => a + r.total, 0) / cmp.length);
    return { avg, max: cmp[cmp.length - 1].total };
  }

  // ---------- Nutrición ----------
  // p.nut va por 100 g / 100 ml, o por unidad si el producto se cuenta en unidades.
  const NUT_KEYS = ['kcal', 'p', 'hc', 'g', 'fib', 'sal'];
  const emptyNut = () => ({ kcal: 0, p: 0, hc: 0, g: 0, fib: 0, sal: 0 });
  function nutFor(p, amount) {
    if (!p || !p.nut) return null;
    const f = p.unit === 'ud' ? amount : amount / 100;
    const out = emptyNut();
    NUT_KEYS.forEach(k => { out[k] = (+p.nut[k] || 0) * f; });
    return out;
  }
  // Nutrición de una receta POR PERSONA. missing = ingredientes sin datos.
  function recipeNut(r, productsById) {
    const tot = emptyNut(), missing = [];
    (r.ingredients || []).forEach(ing => {
      const p = productsById[ing.product]; if (!p) return;
      const n = nutFor(p, ing.qty / (r.servings || 1));
      if (!n) { missing.push(p.name); return; }
      NUT_KEYS.forEach(k => { tot[k] += n[k]; });
    });
    return { nut: tot, missing };
  }
  function addNut(a, b, factor) { NUT_KEYS.forEach(k => { a[k] += (b[k] || 0) * (factor == null ? 1 : factor); }); return a; }

  // ---------- Despensa ----------
  // Lo que queda NO se guarda: se calcula desde el último ajuste a mano (stock.qty en stock.at)
  // sumando compras y restando comidas del menú y el gasto diario de los esenciales, en orden
  // y sin bajar de 0. Así los dos móviles llegan al mismo número y nada se descuenta dos veces.
  const DAY = 86400000;
  const dayStart = ms => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const mealTime = m => m.doneAt || (new Date(m.date + 'T00:00:00').getTime() + DAY); // al acabar su día
  // Gasto diario de un esencial: lo que se suele comprar repartido entre los días de su frecuencia.
  function dailyUse(p) {
    if (!p || !p.essential || !(p.every > 0)) return 0;
    return (p.essentialQty || p.pack || 1) / p.every;
  }
  // ctx: { purchases, meals, recipesById, now }
  function stockLevel(stock, p, ctx) {
    const pid = stock.product, ev = [];
    (ctx.purchases || []).forEach(pu => {
      const t = pu.createdAt || 0;
      if (t <= stock.at || t > ctx.now) return;
      (pu.items || []).forEach(i => { if (i.product === pid && i.amount > 0) ev.push([t, i.amount]); });
    });
    const perDay = dailyUse(p);
    if (perDay) {
      // Los esenciales bajan por su frecuencia (no por las recetas, para no contarlos dos veces).
      for (let t = dayStart(stock.at) + DAY; t <= ctx.now; t += DAY) ev.push([t, -perDay]);
    } else {
      (ctx.meals || []).forEach(m => {
        if (!m.recipe || m.skip) return;
        const t = mealTime(m);
        if (t <= stock.at || t > ctx.now) return;
        const r = ctx.recipesById[m.recipe]; if (!r) return;
        (r.ingredients || []).forEach(ing => {
          if (ing.product === pid) ev.push([t, -(ing.qty * (m.servings || 2) / (r.servings || 1))]);
        });
      });
    }
    ev.sort((a, b) => a[0] - b[0]);
    let q = Math.max(0, +stock.qty || 0);
    ev.forEach(([, d]) => { q = Math.max(0, q + d); });
    q = Math.round(q * 100) / 100;
    return { qty: q, perDay, daysLeft: perDay ? q / perDay : null };
  }

  const api = { priceInfo, packsFor, lineCost, fmtAmount, stepFor, menuNeeds, compareStores, bestPair, alternatives, purchaseReference, round2,
    NUT_KEYS, emptyNut, nutFor, recipeNut, addNut, stockLevel, dailyUse, mealTime };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ShopLogic = api;
})(this);
