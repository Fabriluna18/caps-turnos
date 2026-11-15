import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import RutaProtegida from './components/RutaProtegida';
import { MENUS } from './menus';
import CambiarClave from './pages/CambiarClave';
import Inicio from './pages/Inicio';
import Login from './pages/Login';
import Medicos from './pages/Medicos';
import Olvide from './pages/Olvide';
import Proximamente from './pages/Proximamente';
import Restablecer from './pages/Restablecer';
import Horarios from './pages/Horarios';
import Pacientes from './pages/Pacientes';

// Pantallas ya armadas: 'rol/ruta' -> componente
const PAGINAS = {
  'secretaria/medicos': Medicos,
  'secretaria/horarios': Horarios,
  'secretaria/pacientes': Pacientes,
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/olvide" element={<Olvide />} />
        <Route path="/restablecer" element={<Restablecer />} />
        <Route path="/cambiar-clave" element={<CambiarClave />} />

        {Object.entries(MENUS).map(([rol, opciones]) => (
          <Route
            key={rol}
            path={`/${rol}`}
            element={<RutaProtegida roles={[rol]}><Layout /></RutaProtegida>}
          >
            <Route index element={<Inicio />} />
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
          </Route>
        ))}

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}