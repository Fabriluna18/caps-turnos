# CLAUDE.md

Guía para Claude Code al trabajar en este repositorio.

## Proyecto

Sistema de turnos para un CAPS (Centro de Atención Primaria de la Salud de Argentina). Es el **trabajo de tesis de una amiga** de Fabri; lo programa Fabri, desarrollador junior, paso a paso en "días" (sesiones). Uso **solo local** (una PC del CAPS, sin nube) y **datos siempre ficticios**.

Dos paquetes npm independientes, sin `package.json` en la raíz: `backend/` (Express 5 + mysql2, CommonJS) y `frontend/` (React 19 + Vite + react-router 7, ESM). Todo el código, identificadores, comentarios, textos de la interfaz y mensajes de error de la API están en **español rioplatense** (voseo: "Elegí", "Tenés"). Mantener eso en todo lo nuevo.

## Cómo trabajar con Fabri

- Hablarle en español rioplatense, simple y claro: es principiante. El porqué en una línea, no en párrafos.
- **Una rama por día**, siempre desde `develop`:
  ```
  git checkout develop && git pull && git checkout -b feature/<nombre>
  # ...cambios y pruebas...
  git add . && git commit -m "feat: ..."
  git push -u origin feature/<nombre>
  git checkout develop && git merge feature/<nombre> && git push
  ```
  `main` recibe solo el merge final.
- **Las ramas, los commits, los pushes y los merges a `develop` los hace Claude** (Fabri dio permiso para usar GitHub, 20/11/2026): al terminar y probar una tarea, crear la rama `feature/<nombre>` (si no existe), commitear, pushear, mergear a `develop` y pushear. Fabri no tiene que tipear comandos de git. Lo único que se consulta antes: el merge a `main`, los tags y cualquier cosa destructiva (`reset --hard`, `push --force`, borrar ramas).
- **Git no está en el PATH**: es portable, en `D:\Descargas\PortableGit\cmd\git.exe`. Desde PowerShell: `& 'D:\Descargas\PortableGit\cmd\git.exe' status`. Remoto `origin` en GitHub.
- Cada tarea termina con: qué cambió, **pruebas paso a paso** (con qué usuario entrar y qué tocar, qué debería ver) y en qué rama y commit quedó.
- Probar antes de dar algo por terminado: `npm test`, `npm run probar:permisos` y, si se tocó la interfaz, mirarla en computadora, tableta y celular.
- Si hace falta un cambio en la base, agregarlo **al final** de `schema.sql` y decirle a Fabri que lo ejecute (en Workbench como `caps_app`; lo que necesite root, en phpMyAdmin).

## Reglas del proyecto (no romperlas)

- **Nada se borra de la base, solo se desactiva.** Las rutas DELETE de médicos y pacientes no existen. Excepciones: especialidades que nadie usó (borrado real) y horarios (botón "Eliminar" = borrado lógico `eliminado=1`).
- Además, la cuenta `caps_app` **no tiene permiso DELETE ni DROP** en la base (salvo DELETE en `especialidades`), por `backend/db/permisos.sql`. Para limpiar datos de prueba hay que usar phpMyAdmin (root).
- Feriados: Editar + Desactivar/Reactivar. Licencias y horarios: Desactivar/Reactivar.
- Las pantallas de **Horarios y Turnos de la secretaría no muestran a nadie hasta que se busca** (nada preseleccionado). El Inicio de la secretaría muestra solo números y médicos, nunca nombres de pacientes.
- Recetas: llevan la marca "DOCUMENTO DEMOSTRATIVO – SIN VALIDEZ" (sin nota al pie). No se editan: se anulan.
- Una atención finalizada no se edita: las correcciones van como notas. La ficha clínica guarda una versión nueva por cada cambio.
- Privacidad: el médico ve solo a sus pacientes (con algún turno no cancelado con él); la secretaría no ve recetas ni datos clínicos; el paciente ve solo lo suyo. A lo ajeno se responde 404, no 403.

## Comandos

Backend (`cd backend`):
- `npm run dev` — nodemon sobre `index.js` (puerto 3001). Necesita `backend/.env` (copiar `.env.example`); se cierra si falta `JWT_SECRET`.
- `npm test` — `node --test` (corre `tests/*.test.js`). Un archivo: `node --test tests/disponibilidad.test.js`. Una prueba: `node --test --test-name-pattern="<texto>"`.
- Datos (necesitan la base, no el servidor): `npm run demo` (secretaria 11111111, médica 22222222, paciente 33333333, clave `demo1234`), `demo:medicos`, `demo:pacientes`, `demo:completo` (6 médicos DNI 20100001–20100006, 300 pacientes 30200001–30200300, ~2.200 turnos de 6 meses con atenciones, recetas y fichas; solo agrega, no duplica, pacientes sin email).
- Pruebas de integración (necesitan el backend **andando** y los usuarios `demo`): `npm run probar:permisos` (todas las rutas con cada rol, 401/403; hoy da 189 de 189), `npm run probar:doble-reserva` (dos reservas simultáneas).

Frontend (`cd frontend`):
- `npm run dev` (puerto 5173), `npm run build`, `npm run lint` (ESLint). URL de la API en `VITE_API_URL`, por defecto `http://localhost:3001/api`.

Base de datos: **MariaDB 10.4.32 (XAMPP)**, base `caps_turnos`, usuario `caps_app`, collation `utf8mb4_unicode_ci`. El schema usa columnas generadas `PERSISTENT` y `ADD COLUMN IF NOT EXISTS`, que MySQL común no soporta. No hay migraciones: `backend/db/schema.sql` es un único script idempotente que creció día a día (secciones "Día N"); los cambios se agregan al final como `ALTER ... IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS` y se vuelve a correr a mano.

Variables del `.env`: `DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET, PORT, CORS_ORIGIN, FRONTEND_URL, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, RECORDATORIO_HORAS` (24 por defecto) y `RECORDATORIOS=off` para apagar los recordatorios.

## Arquitectura

### Backend
- `index.js` monta un router por archivo de `routes/` bajo `/api/...`, agrega cabeceras de seguridad (`nosniff`, `X-Frame-Options`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`), 404 y manejador de errores que no filtra detalles. El orden importa: los prefijos más específicos (`/api/paciente/turnos`, `/api/paciente/ficha`, `/api/medico/pacientes`, `/api/medico/atencion`) van antes que su padre (`/api/paciente`, `/api/medico`).
- Los routers están separados por rol. La autenticación va por router con `router.use(verificarToken, permitir('secretaria', ...))` de `middleware/auth.js`. `verificarToken` relee el usuario de la base en cada pedido y lo rechaza si está inactivo, si el `iat` del JWT es anterior a `usuarios.sesiones_desde` (cambiar la clave invalida las sesiones; ver `sesiones.js`) o con 403 `codigo: 'CAMBIAR_CLAVE'` si tiene clave temporal. Solo `/me` y `/cambiar-clave` usan `verificarTokenSinBloqueo`. **Al agregar una ruta, sumarla también a `scripts/probar-permisos.js`.**
- Login por DNI. `limite.js` es un freno de intentos en memoria (se reinicia con el servidor). Recuperación de clave por mail con token guardado como SHA-256, 60 minutos, un solo uso.
- Módulos de dominio en la raíz del backend, no en las rutas:
  - `calculo-turnos.js` — cálculo **puro** de horarios (`calcularDia`/`calcularMes`/`proximoLibre`) a partir de `{horarios, licencias, feriados, turnos}` y un `ahora` inyectado. Es lo que cubren las pruebas; mantenerlo sin base de datos.
  - `disponibilidad.js` — carga esos datos (solo lo activo y no eliminado) y llama a las funciones puras. Toda vista de disponibilidad (calendario, próximo libre, semana, reserva) pasa por acá, así siempre coinciden.
  - `reservas.js` — `reservarTurno` es el único camino para reservar: transacción + `SELECT ... FOR UPDATE` sobre el médico, revalida el horario con `disponibilidadDelDia`, controla que el paciente no tenga otro turno a la misma hora y convierte `ER_DUP_ENTRY` en 409. La doble reserva la frena en última instancia la clave única `uq_turnos_slot` sobre la columna generada `slot_ocupado` (NULL si está cancelado, así cancelar libera el horario). El paciente puede tener hasta 5 turnos vigentes.
  - `fechas.js` — todo lo de "ahora" usa `America/Argentina/Buenos_Aires`. El pool usa `dateStrings: true`: fechas y horas son textos (`'AAAA-MM-DD'`, `'HH:MM:SS'`) que se comparan como texto; no usar objetos `Date` de JS para valores de la base.
  - `recordatorios.js` — tarea node-cron (cada 5 min) que manda por mail el enlace de confirmación a los turnos pendientes dentro de la ventana; `confirmaciones.js` crea tokens de un uso guardados como hash, que consume `/api/confirmar` (GET muestra, POST confirma).
  - `fichas.js` (versiones de la ficha), `sesiones.js`, `clave.js` (claves temporales), `turnos-futuros.js` (bloquea bajas o cambios si hay turnos por delante).
  - `mailer.js` — sin variables SMTP, los mails se imprimen en la consola del backend en lugar de enviarse.
- Estados de un turno: `pendiente → confirmado → en_atencion → atendido`, o `cancelado` / `ausente`. Solo puede haber un paciente `en_atencion` por médico a la vez; `atendido` es final.
- Tablas: `usuarios` (+`sesiones_desde`), `especialidades`, `medicos`, `pacientes`, `recuperaciones`, `horarios`, `licencias`, `feriados`, `turnos` (+`recordatorio_enviado_en`), `confirmaciones`, `recetas`, `receta_items`, `fichas`, `atenciones` (una por turno), `atencion_notas`.

### Frontend
- Las rutas por rol salen de datos: `src/menus.js` define el menú de cada rol (`secretaria`, `medico`, `paciente`) y `App.jsx` arma las rutas `/<rol>/<ruta>`, mapeando las claves `'rol/ruta'` de `PAGINAS` a componentes (lo que no está mapeado muestra `Proximamente`). `INICIOS` define el inicio propio de cada rol y `EXTRAS` las rutas fuera del menú (por ejemplo `medico/atencion/:turnoId`). Para sumar una pantalla: entrada en el menú + mapeo en `PAGINAS`.
- Rutas públicas: `/login`, `/olvide`, `/restablecer`, `/cambiar-clave`, `/confirmar/:token`. `/receta/:id` (médico y paciente) va fuera del `Layout` para imprimir.
- `src/api/client.js` `apiFetch` es la única entrada HTTP: agrega el JWT de `localStorage`, redirige a `/login` ante un 401 y a `/cambiar-clave` ante un 403 `CAMBIAR_CLAVE`, y lanza `Error` con `.codigo`/`.datos` de las respuestas `{ error, codigo }`.
- La sesión (`token`, `usuario`) vive en `localStorage` vía `src/auth.js`; `RutaProtegida` controla el acceso por rol. Al cambiar la clave, el backend devuelve un token nuevo y `CambiarClave.jsx` lo guarda.
- Estilos en CSS plano (`index.css`, `App.css`, `receta.css` para la receta imprimible); íconos de `lucide-react`. Diseño final (Día 21): todo el aspecto en variables de `:root` en `index.css`, verde azulado `#0b6e79`, fuentes Inter y Plus Jakarta Sans (`@fontsource`, funcionan sin internet). Computadora: menú lateral; tableta: barra arriba + menú desplegable; celular: barra inferior (4 secciones por rol + "Más") y tablas apiladas como tarjetas. Animaciones cortas, apagadas con `prefers-reduced-motion`.

## Estado

Días hechos: 1–3 base, login y recuperación · 4 médicos · 5 horarios, licencias y feriados · 6 pacientes · 7 disponibilidad · 8 reservas + "nada se borra" · 9 portal del paciente · 10 el paciente saca turno + recordatorio por mail · 11 Mis turnos · 12 agenda del médico · 13 recetas · 14 inicio del médico + historial · 15 ficha clínica · 16 pantalla de atención · 17 reportes · 18 inicio de la secretaría + calendario semanal · 19 seguridad y prueba de permisos · 20 datos de ejemplo · 21 diseño final.

Primero, revisar con `git log --oneline` y `git status` que los días 19, 20 y 21 estén commiteados y mergeados a `develop` (Fabri no lo confirmó).

## Lo que falta: Día 22 (instalación y cierre)

En una PC nueva hay que instalar antes XAMPP (MySQL + phpMyAdmin + Apache), Node.js LTS y Git (o copiar la carpeta sin `node_modules` ni `.env`).

1. **Script de instalación** que cree la base, el usuario `caps_app` con sus permisos (sin DELETE/DROP salvo `especialidades`), corra `schema.sql` y cargue los datos (`demo` y, si se quiere, `demo:completo`).
2. **Arranque con doble clic** (`.bat` de Windows). Idea: compilar el frontend (`npm run build`) y que Express sirva `frontend/dist`, así corre un solo proceso. MySQL de XAMPP se inicia aparte.
3. **Copia de seguridad**: script con el `mysqldump` de XAMPP a una carpeta con la fecha.
4. **Gmail real**: cuenta dedicada + contraseña de aplicación → `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`. Probar recuperación de clave y recordatorio.
5. **Cambiar las claves de las cuentas demo** y poner un `JWT_SECRET` largo al instalar.
6. **README** con instalación y uso; merge final `develop` → `main` y tag de versión.

## Decisiones abiertas y notas

- **Colores de estados:** hoy "En atención" es verde y "Atendido" violeta (la amiga pidió "en verde los que va atendiendo"). El boceto de diseño los tenía al revés; falta que ella confirme. Se cambia en `:root` de `index.css`.
- No hay mínimo de anticipación para que el paciente cancele (puede hasta que empieza el turno). Un turno que nadie confirma no se cancela solo. WhatsApp no está hecho (solo mail).
- Quedan claves foráneas con `ON DELETE CASCADE` de los primeros días: no hacen daño porque la app no borra y `caps_app` no tiene DELETE.
- Límites para nombrar en la tesis: las recetas son solo demostrativas (la Ley 27.553 exige receta electrónica en plataformas registradas) y la historia clínica no cumple la Ley 27.706 (firma digital, entre otras cosas).