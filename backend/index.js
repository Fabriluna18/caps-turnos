require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const authRoutes = require('./routes/auth');
const especialidadRoutes = require('./routes/especialidades');
const medicoRoutes = require('./routes/medicos');
const horarioRoutes = require('./routes/horarios');
const pacientesRoutes = require('./routes/pacientes');
const disponibilidadRoutes = require('./routes/disponibilidad');
const turnoRoutes = require('./routes/turnos');
const portalPacienteRoutes = require('./routes/paciente');
const pacienteTurnosRoutes = require('./routes/paciente-turnos');
const confirmarRoutes = require('./routes/confirmar');
const medicoPortalRoutes = require('./routes/medico');
const perfilRoutes = require('./routes/perfil');
const { iniciarRecordatorios } = require('./recordatorios');

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
app.use('/api/pacientes', pacientesRoutes);
app.use('/api/disponibilidad', disponibilidadRoutes);
app.use('/api/turnos', turnoRoutes);
// Los turnos del paciente van ANTES que el resto de /api/paciente
app.use('/api/paciente/turnos', pacienteTurnosRoutes);
app.use('/api/paciente', portalPacienteRoutes);
app.use('/api/confirmar', confirmarRoutes);
app.use('/api/medico', medicoPortalRoutes);
app.use('/api/perfil', perfilRoutes);

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

app.use((req, res) => res.status(404).json({ error: 'No encontrado' }));

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Los datos enviados no son válidos' });
  console.error(err);
  res.status(500).json({ error: 'Error del servidor' });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  iniciarRecordatorios();
});
