// Simulador de prueba para verificar que el cuadro se completa solo.
// Uso: node --env-file=.env.local scripts/sim.mjs <comando>
//   groups        -> termina los 72 partidos de grupos (gana el equipo de menor id)
//   ko <stage>    -> termina todos los partidos de esa ronda con equipos (gana el local)
//   counts        -> muestra cuántas llaves tienen equipos / están finalizadas
//   reset         -> borra todos los resultados (deja todo programado)
import mysql from "mysql2/promise";

const cmd = process.argv[2];
const arg = process.argv[3];
const conn = await mysql.createConnection({
  host: process.env.TIDB_HOST, port: +process.env.TIDB_PORT, user: process.env.TIDB_USER,
  password: process.env.TIDB_PASSWORD, database: process.env.TIDB_DATABASE,
  ssl: { minVersion: "TLSv1.2" },
});

if (cmd === "groups") {
  const [ms] = await conn.query("SELECT id, home_team_id, away_team_id FROM matches WHERE stage='group'");
  for (const m of ms) {
    const homeWins = m.home_team_id < m.away_team_id; // gana el de menor id
    await conn.query("UPDATE matches SET home_score=?, away_score=?, status='finished' WHERE id=?",
      [homeWins ? 2 : 0, homeWins ? 0 : 2, m.id]);
  }
  console.log(`${ms.length} partidos de grupos finalizados.`);
} else if (cmd === "ko") {
  const [ms] = await conn.query(
    "SELECT id FROM matches WHERE stage=? AND home_team_id IS NOT NULL AND away_team_id IS NOT NULL AND status='scheduled'",
    [arg]);
  for (const m of ms) {
    await conn.query("UPDATE matches SET home_score=1, away_score=0, status='finished' WHERE id=?", [m.id]);
  }
  console.log(`${ms.length} partidos de ${arg} finalizados (gana el local).`);
} else if (cmd === "counts") {
  const [r] = await conn.query(`
    SELECT stage,
           COUNT(*) total,
           SUM(home_team_id IS NOT NULL AND away_team_id IS NOT NULL) con_equipos,
           SUM(status='finished') finalizados
    FROM matches WHERE stage<>'group' GROUP BY stage
    ORDER BY FIELD(stage,'r32','r16','qf','sf','third','final')`);
  console.table(r.map((x) => ({ ronda: x.stage, total: +x.total, con_equipos: +x.con_equipos, finalizados: +x.finalizados })));
} else if (cmd === "reset") {
  await conn.query("UPDATE matches SET home_score=NULL, away_score=NULL, status='scheduled', winner_team_id=NULL");
  await conn.query("UPDATE predictions SET points=NULL");
  console.log("Resultados reseteados.");
} else {
  console.log("Comando desconocido:", cmd);
}
await conn.end();
