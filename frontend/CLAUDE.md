# CLAUDE.md — frontend

Guía para Claude Code al trabajar en `frontend/` (esta carpeta se abre sola, sin el backend).

## Proyecto

Sistema de turnos para un CAPS (Centro de Atención Primaria de la Salud de Argentina). Es el **trabajo de tesis de una amiga** de Fabri; lo programa Fabri, desarrollador junior, paso a paso en "días" (sesiones). Uso **solo local** (una PC del CAPS, sin nube) y **datos siempre ficticios**.

El repositorio tiene dos paquetes npm independientes: este `frontend/` (React 19 + Vite + react-router 7, ESM, JavaScript sin TypeScript, puerto 5173) y `../backend/` (Express 5 + MariaDB, puerto 3001), que es la API que consume. Todo el código, identificadores, comentarios y textos de la interfaz están en **español rioplatense** (voseo: "Elegí", "Tenés"). Mantener eso en todo lo nuevo.

## Cómo trabajar con Fabri

- Hablarle en español rioplatense, simple y claro: es principiante. El porqué en una línea, no en párrafos.
- **Una rama por día**, siempre desde `develop` (el repo git está en la carpeta de arriba; los comandos funcionan igual desde acá):
  ```
  git checkout develop && git pull && git checkout -b feature/<nombre>
  # ...cambios y pruebas...
  git add . && git commit -m "feat: ..."
  git push -u origin feature/<nombre>
  git checkout develop && git merge feature/<nombre> && git push
  ```
  `main` recibe solo el merge final.
- **Las ramas, los commits, los pushes y los merges a `develop` los hace Claude** (Fabri dio permiso para usar GitHub, 20/11/2026): al terminar y probar una tarea, crear la rama `feature/<nombre>` (si no existe), commitear, pushear, mergear a `develop` y pushear. Fabri no tiene que tipear comandos de git. Lo único que se consulta antes: el merge a `main`, los tags y cualquier cosa destructiva (`reset --hard`, `push --force`, borrar ramas).
- **Git no está en el PATH**: es portable, en `D:\Descargas\PortableGit\cmd\git.exe`. Desde PowerShell: `& 'D:\Descargas\PortableGit\cmd\git.exe' status`. El repo está en la carpeta de arriba (`..`); remoto `origin` en GitHub.
- Cada tarea termina con: qué cambió, **pruebas paso a paso** (con qué usuario entrar y qué tocar, qué debería ver) y en qué rama y commit quedó.
- Probar antes de dar algo por terminado: `npm run lint`, `npm run build` y mirar la pantalla en computadora, tableta y celular.
- Si una pantalla necesita algo nuevo de la API, decirle a Fabri qué ruta o campo hay que agregar en el backend (no inventar respuestas).

## Reglas del proyecto que tocan a la interfaz

- **Nada se borra, solo se desactiva**: no hay botones de borrar médicos ni pacientes. Excepciones: especialidades que nadie usó (borrado real) y horarios ("Eliminar" = borrado lógico). Feriados: Editar + Desactivar/Reactivar. Licencias y horarios: Desactivar/Reactivar.
- Las pantallas de **Horarios y Turnos de la secretaría no muestran a nadie hasta que se busca** (nada preseleccionado). El Inicio de la secretaría muestra solo números y médicos, nunca nombres de pacientes.
- Recetas: llevan la marca "DOCUMENTO DEMOSTRATIVO – SIN VALIDEZ" (sin nota al pie). No se editan: se anulan.
- Una atención finalizada no se edita: las correcciones van como notas. La ficha clínica guarda una versión nueva por cada cambio.
- Privacidad: el médico ve solo a sus pacientes; la secretaría no ve recetas ni datos clínicos; el paciente ve solo lo suyo. El backend responde 404 a lo ajeno.

## Comandos

- `npm run dev` — Vite en el puerto 5173. Necesita el backend andando (`npm run dev` en `../backend`).
- `npm run build` — genera `dist/`. `npm run preview` para mirarlo.
- `npm run lint` — ESLint (config plana en `eslint.config.js`, con reglas de hooks de React).
- No hay pruebas automáticas en el frontend.
- URL de la API en `VITE_API_URL`; si no está, `http://localhost:3001/api` con `npm run dev` y `/api` en lo compilado (porque `dist/` lo sirve el mismo backend). Ojo: el `.gitignore` ignora `.env.*`, así que un `.env.production` no se subiría.
- Usuarios de prueba (los crea el backend con `npm run demo`): secretaria 11111111, médica 22222222, paciente 33333333, clave `demo1234`. Con `demo:completo` hay además 6 médicos (DNI 20100001–20100006) y 300 pacientes (30200001–30200300), misma clave.

## Arquitectura

- Las rutas por rol salen de datos: `src/menus.js` define el menú de cada rol (`secretaria`, `medico`, `paciente`) y `App.jsx` arma las rutas `/<rol>/<ruta>`, mapeando las claves `'rol/ruta'` de `PAGINAS` a componentes (lo que no está mapeado muestra `Proximamente`). `INICIOS` define el inicio propio de cada rol y `EXTRAS` las rutas fuera del menú (por ejemplo `medico/atencion/:turnoId`). **Para sumar una pantalla: entrada en el menú + mapeo en `PAGINAS`.**
- `pages/` son pantallas completas; `components/` son piezas reutilizables (buscadores, calendarios, formularios, `Layout` con el menú).
- Para mostrar algo en una ventana flotante usar `components/VentanaFlotante.jsx` (`<VentanaFlotante titulo onCerrar>`; usa `<dialog>` del navegador: Esc y tocar afuera la cierran, la página de atrás no se mueve; estilos `.ventana` en `index.css`). Se usa en Pacientes y Médicos de la secretaría: "Ver ficha" y los formularios de alta/edición (se abren con el botón de `.titulo-pagina`; si falla el guardado, el error se muestra dentro de la ventana y queda abierta).
- Tablas como tarjetas: en **tableta y celular (≤1023px)** las `.tabla` (menos `.grilla`) se apilan como tarjetas; en tableta (640–1023px) van de a dos por fila, y las `.dato-cards` también de a dos. `.solo-compu` = solo ≥1024px; `.solo-celu` = ≤1023px (tableta incluida). `menus.js` acepta `corto` para el nombre en la barra de abajo del celular.
- Celular (≤639px), clases de `index.css` para que las pantallas no queden largas:
  - `.tabla.numeros` + `data-etiqueta="Título"` en cada `<td>` numérico: en celular cada número va en una grilla de 4 columnas con su título encima (sin esto, las tablas apiladas muestran números sueltos sin saber qué son). `td.completa` ocupa todo el ancho.
  - `.dato-cards.compactas`: tarjetas de números de a dos (la principal y la última impar, a todo el ancho).
  - `td.en-linea-celu` (también en tableta): celdas una al lado de la otra; `.desliza`: fila de botones que se desliza de costado; `.filtros.de-a-dos`: filtros de a dos por fila.
- Para revisar cómo se ve en celular, Claude saca capturas con Edge sin ventana (`--headless`) por DevTools Protocol, entrando con los usuarios demo contra el backend en otro puerto (`PORT=3099 RECORDATORIOS=off`).
- Rutas públicas: `/login`, `/olvide`, `/restablecer`, `/cambiar-clave`, `/confirmar/:token`. `/receta/:id` (médico y paciente) va fuera del `Layout` para imprimir.
- `src/api/client.js` `apiFetch(ruta, opciones)` es la **única** entrada HTTP: agrega el JWT de `localStorage`, redirige a `/login` ante un 401 y a `/cambiar-clave` ante un 403 `CAMBIAR_CLAVE`, y lanza `Error` con `.codigo`/`.datos` a partir de las respuestas `{ error, codigo }` del backend. `api/errores.js` `mensajeDeError(err)` convierte fallas de conexión en un mensaje amable; usarlo en los `catch`.
- La sesión (`token`, `usuario`) vive en `localStorage` vía `src/auth.js`; `RutaProtegida` controla el acceso por rol (y manda a `/cambiar-clave` si hay clave temporal). Al cambiar la clave, el backend devuelve un token nuevo y `CambiarClave.jsx` lo guarda.
- Fechas: el backend manda y recibe textos `'AAAA-MM-DD'` y `'HH:MM'`/`'HH:MM:SS'`. Usar los ayudantes de `src/fechas.js` (`hoyISO`, `formatoFecha`, `diaDeSemana`, `edad`, `sumarDias`) en lugar de parsear con `new Date('AAAA-MM-DD')` (eso lo toma como UTC y corre el día).
- Estados de un turno: `pendiente → confirmado → en_atencion → atendido`, o `cancelado` / `ausente`; los textos para mostrar están en `src/estados.js`.
- Estilos en CSS plano (`index.css` y `receta.css` para la receta imprimible); íconos de `lucide-react`. Diseño final (Día 21): todo el aspecto en variables de `:root` en `index.css`, verde azulado `#0b6e79`, fuentes Inter y Plus Jakarta Sans (`@fontsource`, funcionan sin internet: no agregar fuentes ni librerías desde CDN). Computadora: menú lateral; tableta: barra arriba + menú desplegable; celular: barra inferior (4 secciones por rol + "Más") y tablas apiladas como tarjetas. Animaciones cortas, apagadas con `prefers-reduced-motion`.

## Estado

Días hechos (1–21), todos mergeados a `develop` y pusheados: 1–3 base, login y recuperación · 4 médicos · 5 horarios, licencias y feriados · 6 pacientes · 7 disponibilidad · 8 reservas + "nada se borra" · 9 portal del paciente · 10 el paciente saca turno + recordatorio por mail · 11 Mis turnos · 12 agenda del médico · 13 recetas · 14 inicio del médico + historial · 15 ficha clínica · 16 pantalla de atención · 17 reportes · 18 inicio de la secretaría + calendario semanal · 19 seguridad y prueba de permisos · 20 datos de ejemplo · 21 diseño final.

## Día 22 (instalación y cierre), rama `feature/instalacion`

- Hecho: el backend sirve `dist/` (un solo proceso en http://localhost:3001) y `api/client.js` usa `/api` cuando está compilado. `instalar.bat` (raíz del repo) corre `npm install` y `npm run build` acá. Si se cambia algo de la interfaz, hay que volver a compilar para que se vea en la versión instalada.
- `npm run lint` da 0 errores (rama `feature/limpieza`). Para no volver a romperlo: no llamar a `setState` directo dentro de un `useEffect`; limpiar el estado en el manejador que cambia la pantalla (ej. `cambiarFecha` en `AgendaMedico`, `irPagina` en `MisTurnos`) o derivarlo (ej. `abiertoEn` en `Layout`).
- Se borraron los restos de la plantilla de Vite (`App.css`, `assets/`, `public/icons.svg`).

## Decisiones abiertas

- **Colores de estados:** hoy "En atención" es verde y "Atendido" violeta (la amiga pidió "en verde los que va atendiendo"). El boceto de diseño los tenía al revés; falta que ella confirme. Se cambia en `:root` de `index.css`.
