# Split Carlis 🐱

Gastos, menú semanal y lista de la compra de Carlos y Amparo. App web instalable (PWA).

## Módulos
- **💶 Gastos**: saldo entre los dos, movimientos, resumen. Grupos (Casa, Ocio, Viajes…), categorías, varias monedas, reparto a medias / % / importes.
- **🍽️ Menú**: semana con desayuno, comida, cena y tupper. Plantillas de semana, "sugerir huecos", copiar semana anterior.
  - *Comidas*: cada una con sus ingredientes y cantidades para 1 persona. Se eligen varias y se mandan al menú (se reparten en huecos libres) o a la lista de la compra (indicando cuántas personas comen).
- **🛒 Compra**:
  - *Lista*: estilo maleta de Wanderfin (plantillas, sin duplicados, secciones del súper, cantidades −/+), creada a mano o desde el menú con cantidades y precios.
  - *Esenciales*: lo que se compra aunque no esté en el menú (leche, café, sal, especias, limpieza, higiene, Monchi…). Cada uno con su frecuencia; avisa de lo que toca reponer según la última compra.
  - *Terminar compra*: guarda la compra y crea el gasto en Split (Casa · Supermercado · a medias).
  - *Comparar*: total en cada súper, si compensa ir a dos y alternativas más baratas.
  - *Precios*: precio por súper editable con historial. Los "est." son orientativos hasta que se apunte el real.
  - *Ahorro*: acumulado y por mes frente a la media de los súpers.

## Datos
Supabase (proyecto "Split Carlis"): tabla `sc_items`, un registro por dato (gasto, receta, hueco del menú, producto…), con "gana el último cambio". Copia en cada móvil: funciona sin conexión y sincroniza al volver la red. Acceso con el código de casa.

## Archivos
`core.js` (común y navegación) · `mod-split.js` · `mod-menu.js` · `mod-shop.js` · `mod-settings.js` · `logic.js` (cálculo de deudas) · `shoplogic.js` (precios y comparador) · `catalog.js` (súpers, productos, recetas y plantillas iniciales) · `store.js` (almacén y sincronización).

## Probar en local
`python -m http.server 8766` y abrir `test.html` (nube simulada, no toca los datos reales; no se sube a git).

## Nota
El plan gratuito de Supabase pausa el proyecto si pasa 1 semana sin ningún uso. Si ocurre: supabase.com → proyecto Split Carlis → "Restore".
