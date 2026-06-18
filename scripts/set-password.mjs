// Cambia la contraseña de un usuario directamente en la base (sin tocar el panel SQL).
// Uso:  node --env-file=.env.local scripts/set-password.mjs "email@ejemplo.com" "NuevaClave"
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

const [email, pass] = process.argv.slice(2);
if (!email || !pass) {
  console.error('Uso: node --env-file=.env.local scripts/set-password.mjs "email" "clave"');
  process.exit(1);
}

const c = await mysql.createConnection({
  host: process.env.TIDB_HOST,
  port: Number(process.env.TIDB_PORT ?? 4000),
  user: process.env.TIDB_USER,
  password: process.env.TIDB_PASSWORD,
  database: process.env.TIDB_DATABASE,
  ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
});

const hash = bcrypt.hashSync(pass, 10);
const [r] = await c.query("UPDATE users SET password_hash = ? WHERE email = ?", [
  hash,
  email.trim().toLowerCase(),
]);
console.log(
  r.affectedRows
    ? `OK ✅ Contraseña de ${email} actualizada. Ya puede entrar con: ${pass}`
    : `No se encontró el email "${email}". Revisá con: SELECT email FROM users;`
);
await c.end();
