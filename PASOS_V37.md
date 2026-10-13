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
6. **Avisos automáticos al teléfono** (se eligen en Ajustes › Avisos; los nuevos vienen encendidos):
   - Pagos fijos por vencer (el día antes y el mismo día) y préstamos que vencen (ya existían).
   - **Presupuestos**: cuando una categoría llega al 80% y cuando se pasa del tope del mes (un aviso por vez).
   - **Respaldo semanal**: a los 7 días sin descargar el PDF o el Excel, recordando la carpeta "Mis Finanzas".
   - **Constancia**: un empujón amable a los 3 y a los 7 días sin anotar nada.
   - **Dólar en movimiento** (solo Venezuela): si el BCV o el USDT cambian 3% o más de un día a otro.
   - Llegan una vez al día, a las 8:30 a. m. (hora de Caracas). Costo: $0 (Supabase gratis).

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
git commit -m "v37: logos, Empieza hoy, Excel, PDF y avisos automáticos"
git push origin main
```

   Debe decir 0 fallas.
4. **Desplegar los avisos nuevos** (en la misma terminal):

```
npx supabase functions deploy send-reminders --no-verify-jwt
```

   Si nunca activaste los avisos, antes haz esto una sola vez: `npx web-push generate-vapid-keys`, luego
   `npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:luiszeav@gmail.com CRON_SECRET=una-clave-larga`,
   despliega, y en el SQL Editor corre `supabase/migrations/008_avisos.sql` cambiando TU-PROYECTO y TU-CRON-SECRET.
5. **Actualizar**: espera 1 o 2 minutos, abre la app y toca **Actualizar**. En Ajustes › Avisos toca
   **Activar** en cada teléfono (en iPhone, con la app instalada en la pantalla de inicio).

## Comprobar

- Cuentas: Zelle, Binance, BNC y BOFA con su logo; Efectivo con un billete.
- Aprende › Ver el tour otra vez: al terminar sale "Empieza hoy" y después la ventana del Excel
  (la ventana sale una sola vez por teléfono).
- Ajustes › Respaldo › Descargar mi registro financiero (PDF).
- Más › Inversiones: tus ETFs con la insignia de Folionet.
- Ajustes › Avisos: aparecen Presupuestos, Respaldo semanal, Constancia y (Venezuela) Dólar en movimiento.

## Para agregar un logo

Edita `tools/make-logos.mjs` y corre `npm i simple-icons && node tools/make-logos.mjs .`
