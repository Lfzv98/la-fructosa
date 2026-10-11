# La Fructosa 3.1: lo que te toca hacer

Todo está en tu carpeta **La Fructosa** del escritorio. Sigue los pasos en orden. Cada bloque gris se copia y se pega tal cual.

> **Dónde va cada cosa**
> - **Terminal de Cursor**: en Cursor, menú *Terminal › New Terminal*. Tiene que estar abierta en la carpeta La Fructosa.
> - **SQL Editor de Supabase**: supabase.com › tu proyecto › *SQL Editor* › *New query*. Pegas, y le das a **Run**.

---

## Paso 1. Subir la app a GitHub

En la terminal de Cursor, pega esto. Saca del repositorio público el zip viejo, los `.DS_Store` y las copias sueltas de SQL. Siguen en tu computadora, solo dejan de publicarse:

```
git rm -r --cached --ignore-unmatch -q .DS_Store js/.DS_Store supabase/.DS_Store la-fructosa-v2.zip 004_usuarios.sql 005_conversaciones.sql 006_login_seguro.sql 007_metas_prestamos.sql 008_avisos.sql
```

Después sube todo:

```
git add -A
git commit -m "La Fructosa 3.1: confianza, capturas de cualquier pago, respaldo y tasas"
git push
```

Espera 1 o 2 minutos y abre la app. Cuando salga **"Hay una versión nueva"**, toca **Actualizar**.

---

## Paso 2. Desplegar las funciones del servidor

En la terminal de Cursor, pega las tres líneas (puedes pegarlas juntas):

```
supabase functions deploy login --no-verify-jwt
supabase functions deploy ai-proxy
supabase functions deploy update-rates --no-verify-jwt
```

- `login`: entrar con usuario sin que se vea el correo de nadie.
- `ai-proxy`: Fructosa lee capturas de cualquier banco o app y se adapta sola cuando Google cambia de modelo.
- `update-rates`: guarda las tasas del día. Lleva `--no-verify-jwt` para que el reloj automático pueda llamarla siempre. Es seguro porque solo consulta tasas públicas y no las vuelve a buscar si ya se actualizaron hace menos de hora y media.

---

## Paso 3. Probar el login y cerrar la puerta vieja

1. Abre la app, sal de tu sesión y vuelve a **entrar con tu usuario** (no con el correo).
2. Si entraste bien, en el **SQL Editor** de Supabase abre el archivo `supabase/migrations/006_login_seguro.sql`, copia todo su contenido, pégalo y dale a **Run**.

Si ya lo habías hecho antes, sáltate este paso. Repetirlo no daña nada.

---

## Paso 4. Correr las migraciones nuevas

En el **SQL Editor**, una por una (copia todo el archivo, pégalo y dale a **Run**):

1. `supabase/migrations/007_metas_prestamos.sql`: activa Metas de ahorro y Préstamos. Sáltalo si ya lo corriste.
2. `supabase/migrations/009_confianza.sql`: no hay que cambiarle nada. Hace tres cosas:
   - las tasas se buscan 4 veces al día en vez de 2 (8 a. m., 11 a. m., 2 p. m. y 6 p. m.);
   - prepara el aviso semanal de respaldo;
   - activa **Ajustes › Borrar mi cuenta**.

---

## Paso 5. Revisar que las tasas se guardan todos los días

En el **SQL Editor** pega esto y dale a **Run**:

```sql
select rate_date, rate_type, rate, source, fetched_at
from public.exchange_rates
order by rate_date desc, rate_type
limit 12;
```

Tienes que ver filas con la **fecha de hoy**. Si las últimas son de días atrás, pega esto para ver qué respondió el servidor las últimas veces:

```sql
select status_code, left(content::text, 200) as respuesta, created
from net._http_response
order by created desc
limit 5;
```

- Un **401** significa que el reloj no tenía permiso. Con el Paso 2 (`--no-verify-jwt`) queda resuelto.
- Un **200** significa que funciona bien.

Igual, desde esta versión, si al abrir la app no hay tasas de hoy, la app las pide al servidor ella sola.

---

## Paso 6 (opcional). Avisos en el teléfono

Así llegan notificaciones de pagos fijos por vencer, préstamos, tasas de la mañana y el **recordatorio de respaldo**.

**6.1** En la terminal de Cursor, crea las llaves de los avisos:

```
npx web-push generate-vapid-keys
```

Te muestra dos llaves: *Public Key* y *Private Key*. Déjalas a la vista.

**6.2** Crea una clave secreta para el reloj automático y anótala:

```
openssl rand -hex 24
```

**6.3** Guarda todo en Supabase. Reemplaza lo que está en MAYÚSCULAS por tus valores (sin espacios alrededor del `=`):

```
supabase secrets set VAPID_PUBLIC_KEY=PEGA_LA_PUBLIC_KEY VAPID_PRIVATE_KEY=PEGA_LA_PRIVATE_KEY VAPID_SUBJECT=mailto:luiszeav@gmail.com CRON_SECRET=PEGA_LA_CLAVE_DEL_6.2
```

**6.4** Despliega la función de avisos:

```
supabase functions deploy send-reminders --no-verify-jwt
```

**6.5** Abre `supabase/migrations/008_avisos.sql` y cambia dos cosas:

- `TU-PROYECTO` por `bkausossugbbyfsersmb`;
- `TU-CRON-SECRET` por la clave del 6.2.

Cópialo completo en el **SQL Editor** y dale a **Run**.

**6.6** En la app: **Ajustes › Avisos › Activar**. En iPhone primero instala la app en la pantalla de inicio (Safari › Compartir › Agregar a inicio).

---

## Paso 7 (recomendado, gratis). Protección extra en GitHub

En github.com › tu repositorio **la-fructosa** › *Settings* › *Advanced Security* (en algunas cuentas aparece como *Code security*):

- activa **Secret Protection** y **Push protection**. Si algún día pegas una clave por error, GitHub bloquea el envío antes de publicarla.

---

## Listo. Lo que pasa solo a partir de ahora

- **Tasas**: se actualizan 4 veces al día. Si una fuente falla, se recupera en la siguiente vuelta, y la app también las pide al abrirse.
- **IA**: si Google apaga un modelo o saca uno nuevo, Fructosa usa el Flash más nuevo disponible sin que toques nada.
- **Respaldo**: a los 7 días sin respaldo aparecen la tarjeta en Inicio, el aviso arriba en las demás pantallas y, si activaste avisos, la notificación.
- **Usuarios nuevos y actuales**: antes del tour ven la pantalla **"Tu tranquilidad es lo primero"** y aceptan los términos (una sola vez).

El manual actualizado está en `docs/La_Fructosa_Manual_de_Uso.pdf` (y en Word) y dentro de la app en **Más › Manual de uso**.
