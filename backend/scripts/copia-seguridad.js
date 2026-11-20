// Copia de seguridad de la base con el mysqldump de XAMPP.
// Guarda un archivo .sql con la fecha en la carpeta "copias" (al lado de backend y frontend).
// Uso: "npm run copia" (o doble clic en copia-seguridad.bat). No hace falta que el sistema esté andando,
// pero sí el MySQL de XAMPP.
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ahora } = require('../fechas');

// Se puede cambiar en el .env si XAMPP está instalado en otro lado
const MYSQLDUMP = process.env.MYSQLDUMP || 'C:\\xampp\\mysql\\bin\\mysqldump.exe';
const CARPETA = path.join(__dirname, '..', '..', 'copias');

function main() {
  if (!fs.existsSync(MYSQLDUMP)) {
    console.error(`✘ No encuentro mysqldump en ${MYSQLDUMP}. Si XAMPP está en otra carpeta, poné MYSQLDUMP=<ruta> en el .env`);
    process.exit(1);
  }
  fs.mkdirSync(CARPETA, { recursive: true });

  const { fecha, minutos } = ahora();
  const hora = `${String(Math.floor(minutos / 60)).padStart(2, '0')}-${String(minutos % 60).padStart(2, '0')}`;
  const archivo = path.join(CARPETA, `${process.env.DB_NAME}_${fecha}_${hora}.sql`);

  const r = spawnSync(
    MYSQLDUMP,
    [
      `--host=${process.env.DB_HOST}`,
      `--port=${process.env.DB_PORT}`,
      `--user=${process.env.DB_USER}`,
      '--single-transaction', // copia consistente sin frenar el sistema
      '--default-character-set=utf8mb4',
      '--no-tablespaces',
      `--result-file=${archivo}`,
      process.env.DB_NAME,
    ],
    // La clave va por variable de entorno para que no quede a la vista en la lista de procesos
    { env: { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD }, stdio: ['ignore', 'inherit', 'inherit'] }
  );

  if (r.status !== 0) {
    console.error('✘ La copia falló. ¿Está prendido MySQL en el panel de XAMPP?');
    process.exit(1);
  }
  const kb = Math.round(fs.statSync(archivo).size / 1024);
  console.log(`✔ Copia guardada: ${archivo} (${kb} KB)`);
}

main();
