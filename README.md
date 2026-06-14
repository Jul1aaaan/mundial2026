# 🏆 Fixture Mundial 2026 — en familia

App de pronósticos del Mundial 2026 para jugar en familia. Cada uno carga sus
resultados, la tabla de cada grupo se actualiza al instante y hay un ranking
general. Hecha con **Next.js + TiDB (MySQL)**, lista para **Vercel**.

## ¿Cómo se juega?

- Cada partido tiene dos casilleros para poner los goles.
- Al cargar tu pronóstico, **la tabla del grupo de arriba se recalcula sola**.
- Podés editar tu pronóstico **hasta que el partido empieza** (después se cierra 🔒).
- **Puntaje (aditivo):** acertar quién gana/empata = **2 pts** · goles exactos de un equipo = **+1 pt** (cada uno) · resultado exacto = **4 pts** (2 + 1 + 1).
- Los resultados reales entran automáticamente todos los días (o los cargás a mano
  desde el panel de admin).

## Primer arranque (local)

1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Las credenciales ya están en `.env.local` (TiDB, secretos, email de admin).
   - El usuario que se registre con el email de `ADMIN_EMAIL` será el **administrador**.
   - Para los resultados automáticos, conseguí una API key **gratuita** en
     <https://www.football-data.org/client/register> y pegala en `FOOTBALL_DATA_API_KEY`.
     (Si la dejás vacía, igual podés cargar los resultados a mano.)
3. Crear las tablas y cargar equipos/partidos (ya se corrió una vez; volvé a correr si hace falta):
   ```bash
   npm run db:setup     # crea y siembra si está vacío
   npm run db:reset     # borra todo y vuelve a sembrar
   ```
4. Levantar la app:
   ```bash
   npm run dev
   ```
   Abrí <http://localhost:3000>, registrate y a jugar.

## Subir a Vercel

1. Subí el proyecto a un repo de GitHub.
2. En Vercel: **New Project** → importá el repo.
3. En **Settings → Environment Variables** cargá las mismas variables que están en
   `.env.local`:
   - `TIDB_HOST`, `TIDB_PORT`, `TIDB_USER`, `TIDB_PASSWORD`, `TIDB_DATABASE`
   - `AUTH_SECRET`
   - `CRON_SECRET`
   - `FOOTBALL_DATA_API_KEY`
   - `ADMIN_EMAIL`
4. **Deploy**. El `vercel.json` ya deja programado el cron diario
   (`/api/cron/sync` todos los días a las 06:00 UTC) que trae los resultados.

> En TiDB Cloud, en **Networking**, agregá el acceso público (`0.0.0.0/0`) o las IPs
> de Vercel para que la app pueda conectarse desde la nube.

## Fixture: grupos y eliminatorias

El fixture tiene dos pestañas: **Fase de grupos** y **Eliminatorias**. El cuadro de
eliminatorias (16avos → final) sigue la estructura **oficial del Mundial 2026** y se
**completa solo** a partir de los resultados reales: cuando termina la fase de grupos
se ubican los 1º, 2º y los 8 mejores terceros en su llave correspondiente, y a medida
que se juegan los partidos los ganadores avanzan de ronda automáticamente. Nadie tiene
que cargar los cruces a mano.

## Panel de administración (`/admin`, solo el admin)

- **Sincronizar ahora**: trae resultados reales desde la API y completa las llaves.
- **Recalcular cuadro**: rehace las llaves a partir de los resultados actuales (por si hace falta).
- **Cargar resultado real (manual)**: respaldo por si la API falla. Al guardar, se
  recalculan los puntos y se avanzan las llaves. En eliminatorias, si hay empate, elegís
  quién pasa (penales).

## Estructura

- `src/app` — páginas (`/` fixture, `/ranking`, `/admin`, `/login`, `/register`) y API.
- `src/components` — UI (fixture en vivo, tablas, panel admin, navbar).
- `src/lib` — conexión a TiDB, auth/sesiones, scoring, acceso a datos, sync con la API,
  `bracket.ts` (cuadro oficial 2026 + resolución automática de llaves).
- `scripts/setup-db.mjs` — esquema + carga inicial (48 equipos, 12 grupos, 104 partidos).
- `scripts/migrate-knockout.mjs` — migra una base ya creada al cuadro oficial con códigos.
