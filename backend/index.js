require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const authRoutes = require('./routes/auth');
const especialidadRoutes = require('./routes/especialidades');
const medicoRoutes = require('./routes/medicos');
const horarioRoutes = require('./routes/horarios');
const pacienteRoutes = require('./routes/pacientes');
const disponibilidadRoutes = require('./routes/disponibilidad');
const turnoRoutes = require('./routes/turnos');

if (!process.env.JWT_SECRET) {
  console.error('Falta JWT_SECRET en el archivo .env');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
const PORT = process.env.PORT || 3001;
const origenes = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',');

app.use(cors({ origin: origenes }));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ mensaje: 'API de CAPS Turnos funcionando' });
});

app.use('/api/auth', authRoutes);

app.use('/api/especialidades', especialidadRoutes);
app.use('/api/medicos', medicoRoutes);
app.use('/api/horarios', horarioRoutes);
app.use('/api/pacientes', pacienteRoutes);
app.use('/api/disponibilidad', disponibilidadRoutes);
app.use('/api/turnos', turnoRoutes);

// Ruta de prueba de la conexión (la sacamos antes de publicar)
app.get('/db-test', async (req, res) => {
  try {
    const [filas] = await pool.query('SELECT NOW() AS ahora, VERSION() AS version');
    res.json({ conectado: true, ...filas[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ conectado: false, error: error.code || error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

// Rutas que no existen
app.use((req, res) => {
  res.status(404).json({ error: 'No encontrado' });
});

// Errores generales: nunca se muestra el detalle interno al navegador
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El pedido no tiene un formato válido' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'El pedido es demasiado grande' });
  }
  console.error(err);
  res.status(500).json({ error: 'Error del servidor' });
});