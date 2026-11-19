import {
  BarChart3, CalendarDays, CalendarPlus, ClipboardList, Clock, FileText, LayoutDashboard, Stethoscope, UserCircle, Users,
} from 'lucide-react';

// a: ruta dentro del rol ('' es el inicio). dia: cuándo se arma esa pantalla.
export const MENUS = {
  secretaria: [
    { a: '', texto: 'Inicio', icono: LayoutDashboard },
    { a: 'medicos', texto: 'Médicos', icono: Stethoscope, dia: 4 },
    { a: 'horarios', texto: 'Horarios', icono: Clock, dia: 5 },
    { a: 'pacientes', texto: 'Pacientes', icono: Users, dia: 6 },
    { a: 'turnos', texto: 'Turnos', icono: CalendarDays, dia: 8 },
    { a: 'reportes', texto: 'Reportes', icono: BarChart3 },
    { a: 'perfil', texto: 'Mi perfil', icono: UserCircle },
  ],
  medico: [
    { a: '', texto: 'Inicio', icono: LayoutDashboard },
    { a: 'agenda', texto: 'Agenda del día', icono: CalendarDays },
    { a: 'recetas', texto: 'Recetas', icono: FileText },
    { a: 'pacientes', texto: 'Pacientes', icono: Users },
    { a: 'perfil', texto: 'Mi perfil', icono: UserCircle },
  ],
  paciente: [
    { a: '', texto: 'Inicio', icono: LayoutDashboard },
    { a: 'medicos', texto: 'Médicos', icono: Stethoscope },
    { a: 'sacar-turno', texto: 'Sacar turno', icono: CalendarPlus },
    { a: 'mis-turnos', texto: 'Mis turnos', icono: CalendarDays },
    { a: 'mis-recetas', texto: 'Mis recetas', icono: FileText },
    { a: 'mi-ficha', texto: 'Mi ficha', icono: ClipboardList },
    { a: 'perfil', texto: 'Mi perfil', icono: UserCircle },
  ],
};