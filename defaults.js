// Datos iniciales. Los ids son fijos para que, si los dos móviles los crean a la vez, no se dupliquen.
window.DEFAULTS = {
  people: [
    { id: 'p-carlos', name: 'Carlos', color: '#3b5bdb' },
    { id: 'p-amparo', name: 'Amparo', color: '#c2255c' }
  ],
  groups: [
    { id: 'g-casa', name: 'Casa', emoji: '🏠', order: 1 },
    { id: 'g-ocio', name: 'Ocio', emoji: '🎉', order: 2 },
    { id: 'g-viajes', name: 'Viajes', emoji: '✈️', order: 3 }
  ],
  // group: grupo donde se sugiere la categoría (null = en todos).
  categories: [
    ['c-alquiler', '🔑', 'Alquiler / hipoteca', 'g-casa'],
    ['c-luz', '💡', 'Luz', 'g-casa'],
    ['c-agua', '💧', 'Agua', 'g-casa'],
    ['c-gas', '🔥', 'Gas', 'g-casa'],
    ['c-internet', '📶', 'Internet y móvil', 'g-casa'],
    ['c-comunidad', '🏢', 'Comunidad', 'g-casa'],
    ['c-seguros', '🛡️', 'Seguros', 'g-casa'],
    ['c-super', '🛒', 'Supermercado', 'g-casa'],
    ['c-limpieza', '🧽', 'Limpieza y hogar', 'g-casa'],
    ['c-muebles', '🛋️', 'Muebles y decoración', 'g-casa'],
    ['c-reparaciones', '🔧', 'Reparaciones', 'g-casa'],
    ['c-monchi', '🐱', 'Monchi y Hierba', 'g-casa'],
    ['c-restaurantes', '🍽️', 'Restaurantes', 'g-ocio'],
    ['c-bares', '🍻', 'Bares y copas', 'g-ocio'],
    ['c-cine', '🎬', 'Cine y espectáculos', 'g-ocio'],
    ['c-suscripciones', '📺', 'Suscripciones', 'g-ocio'],
    ['c-deporte', '⚽', 'Deporte', 'g-ocio'],
    ['c-regalos', '🎁', 'Regalos', 'g-ocio'],
    ['c-ropa', '👕', 'Ropa', 'g-ocio'],
    ['c-vuelos', '🛫', 'Vuelos', 'g-viajes'],
    ['c-transporte', '🚆', 'Transporte', 'g-viajes'],
    ['c-alojamiento', '🏨', 'Alojamiento', 'g-viajes'],
    ['c-actividades', '🎟️', 'Actividades y entradas', 'g-viajes'],
    ['c-comida-viaje', '🍜', 'Comida de viaje', 'g-viajes'],
    ['c-coche', '🚗', 'Coche y gasolina', null],
    ['c-parking', '🅿️', 'Parking y peajes', null],
    ['c-salud', '💊', 'Salud y farmacia', null],
    ['c-cuidado', '💇', 'Cuidado personal', null],
    ['c-otros', '📦', 'Otros', null]
  ].map(([id, emoji, name, group], i) => ({ id, emoji, name, group, order: i })),
  settings: {
    id: 'settings',
    // Unidades de cada moneda por 1 €. Se pueden editar en Ajustes.
    rates: { USD: 1.08, GBP: 0.85, JPY: 165, CHF: 0.95, MXN: 20, MAD: 10.8, DKK: 7.46, SEK: 11.3, NOK: 11.7, CZK: 25, HUF: 395, PLN: 4.3, TRY: 38, THB: 38 }
  }
};
