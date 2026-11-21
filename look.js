// Apariencia: tema (automático / claro / oscuro), color principal, fondo y tamaño de letra.
// Se guarda en cada móvil (no se sincroniza) y se aplica antes de pintar para que no parpadee.
(function () {
  'use strict';
  const KEY = 'splitcarlis.look';
  const DEF = { theme: 'auto', accent: 'naranja', base: 'calido', size: 'm' };

  // [id, nombre, color en claro, color en oscuro]
  const ACCENTS = [
    ['naranja', 'Monchi', '#d9822b', '#f0a054'],
    ['teja', 'Teja', '#c4512d', '#f08a64'],
    ['oliva', 'Oliva', '#617f22', '#a9cf5c'],
    ['verde', 'Menta', '#13836a', '#4fd1a8'],
    ['azul', 'Azul', '#2f6fdb', '#7aa7ff'],
    ['morado', 'Lavanda', '#7048e8', '#a991ff'],
    ['rosa', 'Hierba', '#c2255c', '#ff7aa8'],
    ['grafito', 'Grafito', '#3d4450', '#d5dae1']
  ];
  // Fondos: [id, nombre, claro, oscuro]  (bg, card, raise, text, muted, line)
  const BASES = [
    ['calido', 'Cálido', ['#f7f3ee', '#ffffff', '#f1ebe3', '#1f1b17', '#756c63', '#ebe3d9'], ['#151311', '#201d1a', '#2a2622', '#f3efea', '#a8a097', '#36312c']],
    ['neutro', 'Neutro', ['#f4f5f7', '#ffffff', '#eceef1', '#1b1d21', '#6b7079', '#e3e6ea'], ['#121316', '#1c1d21', '#26282d', '#eef0f3', '#9aa0a8', '#30333a']],
    ['frio', 'Frío', ['#eef3f8', '#ffffff', '#e3ebf3', '#17202a', '#62707f', '#dbe4ee'], ['#0f141a', '#18202a', '#212b36', '#e9eef4', '#93a0ae', '#2b3642']],
    ['negro', 'Negro', ['#f4f5f7', '#ffffff', '#eceef1', '#1b1d21', '#6b7079', '#e3e6ea'], ['#000000', '#111111', '#1c1c1c', '#f2f2f2', '#9a9a9a', '#272727']]
  ];
  const SIZES = { s: '15px', m: '16px', l: '17.5px' };

  const get = () => { try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { return Object.assign({}, DEF); } };
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function apply() {
    const l = get(), root = document.documentElement;
    const dark = l.theme === 'dark' || (l.theme === 'auto' && mq && mq.matches);
    const acc = ACCENTS.find(a => a[0] === l.accent) || ACCENTS[0];
    const base = BASES.find(b => b[0] === l.base) || BASES[0];
    const [bg, card, raise, text, muted, line] = dark ? base[3] : base[2];
    const a = dark ? acc[3] : acc[2];
    const vars = {
      '--bg': bg, '--card': card, '--raise': raise, '--text': text, '--muted': muted, '--line': line,
      '--accent': a, '--accent-ink': dark ? '#16110a' : '#ffffff',
      '--accent-soft': `color-mix(in srgb, ${a} ${dark ? 22 : 14}%, ${card})`,
      '--pos': dark ? '#5fd08f' : '#1e7a46', '--pos-soft': dark ? '#1a3325' : '#e3f3ea',
      '--neg': dark ? '#ff8a80' : '#b3261e', '--neg-soft': dark ? '#3a1f1d' : '#fbe9e7',
      '--warn': dark ? '#f0c050' : '#a86b00', '--warn-soft': dark ? '#3a3019' : '#fff4d6',
      '--shadow': dark ? 'none' : '0 1px 2px rgba(60,40,20,.06), 0 4px 14px rgba(60,40,20,.05)',
      '--base-size': SIZES[l.size] || SIZES.m
    };
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    root.dataset.theme = dark ? 'dark' : 'light';
    root.style.colorScheme = dark ? 'dark' : 'light';
    document.querySelectorAll('meta[name=theme-color]').forEach(m => { m.setAttribute('content', bg); m.removeAttribute('media'); });
  }
  function set(patch) {
    try { localStorage.setItem(KEY, JSON.stringify(Object.assign(get(), patch))); } catch (e) {}
    apply();
  }
  if (mq && mq.addEventListener) mq.addEventListener('change', apply);
  window.Look = { get, set, apply, ACCENTS, BASES };
  apply();
})();
