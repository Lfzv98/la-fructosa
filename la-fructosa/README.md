# La Fructosa

PWA de finanzas personales para la familia: cuentas en USD, VES, USDT y EUR,
tasas BCV / Paralelo / USDT y calculadora de brecha cambiaria.
Proyecto independiente: repositorio, Supabase y marca propios.

## Estructura

```
la-fructosa/
├── index.html             # Shell PWA: meta iOS/Android, Tailwind, import map
├── manifest.webmanifest   # Instalable a pantalla completa
├── sw.js                  # Service worker (app shell + CDNs en caché; Supabase nunca)
├── icons/                 # 192, 512, maskable y apple-touch-icon
├── js/
│   ├── config.js          # URL y anon key de Supabase (públicas)
│   ├── supabase.js        # Cliente Supabase
│   ├── api.js             # Capa de datos (Supabase real o demo en memoria)
│   ├── money.js           # Conversión, saldo consolidado, brecha cambiaria
│   └── app.js             # UI (React + htm, sin build step)
└── supabase/
    └── schema.sql         # Tablas, vistas, triggers y políticas RLS
```

Sin build: React 18, htm y supabase-js se cargan como módulos ES desde esm.sh
con versiones fijas; Tailwind desde su CDN. Se publica tal cual en GitHub Pages.

## Puesta en marcha

1. Crea un proyecto nuevo en Supabase.
2. SQL Editor → pega y ejecuta `supabase/schema.sql`.
3. Authentication → Providers → Email activado.
   Authentication → URL Configuration → agrega la URL de GitHub Pages.
4. Copia Project URL y anon key a `js/config.js`.
5. Prueba local: `npx serve .` (o `python3 -m http.server`) y abre `http://localhost:3000`.
   `?demo` en la URL muestra la app con datos ficticios sin tocar Supabase.
6. GitHub Pages: Settings → Pages → Deploy from branch `main` / root.

Instalar: iPhone → Safari → Compartir → "Agregar a inicio". Android → Chrome → "Instalar app".

## Modelo de datos

| Tabla | Qué guarda | RLS |
|---|---|---|
| `profiles` | Nombre, moneda preferida, tasa de valoración | Solo el propio perfil (`auth.uid() = id`), creado por trigger al registrarse |
| `accounts` | Cuentas/billeteras con su moneda y saldo inicial | CRUD solo propias (`auth.uid() = user_id`) |
| `transactions` | Ingresos, gastos y transferencias; datos del pago en Bs. y la brecha | CRUD solo propias; FKs compuestas impiden usar cuentas ajenas |
| `exchange_rates` | Tasas diarias en Bs. por unidad | Lectura para autenticados; escritura solo service role |

Vistas: `account_balances` (saldo por cuenta) y `latest_rates` (última tasa de cada tipo),
ambas con `security_invoker` para que respeten RLS.

## Brecha cambiaria

Cuando pagas en bolívares desde una cuenta en USD/USDT se guarda el monto en Bs.,
la tasa realmente usada y las tasas BCV y Paralelo (o USDT) del día. La base de datos
calcula `usd_at_bcv`, `usd_at_paralelo` y `spread_usd`; la app muestra el costo real
debitado frente al precio a tasa BCV.

## Siguiente

- Edge Function + `pg_cron` para cargar las tasas diarias en `exchange_rates`.
- Editar/eliminar movimientos y cuentas.
