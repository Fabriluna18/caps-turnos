import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import RutaProtegida from './components/RutaProtegida';
import { MENUS } from './menus';
import AgendaMedico from './pages/AgendaMedico';
import Atencion from './pages/Atencion';
import CambiarClave from './pages/CambiarClave';
import Confirmar from './pages/Confirmar';
import Horarios from './pages/Horarios';
import Inicio from './pages/Inicio';
import InicioMedico from './pages/InicioMedico';
import InicioPaciente from './pages/InicioPaciente';
import InicioSecretaria from './pages/InicioSecretaria';
import Login from './pages/Login';
import Medicos from './pages/Medicos';
import MiFicha from './pages/MiFicha';
import MisTurnos from './pages/MisTurnos';
import MedicosPaciente from './pages/MedicosPaciente';
import Olvide from './pages/Olvide';
import Pacientes from './pages/Pacientes';
import PacientesMedico from './pages/PacientesMedico';
import Perfil from './pages/Perfil';
import Proximamente from './pages/Proximamente';
import RecetaVer from './pages/RecetaVer';
import Recetas from './pages/Recetas';
import Reportes from './pages/Reportes';
import Restablecer from './pages/Restablecer';
import SacarTurnoPaciente from './pages/SacarTurnoPaciente';
import Turnos from './pages/Turnos';

// Pantallas ya armadas: 'rol/ruta' -> componente
const PAGINAS = {
  'secretaria/medicos': Medicos,
  'secretaria/horarios': Horarios,
  'secretaria/pacientes': Pacientes,
  'secretaria/turnos': Turnos,
  'secretaria/reportes': Reportes,
  'secretaria/perfil': Perfil,
  'medico/agenda': AgendaMedico,
  'medico/recetas': Recetas,
  'medico/pacientes': PacientesMedico,
  'medico/perfil': Perfil,
  'paciente/medicos': MedicosPaciente,
  'paciente/sacar-turno': SacarTurnoPaciente,
  'paciente/mis-turnos': MisTurnos,
  'paciente/mis-recetas': Recetas,
  'paciente/mi-ficha': MiFicha,
  'paciente/perfil': Perfil,
};

// Pantalla de inicio propia de cada rol (si no hay, se usa la genérica)
// Pantallas que no están en el menú (se llega desde otra)
const EXTRAS = { medico: [{ ruta: 'atencion/:turnoId', Pagina: Atencion }] };

const INICIOS = { secretaria: InicioSecretaria, medico: InicioMedico, paciente: InicioPaciente };

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/olvide" element={<Olvide />} />
        <Route path="/restablecer" element={<Restablecer />} />
        <Route path="/cambiar-clave" element={<CambiarClave />} />
        <Route path="/confirmar/:token" element={<Confirmar />} />
        <Route
          path="/receta/:id"
          element={<RutaProtegida roles={['medico', 'paciente']}><RecetaVer /></RutaProtegida>}
        />

        {Object.entries(MENUS).map(([rol, opciones]) => {
          const Portada = INICIOS[rol] || Inicio;
          return (
            <Route
              key={rol}
              path={`/${rol}`}
              element={<RutaProtegida roles={[rol]}><Layout /></RutaProtegida>}
            >
              <Route index element={<Portada />} />
              {opciones.filter((o) => o.a).map((o) => {
                const Pagina = PAGINAS[`${rol}/${o.a}`];
                return (
                  <Route
                    key={o.a}
                    path={o.a}
                    element={Pagina ? <Pagina /> : <Proximamente titulo={o.texto} dia={o.dia} />}
                  />
                );
              })}
              {(EXTRAS[rol] || []).map(({ ruta, Pagina }) => (
                <Route key={ruta} path={ruta} element={<Pagina />} />
              ))}
            </Route>
          );
        })}

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}