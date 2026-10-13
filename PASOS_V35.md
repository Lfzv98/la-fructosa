# La Fructosa v35 · Inversiones (solo en tu cuenta)

## Qué hay de nuevo

- **Sección Inversiones**, visible únicamente en la cuenta **luiszeav@gmail.com**.
  Nadie más la ve: ni en el menú, ni en Inicio, ni en el Copiloto.
- Cada inversión guarda **tipo** (acciones, fondos, cripto, plazo fijo u otro), **monto invertido**,
  **moneda** (las de tu país), **valor actual**, **fecha** y una nota opcional.
- Muestra la **ganancia o pérdida** en monto y en %, por inversión, por tipo y en total.
- El valor actual de tus inversiones **suma al Patrimonio total** de Inicio. Debajo del total ves
  "Cuentas" e "Inversiones" por separado; tócalo para abrir la sección.
- El Copiloto IA conoce tus inversiones, y el respaldo en Excel trae una hoja "Inversiones".
- Teléfono, iPad y laptop: en laptop e iPad las 3 tarjetas (Invertido, Valor actual, Ganancia) van en una fila;
  en teléfono la ganancia baja a su propia fila.

## Cómo se protege

- El permiso vive en tu perfil de Supabase (`investments_enabled`), no en el código de la app.
- La app **no puede** encender ni apagar ese permiso: solo el SQL Editor.
- La tabla `investments` tiene RLS: cada quien ve solo lo suyo, y además solo si tiene el permiso.
- No se usa ni se guarda ninguna contraseña.

## Pasos

**1. Activar Inversiones en Supabase** (una vez)

En Supabase › **SQL Editor**, abre `supabase/migrations/015_inversiones.sql`, copia todo, pégalo y presiona **Run**.
No hay nada que reemplazar. Al final debe salir **una fila**: `luiszeav@gmail.com | true`.

Si sale vacío, tu correo en Supabase es otro. Revisa con:

```sql
select email from auth.users order by created_at;
```

**2. Subir la app** (en la terminal de Cursor, dentro de la carpeta La Fructosa)

```
node --test tests/*.test.mjs
git add -A
git commit -m "v35: inversiones solo para la cuenta con permiso"
git push
```

Espera 1 o 2 minutos, abre la app y toca **Actualizar** cuando diga "Hay una versión nueva".
No hay funciones nuevas que desplegar.

**3. Comprobar**

- Con tu cuenta: en **Más** (o en la barra lateral, bajo Planifica) aparece **Inversiones**.
- Con la cuenta de un familiar: no aparece nada nuevo.

## Si un día quieres dársela a alguien más

En el SQL Editor (cambia el correo):

```sql
update public.profiles p set investments_enabled = true
  from auth.users u where u.id = p.id and lower(u.email) = 'correo@ejemplo.com';
```

Para quitarla, lo mismo con `false`. Sus inversiones quedan guardadas, pero ocultas.
