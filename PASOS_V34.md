# La Fructosa v34 · Tasas y calculadora

## Qué estaba mal

1. **"Sin historial suficiente" en todo.** La base de datos no estaba guardando las tasas de cada día.
   Todas las tarjetas mostraban la fuente "en vivo" (BCV oficial, Monitor Paralelo, Binance P2P), que es
   lo que la app usa solo cuando la base de datos no tiene el dato. El reloj automático (migración 003)
   pedía pegar a mano la dirección y una clave; con la clave nueva `sb_publishable_...` (que no es un JWT)
   o sin pegarla, el reloj no funciona. La migración 009 solo cambia un reloj que ya exista, así que no lo arreglaba.
2. **BCV y Euro con fecha 09/10.** No era un fallo: el BCV no publica fines de semana ni feriados
   (el lunes 12/10 fue feriado). La tasa del viernes sigue vigente. Ahora la tarjeta dice
   "Vigente · publicada el 09/10" en vez de una fecha que parece vieja.
3. **Dos selectores de período** (7/30/90 días arriba y 1 mes/3/6/1 año en Historial). Quedó uno solo,
   dentro de Historial: 7 días, 1 mes, 3 meses, 6 meses y 1 año. Recuerda tu última elección.
4. **Calculadora en € mostraba una sola fila.** Ahora en € muestra Euro BCV, Euro al paralelo, Euro en USDT
   y el equivalente en dólares. En $ agrega la diferencia BCV vs. paralelo y el equivalente en euros.
   Toca cualquier resultado para copiarlo.

## Mejoras

- El gráfico usa el historial público de DolarApi mientras tu base de datos junta sus propios días.
- La función `update-rates` copia meses de historial (BCV, paralelo y euro) la primera vez, sin pisar lo guardado.
- El botón de actualizar también guarda las tasas de hoy en la base de datos.
- Laptop: las 4 tasas en una fila y Historial + Calculadora lado a lado. iPad y teléfono quedan como antes.
- Si no hay días guardados, el gráfico explica qué pasa en vez de "Sin historial suficiente".

## Pasos (en la terminal de Cursor, dentro de la carpeta La Fructosa)

**1. Subir la app**

```
git add -A
git commit -m "v34: tasas guardadas a diario, historial y calculadora"
git push
```

Espera 1 o 2 minutos, abre la app y toca **Actualizar** cuando diga "Hay una versión nueva".

**2. Desplegar la función de tasas**

```
npx supabase functions deploy update-rates --no-verify-jwt
```

**3. Programar el reloj y llenar el historial**

En Supabase › **SQL Editor**, abre `supabase/migrations/014_tasas_diarias.sql`, copia todo, pégalo y presiona **Run**.
No hay nada que reemplazar.

**4. Comprobar** (espera unos 20 segundos después del paso 3)

En el SQL Editor pega esto y presiona **Run**:

```sql
select rate_type, count(*) as dias, min(rate_date) as desde, max(rate_date) as hasta
from public.exchange_rates group by rate_type order by rate_type;
```

Debe haber decenas de días para BCV_USD, PARALELO y BCV_EUR, y al menos hoy para USDT.
Si sale vacío, pega esto:

```sql
select status_code, left(content::text, 300) as respuesta, created
from net._http_response order by created desc limit 5;
```

- **200**: funciona.
- **401**: repite el paso 2 (falta `--no-verify-jwt`).
- **404**: la función no está desplegada; repite el paso 2.
