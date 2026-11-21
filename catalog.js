// Catálogo inicial de menú y compra. Todo es editable desde la app.
// Los ids son fijos para que los dos móviles no dupliquen datos al crearlos.
// Precios: orientativos (nivel Mercadona, finales de 2026). En cada súper se
// aplica su nivel de precios estimado hasta que apuntéis el precio real.
(function () {
  'use strict';

  const SECTIONS = [
    ['fruta', '🍎', 'Fruta y verdura'],
    ['panaderia', '🥖', 'Panadería'],
    ['carne', '🥩', 'Carne'],
    ['pescado', '🐟', 'Pescado'],
    ['charcuteria', '🧀', 'Charcutería y quesos'],
    ['lacteos', '🥛', 'Lácteos y huevos'],
    ['despensa', '🥫', 'Despensa'],
    ['desayuno', '☕', 'Desayuno y dulces'],
    ['congelados', '🧊', 'Congelados'],
    ['bebidas', '🧃', 'Bebidas'],
    ['limpieza', '🧽', 'Limpieza'],
    ['higiene', '🧴', 'Higiene'],
    ['mascota', '🐱', 'Monchi'],
    ['otros', '📦', 'Otros']
  ].map(([id, emoji, name], i) => ({ id, emoji, name, order: i }));

  // factor = nivel de precios estimado respecto a Mercadona (1 = igual).
  const STORES = [
    ['s-mercadona', 'Mercadona', '#1a8f3c', 1.00],
    ['s-lidl', 'Lidl', '#0050aa', 0.95],
    ['s-carrefour', 'Carrefour', '#2457c5', 1.02],
    ['s-dia', 'Dia', '#e30613', 0.97],
    ['s-aldi', 'Aldi', '#1b2f6b', 0.94],
    ['s-alcampo', 'Alcampo', '#d7182a', 0.93],
    ['s-bonpreu', 'Bonpreu / Esclat', '#f08a00', 1.07],
    ['s-bonarea', 'bonÀrea', '#6aa121', 0.96]
  ].map(([id, name, color, factor], i) => ({ id, name, color, factor, order: i, compare: true }));

  // [id, nombre, sección, unidad base (g|ml|ud), tamaño del envase en esa unidad, precio €, granel]
  // Granel = se paga por peso (precio por kg/l): se compra la cantidad justa.
  const P = [
    // Fruta y verdura
    ['p-tomate', 'Tomates', 'fruta', 'g', 1000, 2.20, 1],
    ['p-cebolla', 'Cebollas', 'fruta', 'g', 1000, 1.40, 1],
    ['p-ajo', 'Ajos', 'fruta', 'g', 1000, 6.00, 1],
    ['p-patata', 'Patatas', 'fruta', 'g', 1000, 1.30, 1],
    ['p-zanahoria', 'Zanahorias', 'fruta', 'g', 1000, 1.10, 1],
    ['p-pimiento-rojo', 'Pimiento rojo', 'fruta', 'g', 1000, 2.90, 1],
    ['p-pimiento-verde', 'Pimiento verde', 'fruta', 'g', 1000, 2.50, 1],
    ['p-calabacin', 'Calabacín', 'fruta', 'g', 1000, 1.90, 1],
    ['p-berenjena', 'Berenjena', 'fruta', 'g', 1000, 2.20, 1],
    ['p-puerro', 'Puerros', 'fruta', 'g', 1000, 2.40, 1],
    ['p-pepino', 'Pepino', 'fruta', 'g', 1000, 1.50, 1],
    ['p-brocoli', 'Brócoli', 'fruta', 'g', 1000, 2.80, 1],
    ['p-lechuga', 'Lechuga', 'fruta', 'ud', 1, 0.95, 0],
    ['p-espinacas', 'Espinacas frescas (300 g)', 'fruta', 'g', 300, 1.35, 0],
    ['p-champinon', 'Champiñones (250 g)', 'fruta', 'g', 250, 1.30, 0],
    ['p-perejil', 'Perejil (manojo)', 'fruta', 'ud', 1, 0.70, 0],
    ['p-aguacate', 'Aguacate', 'fruta', 'ud', 1, 0.80, 0],
    ['p-limon', 'Limones', 'fruta', 'g', 1000, 2.20, 1],
    ['p-platano', 'Plátanos', 'fruta', 'g', 1000, 1.90, 1],
    ['p-manzana', 'Manzanas', 'fruta', 'g', 1000, 2.10, 1],
    ['p-naranja', 'Naranjas', 'fruta', 'g', 1000, 1.60, 1],
    ['p-kiwi', 'Kiwis', 'fruta', 'g', 1000, 3.20, 1],
    ['p-fresas', 'Fresas (500 g)', 'fruta', 'g', 500, 2.50, 0],
    // Panadería
    ['p-pan-barra', 'Barra de pan', 'panaderia', 'ud', 1, 0.50, 0],
    ['p-pan-molde', 'Pan de molde (450 g)', 'panaderia', 'g', 450, 1.40, 0],
    ['p-pan-hamburguesa', 'Pan de hamburguesa (6 ud)', 'panaderia', 'ud', 6, 1.15, 0],
    ['p-tortillas-trigo', 'Tortillas de trigo (8 ud)', 'panaderia', 'ud', 8, 1.35, 0],
    ['p-pan-tostado', 'Pan tostado (270 g)', 'panaderia', 'g', 270, 1.25, 0],
    // Carne
    ['p-pechuga', 'Pechuga de pollo', 'carne', 'g', 1000, 7.50, 1],
    ['p-muslos', 'Muslos de pollo', 'carne', 'g', 1000, 3.80, 1],
    ['p-picada', 'Carne picada mixta (500 g)', 'carne', 'g', 500, 3.40, 0],
    ['p-lomo', 'Lomo de cerdo', 'carne', 'g', 1000, 6.50, 1],
    ['p-ternera', 'Filetes de ternera', 'carne', 'g', 1000, 13.00, 1],
    ['p-pavo', 'Filetes de pavo', 'carne', 'g', 1000, 8.50, 1],
    ['p-hamburguesas', 'Hamburguesas (4 ud)', 'carne', 'ud', 4, 2.80, 0],
    ['p-salchichas', 'Salchichas frescas (6 ud)', 'carne', 'ud', 6, 1.90, 0],
    ['p-costillas', 'Costillas de cerdo', 'carne', 'g', 1000, 6.00, 1],
    // Pescado
    ['p-salmon', 'Salmón (lomos)', 'pescado', 'g', 1000, 13.50, 1],
    ['p-merluza', 'Merluza (filetes)', 'pescado', 'g', 1000, 9.00, 1],
    ['p-bacalao', 'Bacalao', 'pescado', 'g', 1000, 12.00, 1],
    ['p-dorada', 'Dorada', 'pescado', 'g', 1000, 8.00, 1],
    ['p-sardinas', 'Sardinas', 'pescado', 'g', 1000, 5.00, 1],
    // Charcutería y quesos
    ['p-serrano', 'Jamón serrano (100 g)', 'charcuteria', 'g', 100, 1.95, 0],
    ['p-york', 'Jamón cocido (200 g)', 'charcuteria', 'g', 200, 1.80, 0],
    ['p-pavo-lonchas', 'Pavo en lonchas (200 g)', 'charcuteria', 'g', 200, 1.70, 0],
    ['p-queso-lonchas', 'Queso en lonchas (250 g)', 'charcuteria', 'g', 250, 1.95, 0],
    ['p-queso-rallado', 'Queso rallado (200 g)', 'charcuteria', 'g', 200, 1.45, 0],
    ['p-mozzarella', 'Mozzarella (125 g)', 'charcuteria', 'g', 125, 0.85, 0],
    ['p-queso-fresco', 'Queso fresco (250 g)', 'charcuteria', 'g', 250, 1.25, 0],
    ['p-chorizo', 'Chorizo (225 g)', 'charcuteria', 'g', 225, 1.80, 0],
    ['p-bacon', 'Bacon en tiras (200 g)', 'charcuteria', 'g', 200, 1.75, 0],
    // Lácteos y huevos
    ['p-leche', 'Leche semidesnatada (1 l)', 'lacteos', 'ml', 1000, 0.95, 0],
    ['p-huevos', 'Huevos (docena)', 'lacteos', 'ud', 12, 2.40, 0],
    ['p-yogur', 'Yogur natural (8 ud)', 'lacteos', 'ud', 8, 1.45, 0],
    ['p-mantequilla', 'Mantequilla (250 g)', 'lacteos', 'g', 250, 2.40, 0],
    ['p-nata', 'Nata para cocinar (200 ml)', 'lacteos', 'ml', 200, 0.55, 0],
    // Despensa
    ['p-arroz', 'Arroz redondo (1 kg)', 'despensa', 'g', 1000, 1.25, 0],
    ['p-macarrones', 'Macarrones (500 g)', 'despensa', 'g', 500, 0.85, 0],
    ['p-espaguetis', 'Espaguetis (500 g)', 'despensa', 'g', 500, 0.85, 0],
    ['p-fideos', 'Fideos (500 g)', 'despensa', 'g', 500, 0.80, 0],
    ['p-lentejas', 'Lentejas (1 kg)', 'despensa', 'g', 1000, 1.95, 0],
    ['p-garbanzos', 'Garbanzos cocidos (400 g)', 'despensa', 'g', 400, 0.80, 0],
    ['p-alubias', 'Alubias cocidas (400 g)', 'despensa', 'g', 400, 0.85, 0],
    ['p-tomate-frito', 'Tomate frito (400 g)', 'despensa', 'g', 400, 0.75, 0],
    ['p-tomate-triturado', 'Tomate triturado (800 g)', 'despensa', 'g', 800, 0.95, 0],
    ['p-atun', 'Atún en aceite (3 latas)', 'despensa', 'g', 240, 3.20, 0],
    ['p-aceitunas', 'Aceitunas (350 g)', 'despensa', 'g', 350, 1.10, 0],
    ['p-aove', 'Aceite de oliva virgen extra (1 l)', 'despensa', 'ml', 1000, 6.50, 0],
    ['p-girasol', 'Aceite de girasol (1 l)', 'despensa', 'ml', 1000, 1.75, 0],
    ['p-sal', 'Sal (1 kg)', 'despensa', 'g', 1000, 0.40, 0],
    ['p-azucar', 'Azúcar (1 kg)', 'despensa', 'g', 1000, 1.20, 0],
    ['p-harina', 'Harina (1 kg)', 'despensa', 'g', 1000, 0.80, 0],
    ['p-caldo', 'Caldo de pollo (1 l)', 'despensa', 'ml', 1000, 1.10, 0],
    ['p-pimenton', 'Pimentón (75 g)', 'despensa', 'g', 75, 1.10, 0],
    ['p-vinagre', 'Vinagre (1 l)', 'despensa', 'ml', 1000, 0.65, 0],
    ['p-mayonesa', 'Mayonesa (450 ml)', 'despensa', 'ml', 450, 1.40, 0],
    ['p-soja', 'Salsa de soja (250 ml)', 'despensa', 'ml', 250, 1.30, 0],
    ['p-pimienta', 'Pimienta negra molida (50 g)', 'despensa', 'g', 50, 1.20, 0],
    ['p-oregano', 'Orégano (15 g)', 'despensa', 'g', 15, 0.85, 0],
    ['p-comino', 'Comino molido (40 g)', 'despensa', 'g', 40, 0.95, 0],
    ['p-ajo-polvo', 'Ajo en polvo (60 g)', 'despensa', 'g', 60, 1.10, 0],
    ['p-laurel', 'Laurel (10 g)', 'despensa', 'g', 10, 0.80, 0],
    ['p-curry', 'Curry (45 g)', 'despensa', 'g', 45, 1.10, 0],
    // Desayuno y dulces
    ['p-cafe', 'Café molido (250 g)', 'desayuno', 'g', 250, 2.75, 0],
    ['p-cacao', 'Cacao soluble (500 g)', 'desayuno', 'g', 500, 2.80, 0],
    ['p-galletas', 'Galletas María (800 g)', 'desayuno', 'g', 800, 1.55, 0],
    ['p-cereales', 'Cereales (500 g)', 'desayuno', 'g', 500, 2.10, 0],
    ['p-avena', 'Copos de avena (500 g)', 'desayuno', 'g', 500, 1.10, 0],
    ['p-mermelada', 'Mermelada (350 g)', 'desayuno', 'g', 350, 1.50, 0],
    ['p-miel', 'Miel (500 g)', 'desayuno', 'g', 500, 3.40, 0],
    // Congelados
    ['p-guisantes', 'Guisantes congelados (1 kg)', 'congelados', 'g', 1000, 1.95, 0],
    ['p-salteado', 'Verduras para saltear (600 g)', 'congelados', 'g', 600, 1.70, 0],
    ['p-gambas', 'Gambas peladas (400 g)', 'congelados', 'g', 400, 4.50, 0],
    ['p-pizza', 'Pizza', 'congelados', 'ud', 1, 2.50, 0],
    // Bebidas
    ['p-agua', 'Agua (6 × 1,5 l)', 'bebidas', 'ml', 9000, 1.70, 0],
    ['p-cerveza', 'Cerveza (12 latas)', 'bebidas', 'ud', 12, 4.30, 0],
    ['p-vino', 'Vino tinto (75 cl)', 'bebidas', 'ml', 750, 3.50, 0],
    ['p-refresco', 'Refresco de cola (2 l)', 'bebidas', 'ml', 2000, 1.40, 0],
    ['p-zumo', 'Zumo de naranja (1 l)', 'bebidas', 'ml', 1000, 1.40, 0],
    // Limpieza
    ['p-detergente', 'Detergente ropa (40 lavados)', 'limpieza', 'ud', 1, 5.50, 0],
    ['p-suavizante', 'Suavizante', 'limpieza', 'ud', 1, 2.40, 0],
    ['p-pastillas-lavavajillas', 'Pastillas lavavajillas (40 ud)', 'limpieza', 'ud', 1, 4.90, 0],
    ['p-lavavajillas-mano', 'Lavavajillas a mano', 'limpieza', 'ud', 1, 1.20, 0],
    ['p-friegasuelos', 'Friegasuelos', 'limpieza', 'ud', 1, 1.40, 0],
    ['p-lejia', 'Lejía', 'limpieza', 'ud', 1, 0.95, 0],
    ['p-papel-higienico', 'Papel higiénico (12 rollos)', 'limpieza', 'ud', 1, 3.90, 0],
    ['p-papel-cocina', 'Papel de cocina (3 rollos)', 'limpieza', 'ud', 1, 2.30, 0],
    ['p-bolsas-basura', 'Bolsas de basura', 'limpieza', 'ud', 1, 1.30, 0],
    ['p-estropajos', 'Estropajos', 'limpieza', 'ud', 1, 1.00, 0],
    ['p-bayetas', 'Bayetas (3 ud)', 'limpieza', 'ud', 1, 1.50, 0],
    ['p-aluminio', 'Papel de aluminio', 'limpieza', 'ud', 1, 1.60, 0],
    ['p-film', 'Papel film', 'limpieza', 'ud', 1, 1.40, 0],
    ['p-servilletas', 'Servilletas', 'limpieza', 'ud', 1, 1.10, 0],
    // Higiene
    ['p-gel', 'Gel de ducha', 'higiene', 'ud', 1, 1.80, 0],
    ['p-champu', 'Champú', 'higiene', 'ud', 1, 1.80, 0],
    ['p-pasta-dientes', 'Pasta de dientes', 'higiene', 'ud', 1, 1.50, 0],
    ['p-desodorante', 'Desodorante', 'higiene', 'ud', 1, 1.70, 0],
    // Monchi
    ['p-pienso', 'Pienso para gato (2 kg)', 'mascota', 'ud', 1, 6.50, 0],
    ['p-arena', 'Arena para gato (5 kg)', 'mascota', 'ud', 1, 3.50, 0],
    ['p-latas-gato', 'Comida húmeda gato (12 sobres)', 'mascota', 'ud', 1, 5.50, 0],
    ['p-snacks-gato', 'Snacks para gato', 'mascota', 'ud', 1, 1.80, 0]
  ];
  // De despensa: al crear la lista desde el menú salen desmarcados (normalmente ya los tenéis).
  const STAPLES = ['p-aove', 'p-girasol', 'p-sal', 'p-azucar', 'p-harina', 'p-pimenton', 'p-vinagre', 'p-soja', 'p-caldo', 'p-mayonesa',
    'p-pimienta', 'p-oregano', 'p-comino', 'p-ajo-polvo', 'p-laurel', 'p-curry'];

  // Esenciales: lo que se compra aunque no esté en el menú porque se gasta igualmente.
  // [producto, cada cuántos días se suele reponer, cantidad a comprar en unidad base]
  const ESSENTIALS = [
    ['p-leche', 7, 6000], ['p-cafe', 14, 250], ['p-huevos', 10, 12], ['p-yogur', 7, 8], ['p-pan-molde', 7, 450], ['p-galletas', 14, 800], ['p-agua', 7, 9000],
    ['p-aove', 30, 1000], ['p-sal', 90, 1000], ['p-azucar', 60, 1000], ['p-vinagre', 60, 1000],
    ['p-pimienta', 90, 50], ['p-oregano', 120, 15], ['p-comino', 120, 40], ['p-pimenton', 90, 75], ['p-ajo-polvo', 120, 60], ['p-laurel', 180, 10],
    ['p-bolsas-basura', 21, 1], ['p-papel-higienico', 14, 1], ['p-papel-cocina', 14, 1], ['p-servilletas', 30, 1],
    ['p-pastillas-lavavajillas', 30, 1], ['p-lavavajillas-mano', 30, 1], ['p-detergente', 30, 1], ['p-suavizante', 30, 1],
    ['p-friegasuelos', 30, 1], ['p-lejia', 45, 1], ['p-estropajos', 30, 1], ['p-bayetas', 30, 1], ['p-aluminio', 60, 1], ['p-film', 60, 1],
    ['p-gel', 30, 1], ['p-champu', 30, 1], ['p-pasta-dientes', 30, 1], ['p-desodorante', 45, 1],
    ['p-pienso', 21, 1], ['p-arena', 14, 1], ['p-latas-gato', 14, 1]
  ];
  const ESS = {}; ESSENTIALS.forEach(([id, every, qty]) => { ESS[id] = { every, qty }; });

  const PRODUCTS = P.map(([id, name, section, unit, pack, price, bulk]) => Object.assign(
    { id, name, section, unit, pack, price, bulk: !!bulk, staple: STAPLES.includes(id), prices: {} },
    ESS[id] ? { essential: true, every: ESS[id].every, essentialQty: ESS[id].qty } : {}));

  // Recetas: cantidades POR RACIÓN, en la unidad base del producto.
  // meals: en qué comidas se sugiere (desayuno, comida, cena, tupper).
  const R = [
    ['r-tostadas-tomate', '🍅', 'Tostadas con tomate y aceite', 'desayuno', { 'p-pan-barra': 0.25, 'p-tomate': 80, 'p-aove': 10 }],
    ['r-yogur-cereales', '🥣', 'Yogur con cereales y plátano', 'desayuno', { 'p-yogur': 1, 'p-cereales': 40, 'p-platano': 120 }],
    ['r-cafe-galletas', '☕', 'Café con leche y galletas', 'desayuno', { 'p-leche': 200, 'p-cafe': 10, 'p-galletas': 40 }],
    ['r-tostada-aguacate', '🥑', 'Tostada de aguacate y huevo', 'desayuno', { 'p-pan-molde': 60, 'p-aguacate': 0.5, 'p-huevos': 1 }],
    ['r-porridge', '🥣', 'Porridge de avena con plátano', 'desayuno', { 'p-avena': 50, 'p-leche': 200, 'p-platano': 100, 'p-miel': 10 }],
    ['r-cacao-tostadas', '🍫', 'Leche con cacao y tostadas', 'desayuno', { 'p-leche': 250, 'p-cacao': 20, 'p-pan-tostado': 30, 'p-mermelada': 20, 'p-mantequilla': 10 }],
    ['r-lentejas', '🍲', 'Lentejas estofadas', 'comida,tupper', { 'p-lentejas': 80, 'p-chorizo': 30, 'p-zanahoria': 50, 'p-patata': 100, 'p-cebolla': 40, 'p-ajo': 5, 'p-pimenton': 1, 'p-aove': 10 }],
    ['r-macarrones-atun', '🍝', 'Macarrones con tomate y atún', 'comida,cena,tupper', { 'p-macarrones': 100, 'p-tomate-frito': 100, 'p-atun': 40, 'p-queso-rallado': 15 }],
    ['r-bolonesa', '🍝', 'Espaguetis a la boloñesa', 'comida,tupper', { 'p-espaguetis': 100, 'p-picada': 100, 'p-tomate-triturado': 120, 'p-cebolla': 40, 'p-zanahoria': 30, 'p-aove': 10, 'p-queso-rallado': 10 }],
    ['r-arroz-cubana', '🍚', 'Arroz a la cubana', 'comida', { 'p-arroz': 80, 'p-tomate-frito': 80, 'p-huevos': 1, 'p-platano': 100, 'p-aove': 15 }],
    ['r-paella', '🥘', 'Paella de pollo y verduras', 'comida', { 'p-arroz': 90, 'p-muslos': 150, 'p-pimiento-rojo': 40, 'p-tomate': 50, 'p-caldo': 200, 'p-pimenton': 1, 'p-aove': 15 }],
    ['r-pollo-horno', '🍗', 'Pollo al horno con patatas', 'comida,cena', { 'p-muslos': 250, 'p-patata': 200, 'p-cebolla': 50, 'p-ajo': 5, 'p-aove': 15 }],
    ['r-pechuga-ensalada', '🍗', 'Pechuga a la plancha con ensalada', 'comida,cena,tupper', { 'p-pechuga': 150, 'p-lechuga': 0.25, 'p-tomate': 80, 'p-pepino': 50, 'p-aove': 10 }],
    ['r-tortilla', '🥔', 'Tortilla de patatas', 'comida,cena,tupper', { 'p-huevos': 2, 'p-patata': 200, 'p-cebolla': 50, 'p-aove': 30 }],
    ['r-salmon-verduras', '🐟', 'Salmón al horno con verduras', 'comida,cena', { 'p-salmon': 150, 'p-calabacin': 100, 'p-pimiento-rojo': 50, 'p-limon': 30, 'p-aove': 10 }],
    ['r-merluza', '🐟', 'Merluza a la plancha con patatas', 'comida,cena', { 'p-merluza': 150, 'p-patata': 150, 'p-ajo': 3, 'p-perejil': 0.1, 'p-aove': 10 }],
    ['r-dorada', '🐟', 'Dorada al horno', 'comida,cena', { 'p-dorada': 330, 'p-patata': 150, 'p-cebolla': 50, 'p-limon': 20, 'p-aove': 15 }],
    ['r-crema-calabacin', '🥣', 'Crema de calabacín', 'cena,tupper', { 'p-calabacin': 250, 'p-patata': 80, 'p-cebolla': 40, 'p-nata': 30, 'p-aove': 10 }],
    ['r-pure-verduras', '🥣', 'Puré de verduras', 'cena,tupper', { 'p-calabacin': 100, 'p-zanahoria': 80, 'p-puerro': 60, 'p-patata': 100, 'p-aove': 10 }],
    ['r-ensalada-pasta', '🥗', 'Ensalada de pasta', 'comida,tupper', { 'p-macarrones': 80, 'p-atun': 40, 'p-tomate': 80, 'p-aceitunas': 20, 'p-huevos': 0.5, 'p-aove': 10 }],
    ['r-ensalada-mixta', '🥗', 'Ensalada mixta', 'cena', { 'p-lechuga': 0.3, 'p-tomate': 100, 'p-atun': 40, 'p-huevos': 1, 'p-aceitunas': 15, 'p-cebolla': 20, 'p-aove': 10 }],
    ['r-garbanzos-espinacas', '🍲', 'Garbanzos con espinacas', 'comida,tupper', { 'p-garbanzos': 200, 'p-espinacas': 100, 'p-ajo': 5, 'p-pimenton': 1, 'p-huevos': 0.5, 'p-aove': 10 }],
    ['r-alubias', '🍲', 'Alubias con verduras', 'comida,tupper', { 'p-alubias': 200, 'p-pimiento-verde': 50, 'p-cebolla': 40, 'p-zanahoria': 40, 'p-tomate-triturado': 60, 'p-aove': 10 }],
    ['r-arroz-salteado', '🍚', 'Arroz salteado con verduras y huevo', 'comida,cena,tupper', { 'p-arroz': 80, 'p-salteado': 150, 'p-huevos': 1, 'p-soja': 10, 'p-aove': 10 }],
    ['r-lomo-pimientos', '🥩', 'Lomo con pimientos y patatas', 'comida,cena', { 'p-lomo': 150, 'p-pimiento-verde': 80, 'p-patata': 150, 'p-aove': 15 }],
    ['r-ternera-ensalada', '🥩', 'Filete de ternera con ensalada', 'comida,cena', { 'p-ternera': 150, 'p-lechuga': 0.25, 'p-tomate': 80, 'p-aove': 10 }],
    ['r-fajitas', '🌯', 'Fajitas de pollo', 'cena', { 'p-tortillas-trigo': 2, 'p-pechuga': 120, 'p-pimiento-rojo': 50, 'p-pimiento-verde': 40, 'p-cebolla': 40, 'p-queso-rallado': 20, 'p-aove': 10 }],
    ['r-hamburguesa', '🍔', 'Hamburguesas caseras', 'cena', { 'p-hamburguesas': 1, 'p-pan-hamburguesa': 1, 'p-queso-lonchas': 20, 'p-lechuga': 0.1, 'p-tomate': 40, 'p-patata': 150, 'p-girasol': 20 }],
    ['r-pizza', '🍕', 'Pizza', 'cena', { 'p-pizza': 0.5 }],
    ['r-revuelto', '🍳', 'Revuelto de champiñones y jamón', 'cena', { 'p-huevos': 2, 'p-champinon': 100, 'p-serrano': 20, 'p-aove': 10 }],
    ['r-sandwich', '🥪', 'Sándwiches mixtos', 'cena', { 'p-pan-molde': 80, 'p-york': 40, 'p-queso-lonchas': 30, 'p-mantequilla': 5 }],
    ['r-sopa-fideos', '🍜', 'Sopa de fideos', 'cena', { 'p-caldo': 300, 'p-fideos': 30 }],
    ['r-salchichas', '🌭', 'Salchichas con patatas', 'cena', { 'p-salchichas': 3, 'p-patata': 150, 'p-girasol': 15 }],
    ['r-gambas-ajillo', '🦐', 'Gambas al ajillo con arroz', 'comida,cena', { 'p-gambas': 120, 'p-ajo': 8, 'p-arroz': 70, 'p-aove': 20 }]
  ];
  const RECIPES = R.map(([id, emoji, name, meals, ing]) => ({
    id, emoji, name, meals: meals.split(','), servings: 1,
    ingredients: Object.entries(ing).map(([product, qty]) => ({ product, qty }))
  }));

  const MEALS = [
    ['desayuno', '☕', 'Desayuno'],
    ['comida', '🍽️', 'Comida'],
    ['cena', '🌙', 'Cena'],
    ['tupper', '🥡', 'Tupper']
  ].map(([id, emoji, name]) => ({ id, emoji, name }));

  // Plantillas de semana: recetas por comida (lunes a domingo). Solo rellenan huecos vacíos.
  const MENU_TEMPLATES = [
    { id: 'equilibrada', name: 'Semana equilibrada', emoji: '⚖️', plan: {
      comida: ['r-lentejas', 'r-pollo-horno', 'r-macarrones-atun', 'r-garbanzos-espinacas', 'r-merluza', 'r-paella', 'r-lomo-pimientos'],
      cena: ['r-tortilla', 'r-crema-calabacin', 'r-revuelto', 'r-ensalada-mixta', 'r-salmon-verduras', 'r-sandwich', 'r-pizza'] } },
    { id: 'rapida', name: 'Semana rápida', emoji: '⚡', plan: {
      comida: ['r-macarrones-atun', 'r-arroz-salteado', 'r-pechuga-ensalada', 'r-ensalada-pasta', 'r-ternera-ensalada', 'r-bolonesa', 'r-gambas-ajillo'],
      cena: ['r-sandwich', 'r-revuelto', 'r-hamburguesa', 'r-salchichas', 'r-pizza', 'r-tortilla', 'r-fajitas'] } },
    { id: 'ligera', name: 'Semana ligera', emoji: '🥗', plan: {
      comida: ['r-pechuga-ensalada', 'r-merluza', 'r-garbanzos-espinacas', 'r-arroz-salteado', 'r-salmon-verduras', 'r-alubias', 'r-dorada'],
      cena: ['r-crema-calabacin', 'r-pure-verduras', 'r-ensalada-mixta', 'r-revuelto', 'r-sopa-fideos', 'r-pechuga-ensalada', 'r-ensalada-mixta'] } },
    { id: 'desayunos', name: 'Desayunos', emoji: '☕', plan: {
      desayuno: ['r-cafe-galletas', 'r-tostadas-tomate', 'r-yogur-cereales', 'r-porridge', 'r-cafe-galletas', 'r-tostada-aguacate', 'r-cacao-tostadas'] } },
    { id: 'tuppers', name: 'Tuppers L-V', emoji: '🥡', plan: {
      tupper: ['r-lentejas', 'r-ensalada-pasta', 'r-bolonesa', 'r-garbanzos-espinacas', 'r-arroz-salteado', null, null] } }
  ];

  // Plantillas de lista de la compra: [producto, cantidad en unidad base]. Sin duplicados al añadir.
  const SHOP_TEMPLATES = [
    { id: 'despensa', name: 'Despensa básica', emoji: '🥫', items: [['p-aove', 1000], ['p-sal', 1000], ['p-arroz', 1000], ['p-macarrones', 500], ['p-espaguetis', 500], ['p-tomate-frito', 800], ['p-atun', 240], ['p-lentejas', 1000], ['p-garbanzos', 800], ['p-caldo', 1000]] },
    { id: 'desayunos', name: 'Desayunos', emoji: '☕', items: [['p-leche', 6000], ['p-cafe', 250], ['p-galletas', 800], ['p-cereales', 500], ['p-yogur', 8], ['p-mermelada', 350], ['p-platano', 1000], ['p-pan-molde', 450]] },
    { id: 'fruta', name: 'Fruta y verdura', emoji: '🍎', items: [['p-platano', 1000], ['p-manzana', 1000], ['p-naranja', 2000], ['p-tomate', 1000], ['p-lechuga', 2], ['p-cebolla', 1000], ['p-patata', 2000], ['p-zanahoria', 500], ['p-limon', 500]] },
    { id: 'frescos', name: 'Frescos', emoji: '🥩', items: [['p-huevos', 12], ['p-pechuga', 600], ['p-picada', 500], ['p-york', 200], ['p-queso-lonchas', 250], ['p-pan-barra', 2]] },
    { id: 'limpieza', name: 'Limpieza', emoji: '🧽', items: [['p-detergente', 1], ['p-pastillas-lavavajillas', 1], ['p-papel-higienico', 1], ['p-papel-cocina', 1], ['p-bolsas-basura', 1], ['p-friegasuelos', 1], ['p-lavavajillas-mano', 1]] },
    { id: 'higiene', name: 'Higiene', emoji: '🧴', items: [['p-gel', 1], ['p-champu', 1], ['p-pasta-dientes', 1], ['p-desodorante', 1]] },
    { id: 'monchi', name: 'Monchi', emoji: '🐱', items: [['p-pienso', 1], ['p-arena', 1], ['p-latas-gato', 1], ['p-snacks-gato', 1]] },
    { id: 'bebidas', name: 'Bebidas', emoji: '🧃', items: [['p-agua', 9000], ['p-cerveza', 12], ['p-refresco', 2000], ['p-zumo', 1000]] }
  ];

  window.CATALOG = { SECTIONS, STORES, PRODUCTS, RECIPES, MEALS, MENU_TEMPLATES, SHOP_TEMPLATES, ESSENTIALS, VERSION: 3 };
})();
