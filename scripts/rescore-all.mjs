// Recalcula los puntos de TODOS los pronósticos de partidos ya finalizados con la
// fórmula actual (aditiva). Uso: node --env-file=.env.local scripts/rescore-all.mjs
import mysql from "mysql2/promise";

function pts(ph, pa, rh, ra) {
  if (ph === rh && pa === ra) return 10; // resultado perfecto
  let p = 0;
  if (Math.sign(ph - pa) === Math.sign(rh - ra)) p += 5;
  if (ph - pa === rh - ra) p += 2; // diferencia de gol exacta
  if (ph === rh) p += 1;
  if (pa === ra) p += 1;
  return p;
}

const c = await mysql.createConnection({
  host: process.env.TIDB_HOST, port: +process.env.TIDB_PORT, user: process.env.TIDB_USER,
  password: process.env.TIDB_PASSWORD, database: process.env.TIDB_DATABASE,
  ssl: { minVersion: "TLSv1.2" },
});

const [matches] = await c.query(
  "SELECT id, home_score, away_score FROM matches WHERE status='finished' AND home_score IS NOT NULL"
);
let updated = 0;
for (const m of matches) {
  const [preds] = await c.query(
    "SELECT id, pred_home, pred_away, points FROM predictions WHERE match_id = ?", [m.id]
  );
  for (const p of preds) {
    const np = pts(p.pred_home, p.pred_away, m.home_score, m.away_score);
    if (np !== p.points) {
      await c.query("UPDATE predictions SET points = ? WHERE id = ?", [np, p.id]);
      updated++;
    }
  }
}
console.log(`Partidos finalizados: ${matches.length}. Pronósticos actualizados: ${updated}.`);
await c.end();
