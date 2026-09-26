// Lógica pura de cálculo (sin DOM). Todos los importes internos en céntimos de euro (enteros).
(function (root) {
  'use strict';

  // Reparte `total` (entero) según `weights` usando el método del mayor resto,
  // de modo que la suma de las partes sea exactamente `total`.
  function distribute(total, weights) {
    const sumW = weights.reduce((a, b) => a + b, 0);
    if (sumW <= 0) return weights.map(() => 0);
    const raw = weights.map(w => (total * w) / sumW);
    const parts = raw.map(Math.floor);
    let rest = total - parts.reduce((a, b) => a + b, 0);
    const order = raw
      .map((r, i) => ({ i, frac: r - Math.floor(r) }))
      .sort((a, b) => b.frac - a.frac || a.i - b.i);
    for (let k = 0; rest > 0; k = (k + 1) % order.length, rest--) parts[order[k].i]++;
    return parts;
  }

  // Convierte un importe en la moneda original a céntimos de euro.
  // rate = unidades de la moneda por 1 euro.
  function toEurCents(amount, currency, rate) {
    if (currency && currency !== 'EUR') return Math.round((amount / rate) * 100);
    return Math.round(amount * 100);
  }

  // Monedas sin decimales.
  const NO_DECIMALS = ['JPY', 'KRW', 'HUF', 'ISK', 'CLP', 'VND', 'IDR'];
  const decimalsOf = cur => NO_DECIMALS.includes(cur) ? 0 : 2;

  // Devuelve { total, shares: {personId: cents} } de un gasto, en céntimos de euro.
  function expenseShares(exp) {
    const total = toEurCents(exp.amount, exp.currency, exp.rate);
    const ids = Object.keys(exp.split || {});
    let weights;
    if (exp.mode === 'equal') {
      weights = ids.map(id => (exp.split[id] ? 1 : 0));
    } else if (exp.mode === 'exact') {
      // Importes exactos en la moneda original: se usan como pesos para que
      // la suma cuadre al céntimo tras la conversión.
      weights = ids.map(id => Math.max(0, Number(exp.split[id]) || 0));
    } else if (exp.mode === 'percent') {
      weights = ids.map(id => Math.max(0, Number(exp.split[id]) || 0));
    } else {
      weights = ids.map(() => 0);
    }
    const parts = distribute(total, weights);
    const shares = {};
    ids.forEach((id, i) => { if (parts[i]) shares[id] = parts[i]; });
    return { total, shares };
  }

  // Valida un gasto. Devuelve un mensaje de error o null.
  function validateExpense(exp) {
    if (!exp.description || !exp.description.trim()) return 'Pon una descripción.';
    if (!(exp.amount > 0)) return 'El importe debe ser mayor que 0.';
    if (!exp.paidBy) return 'Elige quién pagó.';
    if (exp.currency !== 'EUR' && !(exp.rate > 0)) return 'Tipo de cambio no válido.';
    const vals = Object.values(exp.split || {});
    if (exp.mode === 'equal') {
      if (!vals.some(Boolean)) return 'Marca al menos una persona.';
    } else if (exp.mode === 'exact') {
      const sum = vals.reduce((a, b) => a + (Number(b) || 0), 0);
      const dec = decimalsOf(exp.currency);
      if (Math.abs(sum - exp.amount) > (dec ? 0.005 : 0.5)) {
        return 'Los importes suman ' + sum.toFixed(dec) + ' y el total es ' + Number(exp.amount).toFixed(dec) + '.';
      }
    } else if (exp.mode === 'percent') {
      const sum = vals.reduce((a, b) => a + (Number(b) || 0), 0);
      if (Math.abs(sum - 100) > 0.01) return 'Los porcentajes suman ' + +sum.toFixed(2) + '%, deben sumar 100%.';
    }
    return null;
  }

  // Saldos netos por persona (céntimos). Positivo = le deben; negativo = debe.
  function computeBalances(state) {
    const bal = {}, paid = {}, owed = {};
    state.people.forEach(p => { bal[p.id] = 0; paid[p.id] = 0; owed[p.id] = 0; });
    const ensure = id => { if (!(id in bal)) { bal[id] = 0; paid[id] = 0; owed[id] = 0; } };
    state.expenses.forEach(e => {
      const { total, shares } = expenseShares(e);
      ensure(e.paidBy);
      bal[e.paidBy] += total;
      paid[e.paidBy] += total;
      Object.entries(shares).forEach(([id, c]) => { ensure(id); bal[id] -= c; owed[id] += c; });
    });
    state.payments.forEach(p => {
      const c = toEurCents(p.amount, p.currency, p.rate);
      ensure(p.from); ensure(p.to);
      bal[p.from] += c;
      bal[p.to] -= c;
    });
    return { bal, paid, owed };
  }

  // Minimiza el número de transferencias para saldar todas las deudas.
  function settleUp(bal) {
    const debtors = [], creditors = [];
    Object.entries(bal).forEach(([id, c]) => {
      if (c < 0) debtors.push({ id, c: -c });
      else if (c > 0) creditors.push({ id, c });
    });
    debtors.sort((a, b) => b.c - a.c);
    creditors.sort((a, b) => b.c - a.c);
    const out = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const x = Math.min(debtors[i].c, creditors[j].c);
      if (x > 0) out.push({ from: debtors[i].id, to: creditors[j].id, cents: x });
      debtors[i].c -= x; creditors[j].c -= x;
      if (debtors[i].c === 0) i++;
      if (creditors[j].c === 0) j++;
    }
    return out;
  }

  const api = { distribute, toEurCents, decimalsOf, expenseShares, validateExpense, computeBalances, settleUp };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Logic = api;
})(this);
