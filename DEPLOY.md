# 🚀 Deploy a Vercel (GitHub + auto-deploy)

El código ya está commiteado y los secretos (`.env.local`, `pwd.txt`) NO se suben.
Seguí estos pasos una sola vez. Después, cada cambio que commitees se publica solo.

## 1. Crear el repositorio en GitHub
1. Entrá a <https://github.com/new>
2. **Repository name:** `mundial-2026-gaznapios` (o el que quieras)
3. Elegí **Private** (privado, solo tu familia).
4. **NO** marques "Add a README" ni `.gitignore` ni license (dejá todo vacío).
5. Click **Create repository**. Copiá la URL que te muestra (algo como
   `https://github.com/TU_USUARIO/mundial-2026-gaznapios.git`).

## 2. Subir el código (en la terminal de VS Code)
Pegá esto cambiando la URL por la tuya:

```bash
git remote add origin https://github.com/TU_USUARIO/mundial-2026-gaznapios.git
git push -u origin master
```

La primera vez se abre una ventana para iniciar sesión en GitHub: autorizá y listo.

## 3. Importar en Vercel
1. Entrá a <https://vercel.com/new> (registrate con tu cuenta de GitHub si no la tenés).
2. **Import** el repo `mundial-2026-gaznapios`.
3. Vercel detecta Next.js solo. **No cambies** Framework ni Build Command.
4. Abrí **Environment Variables** y **pegá** todo el contenido de tu archivo `.env.local`
   (Vercel acepta pegar varias líneas `CLAVE=valor` de una). Tiene que quedar:
   - `TIDB_HOST`, `TIDB_PORT`, `TIDB_USER`, `TIDB_PASSWORD`, `TIDB_DATABASE`
   - `AUTH_SECRET`
   - `CRON_SECRET`
   - `FOOTBALL_DATA_API_KEY`
   - `ADMIN_EMAIL`
5. Click **Deploy** y esperá ~1 minuto.

## 4. Permitir que Vercel se conecte a TiDB
En **TiDB Cloud** → tu cluster → **Networking** (o "Connection" → "Network Access"):
- Agregá **Allow access from anywhere** (`0.0.0.0/0`).
  (TiDB Serverless ya exige TLS, así que sigue siendo seguro para uso familiar.)

## 5. ¡Listo!
- Tu app queda en `https://mundial-2026-gaznapios.vercel.app` (o el nombre que ponga Vercel).
- Pasale el link a la familia para que se registren.
- El cron de resultados corre solo todos los días (configurado en `vercel.json`).

## Para actualizar la app más adelante
Cada vez que cambiemos algo:
```bash
git add -A
git commit -m "descripción del cambio"
git push
```
Vercel publica la nueva versión sola en ~1 minuto.
