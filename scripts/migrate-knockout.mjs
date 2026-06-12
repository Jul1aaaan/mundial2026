// Migra la base existente al cuadro oficial 2026 sin tocar usuarios ni la fase de grupos.
// Uso: node --env-file=.env.local scripts/migrate-knockout.mjs
import mysql from "mysql2/promise";
import { KO_SEED } from "./ko-seed.mjs";

const conn = await mysql.createConnection({
  host: process.env.TIDB_HOST,
  port: Number(process.env.TIDB_PORT ?? 4000),
  user: process.env.TIDB_USER,
  password: process.env.TIDB_PASSWORD,
  database: process.env.TIDB_DATABASE,
  ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
});
console.log("Conectado a TiDB.");

// 1) Agregar columnas nuevas si no existen.
const [cols] = await conn.query(
  `SELECT COLUMN_NAME FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'matches'`,
  [process.env.TIDB_DATABASE]
);
const have = new Set(cols.map((c) => c.COLUMN_NAME));
if (!have.has("code")) {
  await conn.query("ALTER TABLE matches ADD COLUMN code VARCHAR(8) NULL");
  console.log("+ columna code");
}
if (!have.has("winner_team_id")) {
  await conn.query("ALTER TABLE matches ADD COLUMN winner_team_id INT NULL");
  console.log("+ columna winner_team_id");
}

// 2) Reemplazar las llaves viejas por el cuadro oficial con códigos.
const [ko] = await conn.query("SELECT id FROM matches WHERE stage <> 'group'");
const koIds = ko.map((r) => r.id);
if (koIds.length > 0) {
  await conn.query(`DELETE FROM predictions WHERE match_id IN (${koIds.map(() => "?").join(",")})`, koIds);
  await conn.query("DELETE FROM matches WHERE stage <> 'group'");
  console.log(`- ${koIds.length} llaves viejas borradas`);
}

const [[{ maxOrd }]] = await conn.query("SELECT COALESCE(MAX(ord), 71) AS maxOrd FROM matches");
let ord = Number(maxOrd) + 1;
for (const [code, stage, round, hl, al] of KO_SEED) {
  await conn.query(
    `INSERT INTO matches (stage, round_name, code, home_label, away_label, ord)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [stage, round, code, hl, al, ord++]
  );
}
console.log("32 llaves del cuadro oficial 2026 insertadas.");

await conn.end();
console.log("Migración lista ✅");
