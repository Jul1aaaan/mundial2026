// Genera el hash bcrypt de una contraseña, para pegar en el panel SQL de TiDB.
// Uso:  node scripts/hash.mjs "MiContraseña"
import bcrypt from "bcryptjs";

const pass = process.argv[2];
if (!pass) {
  console.error('Uso: node scripts/hash.mjs "tu-contraseña"');
  process.exit(1);
}
console.log(bcrypt.hashSync(pass, 10));
