# La Fructosa v25 · Pasos para publicar en Vercel

## 0. Copia los archivos a tu carpeta "La Fructosa" (Escritorio)

Reemplaza (o crea) estos archivos, respetando las carpetas:

- `sw.js` (caché fructosa-v25)
- `vercel.json` (nuevo)
- `.vercelignore` (nuevo; en Finder los archivos con punto están ocultos: Cmd+Shift+. los muestra)
- `README.md`
- `js/howToUseIt.js`
- `supabase/functions/login/index.ts`
- `supabase/functions/ai-proxy/index.ts`

## 1. Subir a GitHub (terminal de Cursor, dentro de la carpeta La Fructosa)

```bash
git add sw.js vercel.json .vercelignore README.md js/howToUseIt.js supabase/functions/login/index.ts supabase/functions/ai-proxy/index.ts
git commit -m "v25: lista para Vercel (vercel.json, CORS para vercel.app, enlace dinámico)"
git push origin main
```

GitHub Pages sigue funcionando igual en https://lfzv98.github.io/la-fructosa/.

## 2. Redesplegar las dos Edge Functions (necesario: si no, el login por usuario y el copiloto fallan desde Vercel)

```bash
supabase secrets list
```

Si en la lista aparece `AI_ALLOWED_ORIGINS` o `LOGIN_ALLOWED_ORIGINS`, actualízalos (si no aparecen, salta este comando):

```bash
supabase secrets set AI_ALLOWED_ORIGINS="https://lfzv98.github.io,https://la-fructosa.vercel.app,https://la-fructosa-*.vercel.app,http://localhost:8000"
```

Luego:

```bash
supabase functions deploy login --no-verify-jwt
supabase functions deploy ai-proxy
```

`update-rates` y `send-reminders` ya aceptan cualquier origen: no hay que tocarlas.

## 3. Conectar el repositorio en Vercel

1. Entra a https://vercel.com y pulsa **Sign Up / Log in → Continue with GitHub**.
2. Pulsa **Add New… → Project**.
3. En "Import Git Repository" busca **la-fructosa** y pulsa **Import**.
   (Si no aparece: **Adjust GitHub App Permissions** → dale acceso al repo la-fructosa.)
4. En "Configure Project":
   - **Project Name**: `la-fructosa` (así la URL será la-fructosa.vercel.app).
   - **Framework Preset**: `Other`.
   - **Root Directory**: `./` (no lo cambies).
   - **Build and Output Settings**: déjalo todo vacío / sin build.
   - **Environment Variables**: ninguna (las claves públicas ya están en `js/config.js`).
5. Pulsa **Deploy**. En menos de un minuto te da la URL.
6. Si Vercel te dio otra URL (por ejemplo, porque el nombre estaba ocupado), anótala: hay que usarla en el paso 4
   y en `AI_ALLOWED_ORIGINS`.

Desde ahora, cada `git push origin main` publica solo en Vercel y en GitHub Pages a la vez.

## 4. Supabase Auth (Dashboard → Authentication → URL Configuration)

- **Site URL**: `https://la-fructosa.vercel.app` (los correos de confirmación y de "olvidé mi contraseña" llevarán
  a Vercel y no a github.io, que está bloqueado).
- **Redirect URLs** → Add URL, una por una:
  - `https://la-fructosa.vercel.app/**`
  - `https://la-fructosa-*.vercel.app/**`
  - `https://lfzv98.github.io/la-fructosa/**`
- Pulsa **Save**.

## 5. Probar

1. Abre https://la-fructosa.vercel.app/?demo → debe cargar el demo.
2. Abre https://la-fructosa.vercel.app/ y entra con tu usuario y contraseña.
3. Prueba el copiloto con una pregunta.
4. En el iPhone: Safari → Compartir → Agregar a pantalla de inicio.

Ojo: para el navegador, Vercel es un sitio distinto a github.io. En el nuevo enlace cada familiar debe volver a
entrar, reinstalar el ícono y volver a activar el bloqueo con Face ID/huella y los avisos. El dinero y los
movimientos están en Supabase y aparecen igual.
