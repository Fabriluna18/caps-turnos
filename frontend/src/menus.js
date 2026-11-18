import {
  BarChart3, CalendarDays, CalendarPlus, Clock, FileText, LayoutDashboard, Stethoscope, UserCircle, Users,
} from 'lucide-react';

// a: ruta dentro del rol ('' es el inicio). dia: cuándo se arma esa pantalla.
export const MENUS = {
  secretaria: [
    { a: '', texto: 'Inicio', icono: LayoutDashboard },
    { a: 'medicos', texto: 'Médicos', icono: Stethoscope, dia: 4 },
    { a: 'horarios', texto: 'Horarios', icono: Clock, dia: 5 },
    { a: 'pacientes', texto: 'Pacientes', icono: Users, dia: 6 },
    { a: 'turnos', texto: 'Turnos', icono: CalendarDays, dia: 8 },
    { a: 'reportes', texto: 'Reportes', icono: BarChart3, dia: 17 },
    { a: 'perfil', texto: 'Mi perfil', icono: UserCircle },
  ],
  medico: [
    { a: '', texto: 'Inicio', icono: LayoutDashboard },
    { a: 'agenda', texto: 'Agenda del día', icono: CalendarDays, dia: 12 },
    { a: 'recetas', texto: 'Recetas', icono: FileText, dia: 13 },
    { a: 'pacientes', texto: 'Pacientes', icono: Users, dia: 15 },
    { a: 'perfil', texto: 'Mi perfil', icono: UserCircle },
  ],
  paciente: [
    { a: '', texto: 'Inicio', icono: LayoutDashboard },
    { a: 'medicos', texto: 'Médicos', icono: Stethoscope },
    { a: 'sacar-turno', texto: 'Sacar turno', icono: CalendarPlus, dia: 10 },
    { a: 'mis-turnos', texto: 'Mis turnos', icono: CalendarDays, dia: 11 },
    { a: 'mis-recetas', texto: 'Mis recetas', icono: FileText, dia: 13 },
    { a: 'perfil', texto: 'Mi perfil', icono: UserCircle },
  ],
};