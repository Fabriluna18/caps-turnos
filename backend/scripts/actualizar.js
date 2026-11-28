// Actualización de una instalación que ya anda (la usa actualizar.bat, desde la carpeta NUEVA).
// 1. Pide la carpeta vieja (la que ya está instalada)
// 2. Copia de la vieja a la nueva: backend\.env (claves de la base, Gmail, etc.) y la carpeta copias\
// 3. Hace una copia de seguridad de la base, por las dudas
// 4. Aplica los cambios de la base (vuelve a correr db/schema.sql, que nunca borra ni repite nada)
// No pide la clave de root, no crea un .env nuevo, no cambia claves y no toca los datos.
// La carpeta vieja queda intacta: si algo falla, se sigue usando esa.
const fs = require('fs');
const path = require('path');
const readline = require('readline/promises');
const { spawnSync } = require('child_process');

const BACKEND = path.join(__dirname, '..');
const NUEVA = path.join(BACKEND, '..');

// Lee un .env como objeto { CLAVE: valor }
function leerEnv(texto) {
  const datos = {};
  for (const linea of texto.split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z_]+)\s*=(.*)$/);
    if (m) datos[m[1]] = m[2].trim();
  }
  return datos;
}

// Al arrastrar una carpeta a la ventana, Windows la pega entre comillas
const limpiarRuta = (texto) => texto.trim().replace(/^["']|["']$/g, '').replace(/[\\/]+$/, '');

async function pedirCarpetaVieja(rl) {
  for (;;) {
    console.log('\nArrastrá a esta ventana la carpeta donde está instalado el sistema hoy');
    console.log('(la que tiene iniciar.bat y la carpeta backend) y apretá Enter.');
    const texto = limpiarRuta(await rl.question('Carpeta vieja: '));
    if (!texto) continue;
    const vieja = path.resolve(texto);
    if (vieja.toLowerCase() === path.resolve(NUEVA).toLowerCase()) {
      console.log('✘ Esa es la carpeta nueva (donde estás ahora). Arrastrá la VIEJA, la que ya usaban.');
      continue;
    }
    if (!fs.existsSync(path.join(vieja, 'backend', '.env'))) {
      console.log(`✘ En "${vieja}" no encuentro backend\\.env. ¿Es la carpeta donde está instalado? Probá de nuevo.`);
      continue;
    }
    return vieja;
  }
}

function correrScript(nombre) {
  const r = spawnSync(process.execPath, [path.join(__dirname, nombre)], { cwd: BACKEND, stdio: 'inherit' });
  return r.status === 0;
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('\n=== Actualización de CAPS Turnos ===');
  console.log(`Carpeta nueva: ${NUEVA}`);

  const vieja = await pedirCarpetaVieja(rl);
  rl.close();

  // --- 2. El .env y las copias de seguridad viejas ---
  const envViejo = path.join(vieja, 'backend', '.env');
  const envNuevo = path.join(BACKEND, '.env');
  fs.copyFileSync(envViejo, envNuevo);
  console.log('✔ Configuración copiada (backend\\.env): se siguen usando las mismas claves');

  const copiasViejas = path.join(vieja, 'copias');
  if (fs.existsSync(copiasViejas)) {
    fs.cpSync(copiasViejas, path.join(NUEVA, 'copias'), { recursive: true, force: false, errorOnExist: false });
    console.log('✔ Copias de seguridad anteriores copiadas (carpeta copias)');
  }

  // --- 3. Copia de seguridad de la base ---
  console.log('\nHaciendo una copia de seguridad de la base, por las dudas...');
  if (!correrScript('copia-seguridad.js')) {
    throw new Error('No se pudo hacer la copia de seguridad. ¿Está prendido MySQL en el panel de XAMPP? No se cambió nada en la base.');
  }

  // --- 4. Cambios de la base (como caps_app, sin root) ---
  require('dotenv').config({ path: envNuevo, quiet: true });
  const env = leerEnv(fs.readFileSync(envNuevo, 'utf8'));
  const mysql = require('mysql2/promise');
  let conexion;
  try {
    conexion = await mysql.createConnection({
      host: env.DB_HOST || '127.0.0.1',
      port: Number(env.DB_PORT || 3306),
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
      multipleStatements: true,
      charset: 'utf8mb4',
    });
  } catch (error) {
    throw new Error(`No me pude conectar a la base con los datos del .env (${error.code}). ¿Está prendido MySQL en XAMPP?`);
  }
  try {
    await conexion.query(fs.readFileSync(path.join(BACKEND, 'db', 'schema.sql'), 'utf8'));
  } catch (error) {
    throw new Error(`No se pudieron aplicar los cambios de la base: ${error.message}`);
  } finally {
    await conexion.end();
  }
  console.log('✔ Base de datos al día (los datos no se tocaron)');
  console.log(`\nLa carpeta vieja quedó intacta: ${vieja}`);
}

main().catch((error) => {
  console.error(`\n✘ ${error.message}\n`);
  console.error('La carpeta vieja no se tocó: pueden seguir usándola con su iniciar.bat.');
  process.exit(1);
});
