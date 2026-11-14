import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import RutaProtegida from './components/RutaProtegida';
import { MENUS } from './menus';
import CambiarClave from './pages/CambiarClave';
import Inicio from './pages/Inicio';
import Login from './pages/Login';
import Olvide from './pages/Olvide';
import Proximamente from './pages/Proximamente';
import Restablecer from './pages/Restablecer';

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
            {opciones.filter((o) => o.a).map((o) => (
              <Route key={o.a} path={o.a} element={<Proximamente titulo={o.texto} dia={o.dia} />} />
            ))}
          </Route>
        ))}

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}