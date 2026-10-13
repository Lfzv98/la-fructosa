# La Fructosa v36 · Preguntas frecuentes

## Qué hay de nuevo

- **Sección "Preguntas frecuentes"** con 48 preguntas en 8 temas: privacidad y seguridad, cuenta y contraseña,
  cuentas y monedas, tasas y brecha, respaldo, Copiloto IA, instalar/actualizar/sin internet e Inversiones.
- Cada respuesta dice cómo funciona La Fructosa de verdad (revisado contra el código, no respuestas genéricas).
- **Buscador** que ignora tildes y mayúsculas ("contrasena" encuentra "contraseña"), **filtro por tema** y acordeones.
- **Según el país:**
  - Venezuela: todo, incluidas tasas, brecha y "Pagué en bolívares".
  - España: nada de Venezuela (ni bolívares, BCV, brecha ni cédulas). Ejemplos con euros y bancos españoles.
  - Estados Unidos: nada de Venezuela ni de Europa (ni euros). Ejemplos en dólares.
  - Otro país: las tasas aparecen solo si tiene una cuenta activa en bolívares.
  - **Inversiones** (el tema y las menciones sueltas) solo para cuentas con ese permiso.
- **Dónde está:** Más › Preguntas frecuentes, en la barra lateral (Herramientas, debajo de Manual de uso),
  arriba del Manual de uso y en Ajustes › App.
- Teléfono: los temas se deslizan de lado. iPad y laptop: los temas se acomodan en varias filas.

## Pasos

No hay SQL ni funciones nuevas. Solo subir la app (en la terminal de Cursor, dentro de la carpeta La Fructosa):

```
node --test tests/*.test.mjs
git add -A
git commit -m "v36: preguntas frecuentes por país"
git push
```

Deben salir **26 pruebas, 0 fallas**. Espera 1 o 2 minutos, abre la app y toca **Actualizar** cuando diga
"Hay una versión nueva".

## Comprobar

- Más › **Preguntas frecuentes**: busca "respaldo" y debe dejar solo esas respuestas.
- Con tu cuenta aparece el tema **Inversiones**; con la de un familiar no.
- Si cambias tu país a España en Ajustes, desaparece el tema "Tasas y brecha cambiaria" (vuelve a Venezuela después).

## Archivos que cambian

Nuevos: `js/faq.js` (las preguntas), `js/screens/faq.js` (la pantalla), `tests/faq.test.mjs`.
Cambian: `js/app.js`, `js/screens/settings.js`, `js/screens/learn.js`, `styles.css`, `sw.js`.

Para agregar o corregir una pregunta, edita `js/faq.js`: las pruebas revisan que España y Estados Unidos no vean
textos de otros países.
