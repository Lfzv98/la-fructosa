# La Fructosa 3.0

PWA de finanzas personales para la familia: cuentas en USD, Bs., USDT y EUR,
tasas BCV / Paralelo / USDT, calculadora de brecha cambiaria, presupuestos,
pagos fijos y análisis del mes. Cada familiar entra con su correo y **solo ve lo suyo**
(Row Level Security en Supabase).

Producción: https://lfzv98.github.io/la-fructosa/ · Demo: agrega `?demo` a la URL.

## Acceso

- **Entrar** con usuario (o correo) y contraseña.
- **Crear cuenta**: nombre, usuario único (se comprueba mientras escribes), correo (para confirmar y recuperar la contraseña), contraseña dos veces y **país obligatorio**. No hay país marcado por defecto: el botón no se activa hasta elegirlo.
- El país define cómo funciona la app: 🇻🇪 USD, Bs. y USDT con tasas y brecha; 🇺🇸 solo dólares; 🇪🇸 euros. En EE. UU. y España se ocultan tasas, brecha y bolívares.
- Quien ya tenía cuenta sin usuario ve la pantalla de completar perfil al entrar y elige usuario y país una sola vez.

## Qué trae la 2.0

| Módulo | Qué hace |
|---|---|
| Inicio | Patrimonio consolidado (USD/VES/EUR, valorado a BCV o Paralelo), mes en curso, tasas, consejo del día, pagos próximos, presupuestos y últimos movimientos |
| Registrar (+) | Gasto, ingreso o transferencia en una hoja; "Pagué en bolívares" con costo real y brecha; transferencias entre monedas con monto sugerido y tasa implícita; aviso de presupuesto; Deshacer |
| Movimientos | Por mes, búsqueda global, filtros por tipo/cuenta/categoría, totales por día, editar y eliminar, exportar CSV |
| Cuentas | Crear con plantillas, editar, archivar, eliminar, detalle con historial y **Ajustar saldo** |
| Presupuestos | Tope mensual por categoría, ritmo de gasto, cuánto puedes gastar por día, sugerencia por promedio de 3 meses |
| Pagos fijos | Vencidos/próximos/pagados, total comprometido, "Pagar" con un toque (queda enlazado al fijo) |
| Análisis | Dona por categoría, 6 meses de ingresos vs gastos, gastos más grandes y hallazgos automáticos |
| Tasas | BCV, Paralelo, USDT y Euro con tendencia, calculadora y comparador "¿pago en $ o en Bs.?" |
| Aprende | Recorrido de bienvenida, glosario y botones ⓘ en cada concepto |
| Ajustes | Región (VE/US/ES), moneda principal, valoración, ocultar saldos, instalar, cambiar contraseña |

Novedades 2.2: saldos correctos con más de 1.000 movimientos, **respaldo en Excel** (Ajustes → Respaldo,
con recordatorio semanal en Inicio), aviso de privacidad del copiloto que cada persona acepta antes de usarlo,
y entrar con usuario sin revelar el correo de nadie (Edge Function `login`).

Novedades 2.3: **registrar sin internet** (el movimiento queda en el teléfono y se sube solo al volver la señal;
la app también abre sin conexión con la última copia), **bloqueo con PIN y Face ID / huella** (Ajustes → Privacidad)
y **leer capturas de Pago Móvil o recibos** con el botón 📷 de Fructosa (requiere desplegar de nuevo `ai-proxy`).

Novedades 3.0: **metas de ahorro** y **préstamos** (Más → Metas / Préstamos; migración 007), **avisos al teléfono**
de pagos fijos por vencer, préstamos y tasas (Ajustes → Avisos; función `send-reminders` + migración 008),
**modo claro** (Ajustes → Apariencia), aviso cuando las tasas llevan días sin actualizarse y **pruebas automáticas**
de los cálculos de dinero (`node --test tests/*.test.mjs`, también en GitHub Actions).

Además: navegación por pestañas con botón "atrás" que cierra hojas, modo sin conexión,
aviso de "versión nueva", configuración rápida de cuentas al registrarse y región que oculta
tasas fuera de Venezuela.

## Estructura

```
la-fructosa/
├── index.html              # Shell PWA + import map (React, htm, supabase-js desde esm.sh)
├── styles.css              # Sistema de diseño propio (sin Tailwind CDN)
├── manifest.webmanifest    # Instalable a pantalla completa, con accesos directos
├── sw.js                   # Caché de la app; avisa cuando hay versión nueva
├── icons/                  # Íconos pastel (192, 512, maskable, apple, favicon)
├── js/
│   ├── config.example.js   # Plantilla: cópiala como config.js con tus claves
│   ├── app.js              # Sesión, rutas (#/…), pestañas, actualizaciones
│   ├── api.js              # Capa de datos: Supabase real o demo en localStorage
│   ├── store.js            # Estado global: saldos, conversión por fecha, estadísticas
│   ├── money.js            # Monedas, regiones, categorías, conversión, brecha, formatos
│   ├── rates.js            # Respaldo de tasas en vivo (DolarApi) si la BD no tiene las de hoy
│   ├── ui.js · charts.js   # Componentes y gráficos SVG
│   ├── learn.js            # Glosario y consejos
│   ├── export.js           # CSV para Excel / Sheets
│   └── screens/            # Una pantalla por archivo
└── supabase/
    ├── schema.sql                     # Instalación desde cero
    ├── migrations/002_mejoras.sql     # Actualiza una base existente a la 2.0
    ├── migrations/003_tasas_automaticas.sql  # pg_cron: tasas 2 veces al día
    ├── migrations/004_usuarios.sql    # Usuario único para entrar + país del registro
    ├── migrations/005_conversaciones.sql # Guarda la conversación con Fructosa (RLS por usuario)
    ├── migrations/006_login_seguro.sql   # Cierra email_for_login (correr después de desplegar `login`)
    ├── migrations/007_metas_prestamos.sql # Metas de ahorro y préstamos (RLS por usuario)
    ├── migrations/008_avisos.sql          # Suscripciones push + envío diario (pg_cron)
    ├── functions/login/index.ts          # Entrar con usuario sin exponer correos
    ├── functions/send-reminders/index.ts # Avisos push diarios (pagos, préstamos, tasas)
    └── functions/update-rates/index.ts       # Edge Function que guarda las tasas
```

## Actualizar desde la versión anterior

1. **No borres `js/config.js`**: tiene tus claves y el zip no lo trae a propósito.
   Copia todo lo demás encima de tu repositorio.
2. Supabase → SQL Editor → ejecuta `supabase/migrations/002_mejoras.sql` y luego
   `supabase/migrations/004_usuarios.sql` y `supabase/migrations/005_conversaciones.sql` (no borran nada; puedes correrlas de nuevo sin problema).
3. Sube a GitHub (`main`). Al abrir la app verás "Hay una versión nueva" → Actualizar.

## Instalación desde cero

1. Proyecto nuevo en Supabase → SQL Editor → ejecuta `supabase/schema.sql`.
2. Authentication → Providers → Email activo. URL Configuration → agrega la URL de GitHub Pages.
3. Copia `js/config.example.js` como `js/config.js` y pon Project URL y anon key.
4. Prueba local: `python3 -m http.server` y abre `http://localhost:8000/?demo`.
5. GitHub Pages: Settings → Pages → Deploy from branch `main` / root.

## Tasas automáticas

1. `supabase functions deploy update-rates` (CLI de Supabase).
2. Edita y ejecuta `supabase/migrations/003_tasas_automaticas.sql` (9 a. m. y 5 p. m. de Caracas).

Mientras tanto la app usa DolarApi en vivo para mostrar tasas si la BD no tiene las de hoy.

## Seguridad

- Toda tabla con datos personales tiene RLS `auth.uid() = user_id`; las FK compuestas impiden
  usar cuentas de otra persona. `exchange_rates` es de solo lectura para usuarios.
- La anon key es pública por diseño; nunca pongas la service_role key en el frontend.
- El service worker nunca guarda respuestas de Supabase.
- Entrar con usuario pasa por la Edge Function `login` (`supabase functions deploy login --no-verify-jwt`);
  después, `006_login_seguro.sql` quita el acceso público a `email_for_login`.
- El copiloto pide permiso a cada persona antes de enviar datos a Google Gemini (servicio gratuito).

Al publicar una versión nueva, sube `CACHE_VERSION` en `sw.js`.
