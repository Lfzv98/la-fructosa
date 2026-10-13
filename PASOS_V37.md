# La Fructosa v37 · Logos, mensajes de bienvenida y respaldo en PDF

## Qué hay de nuevo

1. **Logos de cada entidad** en Cuentas, Inicio, detalle de cuenta, "Sale de", plantillas, bienvenida,
   pagos fijos, inversiones y movimientos que nombran una marca (Netflix, Zelle…).
   - Logo real cuando hay uno libre (Zelle, Binance, Bank of America, PayPal, Chase, Netflix…).
   - Bancos de Venezuela, Folionet y otros sin logo libre: insignia con su color y sus iniciales.
   - Lo que no es entidad lleva un dibujo: billete (Efectivo USD/VES/EUR), teléfono con Bs. (Pago Móvil),
     tarjeta, alcancía, banco y cripto. Cada país ve solo sus bancos. Funciona sin internet.
2. **"Empieza hoy, aunque sea de a poco"**: mensaje flotante al terminar el recorrido guiado.
3. **"Así queda registrada tu información"**: justo después de ese mensaje (una sola vez) se abre una ventana
   con una vista del Excel organizado, con tus últimos movimientos y sus colores, y el botón **Descargar mi Excel**.
4. **Registro financiero en PDF** (resumen, cuentas, inversiones y todos los movimientos). En Ajustes › Respaldo.
5. **Recordatorio cada 7 días** en Inicio: "Cada 7 días, con disciplina y responsabilidad, guarda una copia de tu
   registro financiero." Botones **Descargar PDF**, **Excel** y **Luego**.
   - Consejo: crear en Archivos (Files) una carpeta **Mis Finanzas** y guardar ahí cada respaldo.
   - "¿Por qué lo guardo yo?": la app no te cuesta nada y tu copia semanal es el seguro que tú controlas.

## Pasos

1. **Activar Inversiones** (sáltalo si ya lo hiciste): en Supabase › SQL Editor pega todo
   `supabase/migrations/015_inversiones.sql` y presiona Run. Debe salir `luiszeav@gmail.com | true`.
2. **Cargar tus inversiones y saldos**: en el mismo SQL Editor pega todo `supabase/seed_luis_inversiones.sql`
   y presiona Run. Va después del paso 1; se puede repetir sin duplicar.
3. **Subir la app** (terminal de Cursor):

```
cd ~/Desktop/"La Fructosa"
node --test tests/*.test.mjs
git add -A
git commit -m "v37: logos, Empieza hoy, vista del Excel y respaldo en PDF"
git push origin main
```

   Debe decir 0 fallas. No hay funciones nuevas que desplegar.
4. **Actualizar**: espera 1 o 2 minutos, abre la app y toca **Actualizar**.

## Comprobar

- Cuentas: Zelle, Binance, BNC y BOFA con su logo; Efectivo con un billete.
- Aprende › Ver el tour otra vez: al terminar sale "Empieza hoy" y después la ventana del Excel
  (la ventana sale una sola vez por teléfono).
- Ajustes › Respaldo › Descargar mi registro financiero (PDF).
- Más › Inversiones: tus ETFs con la insignia de Folionet.

## Para agregar un logo

Edita `tools/make-logos.mjs` y corre `npm i simple-icons && node tools/make-logos.mjs .`
