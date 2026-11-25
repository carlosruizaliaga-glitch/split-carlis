# Split Carlis 🐱🐈‍⬛

Gastos, menú semanal y lista de la compra de Carlos y Amparo (y de Monchi y Hierba). App web instalable (PWA).

## Módulos
- **🏠 Inicio** (pantalla de entrada): comidas de hoy y mañana, lo que queda de semana por planificar, lo que falta comprar para el menú de los próximos 7 días, esenciales por reponer y el saldo de gastos.
- **💶 Gastos**: saldo entre los dos, movimientos, resumen. Grupos (Casa, Ocio, Viajes…), categorías, varias monedas, reparto a medias / % / importes.
- **🍽️ Menú**: semana con desayuno, comida, cena y tupper. Plantillas de semana, "sugerir huecos", copiar semana anterior.
- **🍳 Recetas** (pestaña propia, conectada con Menú y Compra): cada receta con sus ingredientes y cantidades para 1 persona. Su ficha muestra los ingredientes para N personas y el coste, con «📅 Al menú» y «🛒 A la lista». También se pueden elegir varias a la vez (desde Recetas, desde «Planificar eligiendo recetas» en Menú o desde «🍳 Desde recetas» en Compra).
- **🛒 Compra**:
  - *Lista*: estilo maleta de Wanderfin (plantillas, sin duplicados, secciones del súper, cantidades −/+), creada a mano o desde el menú con cantidades y precios.
  - *Esenciales*: lo que se compra aunque no esté en el menú (leche, café, sal, especias, limpieza, higiene, Monchi y Hierba…). Cada uno con su frecuencia; avisa de lo que toca reponer según la última compra.
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

## Navegación y apariencia
- **Atrás** (gesto o botón del móvil): cada pantalla, pestaña, hoja y diálogo es una entrada del historial; atrás cierra lo abierto o vuelve a la pantalla anterior hasta Inicio, y desde Inicio sale de la app.
- **Ajustes** en apartados con subpágina. *Apariencia* (en cada móvil, archivo look.js): tema automático/claro/oscuro, color principal, fondo y tamaño de letra.

## Nutrición
- Cada alimento del catálogo trae kcal, proteínas, hidratos, grasas, fibra y sal (por 100 g/ml, o por unidad si se cuenta en unidades), editables en el producto.
- Recetas: nutrición por persona con % de la ingesta de referencia (IR) y reparto de calorías. Menú e Inicio: kcal por persona de cada día. Lista: nutrición de cada línea y resumen por persona.

## Despensa, productos y editores
- **Despensa** (Compra → Despensa): lo que hay en casa. Al terminar una compra entra lo comprado; las comidas del menú se descuentan al acabar su día (o antes con «Ya la hicimos»; «No la hicimos» no descuenta); los esenciales bajan solos según su frecuencia. Ajustable a mano (−/+, cantidad exacta, «Se ha acabado», quitar). Lo que queda se calcula (ajuste a mano + compras − menú − uso diario), así los dos móviles coinciden. La lista desde el menú y el aviso de Inicio solo piden lo que falta.
- **Productos** (Compra → Productos): catálogo completo con buscador, 🛒 para añadir a la lista, elegir varios (mover de sección, esenciales, borrar), duplicar, recetas que lo usan y lo que hay en casa.
- **Ajustes**: esenciales, secciones del súper (orden de la lista), plantillas de la lista y del menú (también «Guardar como plantilla» desde la lista y la semana).
- Datos nuevos en `sc_items`: `stock`, `section`, `shoptpl`, `menutpl`.

## Tareas del hogar (mod-chores.js)
- **Tareas** con emoji, puntos de esfuerzo (1-10), frecuencia (diaria, días concretos, semanal, cada N semanas, mensual), quién puede hacerlas y pausa.
- **Semana**: se generan solas desde hoy y se reparten equilibrando puntos según el reparto (% por persona, como los gastos) y rotando para no repetir la misma tarea. Todo editable: persona (toque en el avatar), día, saltar, hecha / la hizo otro. «Repartir de nuevo» lo pendiente.
- **Conexión**: «Cocinar» = cada comida del menú (comida y cena por defecto); se marca con «Ya la hicimos» y se ve quién cocina en el menú e Inicio. «Hacer la compra» se marca sola al terminar la compra (la hace quien paga).
- **Ranking** (semana, mes, siempre), 20 logros con progreso, premios editables (ganar la semana, ganar el mes o cada X puntos) con «Disfrutado».
- Ajustes se abre con el ⚙️ de la cabecera. Datos nuevos en `sc_items`: `chore`, `chorewk`, `reward`.
