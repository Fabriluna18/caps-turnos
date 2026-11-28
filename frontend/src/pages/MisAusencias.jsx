import Encabezado from '../components/Encabezado';
import Licencias from '../components/Licencias';

// El médico avisa los días que no va a atender (pedido de la ingeniera).
// Por dentro es una licencia, igual a las que carga la secretaría en Horarios.
export default function MisAusencias() {
  return (
    <>
      <Encabezado
        titulo="Mis ausencias"
        subtitulo="Si un día no vas a venir, avisalo acá: el sistema deja de dar turnos con vos esos días."
      />
      <Licencias propio />
    </>
  );
}
