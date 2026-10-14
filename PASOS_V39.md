# La Fructosa v39 · El libro digital

## Qué trae

- **El libro de La Fructosa**: el Manual de uso (sin cambios), las Preguntas frecuentes y los 30 mejores tips financieros, en forma de libro. Las hojas se doblan como papel de verdad: con el dedo en el teléfono, y en la computadora con clic, la esquina de la hoja o las flechas del teclado.
- Enlace público, sin iniciar sesión: **https://la-fructosa.vercel.app/manual**
  - Por país: `/manual?pais=VE`, `/manual?pais=ES`, `/manual?pais=US`, `/manual?pais=INT`. Sin país, la portada pregunta "¿Dónde vives?".
  - España no ve nada de Venezuela. Estados Unidos no ve nada de Venezuela ni de Europa. Inversiones solo aparece si lo abres desde tu cuenta.
- Dentro de la app: **Más › El libro**, en la barra lateral (Herramientas) y en **Ajustes › App**.
- Índice que te lleva a cada capítulo, tamaño de letra, sonido de hojas (se apaga con el botón del parlante), botón para compartir y "Seguir leyendo" donde ibas.
- Funciona sin internet una vez abierto (service worker v39).
- Botón **Descargar** dentro del libro: baja el PDF del país del lector (carpeta nueva `libro/`, un PDF por país).

## Para mandarle a la familia

- Lo mejor: el enlace **https://la-fructosa.vercel.app/manual** (funciona en cualquier teléfono, con las hojas animadas).
- Para descargar: el PDF de su país (`El-libro-de-La-Fructosa-VE.pdf`, `-ES`, `-US`, `-INT`). Se abre en cualquier teléfono, también sin internet.
- `El-libro-de-La-Fructosa.html`: el libro animado en un solo archivo, sin internet. Funciona en computadora y Android. En iPhone, WhatsApp y Archivos lo muestran sin animación, así que ahí manda el enlace o el PDF.

## Archivos

Nuevos: la carpeta `libro/` (4 PDFs), `manual.html`, `libro.css`, `js/manual.js`, `js/flipbook.js`, `js/book.js`, `js/tips.js`, `js/glossary.js`, `icons/libro-portada.png`, `tests/book.test.mjs`.
Cambiados: `js/app.js`, `js/screens/settings.js`, `js/screens/common.js`, `js/ui.js`, `js/learn.js` (el glosario pasó a `js/glossary.js`, mismo texto), `sw.js`, `vercel.json`.

No hay SQL nuevo.

## Subirlo

```
node --test tests/*.test.mjs
git add -A
git commit -m "v39: el libro de La Fructosa"
git push
```

Deben salir 0 fallas. Antes de subir, revisa que exista la carpeta `libro/` con los 4 PDFs. Vercel publica solo en uno o dos minutos. Después abre https://la-fructosa.vercel.app/manual para probarlo.
