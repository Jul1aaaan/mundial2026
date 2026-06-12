// Crea el esquema y carga equipos/grupos/partidos del Mundial 2026.
// Uso:  node --env-file=.env.local scripts/setup-db.mjs [--reset]
import mysql from "mysql2/promise";

const RESET = process.argv.includes("--reset");

const conn = await mysql.createConnection({
  host: process.env.TIDB_HOST,
  port: Number(process.env.TIDB_PORT ?? 4000),
  user: process.env.TIDB_USER,
  password: process.env.TIDB_PASSWORD,
  database: process.env.TIDB_DATABASE,
  ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
  multipleStatements: true,
});

console.log("Conectado a TiDB.");

if (RESET) {
  console.log("--reset: borrando tablas...");
  await conn.query(`
    SET FOREIGN_KEY_CHECKS = 0;
    DROP TABLE IF EXISTS predictions;
    DROP TABLE IF EXISTS matches;
    DROP TABLE IF EXISTS teams;
    DROP TABLE IF EXISTS users;
    SET FOREIGN_KEY_CHECKS = 1;
  `);
}

await conn.query(`
  CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(190) NOT NULL UNIQUE,
    name VARCHAR(80) NOT NULL,
    password_hash VARCHAR(120) NOT NULL,
    is_admin TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(60) NOT NULL,
    code VARCHAR(8) NOT NULL,
    flag VARCHAR(24) NOT NULL,
    group_letter CHAR(1) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS matches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    stage VARCHAR(12) NOT NULL,
    group_letter CHAR(1) NULL,
    matchday TINYINT NULL,
    round_name VARCHAR(40) NULL,
    home_team_id INT NULL,
    away_team_id INT NULL,
    home_label VARCHAR(40) NULL,
    away_label VARCHAR(40) NULL,
    kickoff DATETIME NULL,
    home_score INT NULL,
    away_score INT NULL,
    status VARCHAR(12) NOT NULL DEFAULT 'scheduled',
    external_id VARCHAR(40) NULL,
    ord INT NOT NULL DEFAULT 0,
    code VARCHAR(8) NULL,
    winner_team_id INT NULL,
    INDEX (stage),
    INDEX (group_letter)
  );

  CREATE TABLE IF NOT EXISTS predictions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    match_id INT NOT NULL,
    pred_home INT NOT NULL,
    pred_away INT NOT NULL,
    points INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_match (user_id, match_id),
    INDEX (match_id)
  );
`);
console.log("Tablas creadas.");

// ¿Ya hay datos cargados?
const [[{ n }]] = await conn.query("SELECT COUNT(*) AS n FROM teams");
if (n > 0) {
  console.log(`Ya hay ${n} equipos cargados. No se vuelve a sembrar (usa --reset para rehacer).`);
  await conn.end();
  process.exit(0);
}

// flag emoji a partir del codigo ISO de 2 letras (con excepciones regionales).
function flagEmoji(code) {
  if (code === "ENG") return "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}";
  if (code === "SCT") return "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}";
  return [...code.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

// Grupos oficiales (sorteo 5/12/2025). 4 equipos por grupo, en orden de posicion 1..4.
const GROUPS = {
  A: [["México", "MX"], ["Sudáfrica", "ZA"], ["Corea del Sur", "KR"], ["Chequia", "CZ"]],
  B: [["Canadá", "CA"], ["Qatar", "QA"], ["Suiza", "CH"], ["Bosnia y Herzegovina", "BA"]],
  C: [["Brasil", "BR"], ["Haití", "HT"], ["Escocia", "SCT"], ["Marruecos", "MA"]],
  D: [["Estados Unidos", "US"], ["Paraguay", "PY"], ["Australia", "AU"], ["Turquía", "TR"]],
  E: [["Alemania", "DE"], ["Costa de Marfil", "CI"], ["Ecuador", "EC"], ["Curazao", "CW"]],
  F: [["Países Bajos", "NL"], ["Japón", "JP"], ["Túnez", "TN"], ["Suecia", "SE"]],
  G: [["Bélgica", "BE"], ["Egipto", "EG"], ["Irán", "IR"], ["Nueva Zelanda", "NZ"]],
  H: [["España", "ES"], ["Cabo Verde", "CV"], ["Arabia Saudita", "SA"], ["Uruguay", "UY"]],
  I: [["Francia", "FR"], ["Senegal", "SN"], ["Irak", "IQ"], ["Noruega", "NO"]],
  J: [["Argentina", "AR"], ["Argelia", "DZ"], ["Austria", "AT"], ["Jordania", "JO"]],
  K: [["Portugal", "PT"], ["RD Congo", "CD"], ["Uzbekistán", "UZ"], ["Colombia", "CO"]],
  L: [["Inglaterra", "ENG"], ["Croacia", "HR"], ["Ghana", "GH"], ["Panamá", "PA"]],
};

// Insertar equipos y guardar sus ids por grupo.
const teamId = {}; // group -> [id1,id2,id3,id4]
for (const [g, list] of Object.entries(GROUPS)) {
  teamId[g] = [];
  for (const [name, code] of list) {
    const [res] = await conn.query(
      "INSERT INTO teams (name, code, flag, group_letter) VALUES (?,?,?,?)",
      [name, code, flagEmoji(code), g]
    );
    teamId[g].push(res.insertId);
  }
}
console.log("48 equipos insertados.");

// Round-robin estandar de FIFA para grupos de 4 (posiciones 1..4):
//   Fecha 1: 1-2, 3-4   |   Fecha 2: 1-3, 4-2   |   Fecha 3: 4-1, 2-3
const RR = [
  [[0, 1], [2, 3]],
  [[0, 2], [3, 1]],
  [[3, 0], [1, 2]],
];
// Ventanas de fecha aproximadas (la sync con la API corrige a los horarios reales).
const MD_DATE = { 1: "2026-06-13", 2: "2026-06-19", 3: "2026-06-25" };

let ord = 0;
const groupLetters = Object.keys(GROUPS);
for (let md = 1; md <= 3; md++) {
  for (const g of groupLetters) {
    for (const [hi, ai] of RR[md - 1]) {
      const home = teamId[g][hi];
      const away = teamId[g][ai];
      const kickoff = `${MD_DATE[md]} ${(13 + (ord % 4) * 2) % 24}:00:00`;
      await conn.query(
        `INSERT INTO matches (stage, group_letter, matchday, home_team_id, away_team_id, kickoff, ord)
         VALUES ('group', ?, ?, ?, ?, ?, ?)`,
        [g, md, home, away, kickoff, ord++]
      );
    }
  }
}
console.log("72 partidos de fase de grupos insertados.");

// Estructura de eliminatorias (cuadro oficial 2026). Se completa sola con los resultados.
const { KO_SEED } = await import("./ko-seed.mjs");
for (const [code, stage, round, hl, al] of KO_SEED) {
  await conn.query(
    `INSERT INTO matches (stage, round_name, code, home_label, away_label, ord)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [stage, round, code, hl, al, ord++]
  );
}
console.log("32 partidos de eliminatorias (cuadro oficial) insertados.");

await conn.end();
console.log("Listo ✅");
