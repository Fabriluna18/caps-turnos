# CLAUDE.md — backend

Guía para Claude Code al trabajar en `backend/` (esta carpeta se abre sola, sin el frontend).

## Proyecto

Sistema de turnos para un CAPS (Centro de Atención Primaria de la Salud de Argentina). Es el **trabajo de tesis de una amiga** de Fabri; lo programa Fabri, desarrollador junior, paso a paso en "días" (sesiones). Uso **solo local** (una PC del CAPS, sin nube) y **datos siempre ficticios**.

El repositorio tiene dos paquetes npm independientes: este `backend/` (Express 5 + mysql2, CommonJS, puerto 3001) y `../frontend/` (React 19 + Vite, puerto 5173), que consume esta API. Todo el código, identificadores, comentarios y mensajes de error están en **español rioplatense** (voseo: "Elegí", "Tenés"). Mantener eso en todo lo nuevo.

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
  `main` recibe solo el merge final. No commitear ni pushear sin que Fabri lo pida.
- **Git no está en el PATH**: es portable, en `D:\Descargas\PortableGit\cmd\git.exe`. Desde PowerShell: `& 'D:\Descargas\PortableGit\cmd\git.exe' status`. El repo está en la carpeta de arriba (`..`); remoto `origin` en GitHub.
- Cada tarea termina con: qué cambió, **pruebas paso a paso** (con qué usuario entrar y qué tocar, qué debería ver) y los comandos de commit y merge.
- Probar antes de dar algo por terminado: `npm test` y `npm run probar:permisos`.
- Si hace falta un cambio en la base, agregarlo **al final** de `db/schema.sql` y decirle a Fabri que lo ejecute (en Workbench como `caps_app`; lo que necesite root, en phpMyAdmin).
- Si un cambio de la API afecta al frontend (rutas, nombres de campos, códigos de error), avisarle a Fabri qué hay que tocar del otro lado.

## Reglas del proyecto (no romperlas)

- **Nada se borra de la base, solo se desactiva.** Las rutas DELETE de médicos y pacientes no existen. Excepciones: especialidades que nadie usó (borrado real) y horarios (botón "Eliminar" = borrado lógico `eliminado=1`).
- La cuenta `caps_app` **no tiene permiso DELETE ni DROP** en la base (salvo DELETE en `especialidades`), según `db/permisos.sql` (sí tiene CREATE/ALTER/INDEX, por eso puede correr `schema.sql`). Para limpiar datos de prueba hay que usar phpMyAdmin (root).
- Feriados: editar + desactivar/reactivar. Licencias y horarios: desactivar/reactivar.
- Recetas: no se editan, se anulan (`anulada`).
- Una atención finalizada no se edita: las correcciones van como notas (`atencion_notas`). La ficha clínica guarda una versión nueva por cada cambio (la última es la actual).
- Privacidad: el médico ve solo a sus pacientes (con algún turno no cancelado con él); la secretaría no ve recetas ni datos clínicos; el paciente ve solo lo suyo. A lo ajeno se responde **404, no 403**.
- El resumen de inicio de la secretaría devuelve solo números y médicos, nunca nombres de pacientes.

## Comandos

- `npm run dev` — nodemon sobre `index.js`. Necesita `.env` (copiar `.env.example`); se cierra si falta `JWT_SECRET`.
- `npm test` — `node --test` (corre `tests/*.test.js`). Un archivo: `node --test tests/disponibilidad.test.js`. Una prueba: `node --test --test-name-pattern="<texto>"`.
- Datos (necesitan la base, no el servidor): `npm run demo` (secretaria 11111111, médica 22222222, paciente 33333333, clave `demo1234`), `demo:medicos`, `demo:pacientes`, `demo:completo` (6 médicos DNI 20100001–20100006, 300 pacientes 30200001–30200300, ~2.200 turnos de 6 meses con atenciones, recetas y fichas; solo agrega, no duplica, pacientes sin email).
- Pruebas de integración (necesitan el servidor **andando** y los usuarios `demo`): `npm run probar:permisos` (todas las rutas con cada rol, 401/403; hoy da 189 de 189; `API_URL` cambia a qué servidor apunta), `npm run probar:doble-reserva` (dos reservas simultáneas).
- Instalación (Día 22): `npm run instalar` (`scripts/instalar.js`, interactivo, como root de MySQL: crea `.env` si falta, base, `schema.sql`, usuario `caps_app` + `permisos.sql`, datos demo; se puede repetir). `npm run copia` (`scripts/copia-seguridad.js`: `mysqldump` de XAMPP a `../copias/`, carpeta ignorada por git). Los `.bat` de doble clic (`instalar.bat`, `iniciar.bat`, `copia-seguridad.bat`) están en la raíz del repo, con finales de línea CRLF y textos sin tildes; usar `call npm ...` dentro de ellos.

Base de datos: **MariaDB 10.4.32 (XAMPP)**, base `caps_turnos`, usuario `caps_app`, collation `utf8mb4_unicode_ci`. El schema usa columnas generadas `PERSISTENT` y `ADD COLUMN IF NOT EXISTS`, que MySQL común no soporta. No hay migraciones: `db/schema.sql` es un único script idempotente que creció día a día (secciones "Día N"); los cambios se agregan al final como `ALTER ... IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS` y se vuelve a correr a mano.

Variables del `.env`: `DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET, PORT, CORS_ORIGIN, FRONTEND_URL, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, RECORDATORIO_HORAS` (24 por defecto), `RECORDATORIOS=off` para apagar los recordatorios y `MYSQLDUMP` (ruta, si XAMPP no está en `C:\xampp`). `CORS_ORIGIN` acepta varios orígenes separados por coma. `FRONTEND_URL` arma los enlaces de los mails: `http://localhost:5173` en desarrollo, `http://localhost:3001` instalado.

## Arquitectura

- `index.js` monta un router por archivo de `routes/` bajo `/api/...`, agrega cabeceras de seguridad (`nosniff`, `X-Frame-Options`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`), 404 y manejador de errores que no filtra detalles. Si existe `../frontend/dist/index.html`, además sirve el frontend compilado (un solo proceso): archivos estáticos + `index.html` para los GET que no son `/api` y que piden `text/html` (así lo demás sigue dando el 404 JSON, que `probar:permisos` controla); si no existe, `GET /` responde el JSON "API funcionando". El orden importa: los prefijos más específicos (`/api/paciente/turnos`, `/api/paciente/ficha`, `/api/medico/pacientes`, `/api/medico/atencion`) van antes que su padre (`/api/paciente`, `/api/medico`).
- Los errores se responden como `{ error: 'mensaje para mostrar', codigo?: 'CODIGO' }`; el frontend muestra `error` tal cual y reacciona a `codigo` (`CAMBIAR_CLAVE`, `SESION_INVALIDA`).
- Los routers están separados por rol. La autenticación va por router con `router.use(verificarToken, permitir('secretaria', ...))` de `middleware/auth.js`. `verificarToken` relee el usuario de la base en cada pedido y lo rechaza si está inactivo, si el `iat` del JWT es anterior a `usuarios.sesiones_desde` (cambiar la clave invalida las sesiones; ver `sesiones.js`) o con 403 `codigo: 'CAMBIAR_CLAVE'` si tiene clave temporal. Solo `/me` y `/cambiar-clave` usan `verificarTokenSinBloqueo`. **Al agregar una ruta, sumarla también a `scripts/probar-permisos.js`.**
- Login por DNI. `limite.js` es un freno de intentos en memoria (5 fallos = 15 min; se reinicia con el servidor). Recuperación de clave por mail con token guardado como SHA-256, 60 minutos, un solo uso. Al cambiar la clave se devuelve un token nuevo.
- Módulos de dominio en la raíz de `backend/`, no en las rutas:
  - `calculo-turnos.js` — cálculo **puro** de horarios (`calcularDia`/`calcularMes`/`proximoLibre`) a partir de `{horarios, licencias, feriados, turnos}` y un `ahora` inyectado. Es lo que cubren las pruebas; mantenerlo sin base de datos. Máximo 60 días de anticipación.
  - `disponibilidad.js` — carga esos datos (solo lo activo y no eliminado) y llama a las funciones puras. Toda vista de disponibilidad (calendario, próximo libre, semana, reserva) pasa por acá, así siempre coinciden.
  - `reservas.js` — `reservarTurno` es el único camino para reservar: transacción + `SELECT ... FOR UPDATE` sobre el médico, revalida el horario con `disponibilidadDelDia`, controla que el paciente no tenga otro turno a la misma hora y convierte `ER_DUP_ENTRY` en 409. La doble reserva la frena en última instancia la clave única `uq_turnos_slot` sobre la columna generada `slot_ocupado` (NULL si está cancelado, así cancelar libera el horario). El paciente puede tener hasta 5 turnos vigentes.
  - `fechas.js` — todo lo de "ahora" usa `America/Argentina/Buenos_Aires`. El pool (`db.js`) usa `dateStrings: true`: fechas y horas son textos (`'AAAA-MM-DD'`, `'HH:MM:SS'`) que se comparan como texto; no usar objetos `Date` de JS para valores de la base.
  - `recordatorios.js` — tarea node-cron (cada 5 min) que manda por mail el enlace de confirmación a los turnos pendientes dentro de la ventana; marca `recordatorio_enviado_en` antes de enviar para no mandar dos. `confirmaciones.js` crea tokens de un uso guardados como hash, que consume `/api/confirmar` (GET muestra, POST confirma).
  - `fichas.js` (versiones de la ficha), `sesiones.js`, `clave.js` (claves temporales), `turnos-futuros.js` (bloquea bajas o cambios si hay turnos por delante).
  - `mailer.js` — sin variables SMTP, los mails se imprimen en la consola en lugar de enviarse.
- Estados de un turno: `pendiente → confirmado → en_atencion → atendido`, o `cancelado` / `ausente`. Solo puede haber un paciente `en_atencion` por médico a la vez; `atendido` es final.
- Tablas: `usuarios` (+`sesiones_desde`), `especialidades`, `medicos`, `pacientes`, `recuperaciones`, `horarios`, `licencias`, `feriados`, `turnos` (+`recordatorio_enviado_en`), `confirmaciones`, `recetas`, `receta_items`, `fichas`, `atenciones` (una por turno), `atencion_notas`.

## Estado

Días hechos (1–21), todos mergeados a `develop` y pusheados: 1–3 base, login y recuperación · 4 médicos · 5 horarios, licencias y feriados · 6 pacientes · 7 disponibilidad · 8 reservas + "nada se borra" · 9 portal del paciente · 10 el paciente saca turno + recordatorio por mail · 11 Mis turnos · 12 agenda del médico · 13 recetas · 14 inicio del médico + historial · 15 ficha clínica · 16 pantalla de atención · 17 reportes · 18 inicio de la secretaría + calendario semanal · 19 seguridad y prueba de permisos · 20 datos de ejemplo · 21 diseño final.

## Día 22 (instalación y cierre), rama `feature/instalacion`

Hecho: `db/permisos.sql` (igual a los permisos que tenía `caps_app`), `scripts/instalar.js` (también genera `JWT_SECRET` largo y, si es la instalación definitiva, marca todas las cuentas con `debe_cambiar_clave`), `scripts/copia-seguridad.js`, el backend sirve `frontend/dist`, los tres `.bat`, `.env.example` con la guía de Gmail y el README de la raíz.

Falta:
- Que Fabri pruebe `instalar.bat` de punta a punta (ideal en una PC limpia o en otra carpeta) y `iniciar.bat`.
- Configurar Gmail real en el `.env` y probar recuperación de clave y recordatorio.
- Merge final `develop` → `main` y tag de versión (`v1.0.0`).

## Decisiones abiertas y notas

- No hay mínimo de anticipación para que el paciente cancele (puede hasta que empieza el turno). Un turno que nadie confirma no se cancela solo. WhatsApp no está hecho (solo mail).
- Quedan claves foráneas con `ON DELETE CASCADE` de los primeros días: no hacen daño porque la app no borra y `caps_app` no tiene DELETE.
- Límites para nombrar en la tesis: las recetas son solo demostrativas (la Ley 27.553 exige receta electrónica en plataformas registradas) y la historia clínica no cumple la Ley 27.706 (firma digital, entre otras cosas).
