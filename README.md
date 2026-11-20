# CAPS Turnos

Sistema de turnos para un Centro de Atención Primaria de la Salud (CAPS): la secretaría organiza médicos, horarios y turnos; el médico atiende, hace recetas y lleva la ficha clínica; el paciente saca y confirma sus turnos.

Trabajo de tesis. Funciona **solo en una PC local** (sin nube) y todos los datos de ejemplo son **ficticios**.

- **Backend:** Node.js + Express 5, base MariaDB (la de XAMPP). Carpeta `backend/`.
- **Frontend:** React 19 + Vite. Carpeta `frontend/`.

## Instalación en una PC nueva

1. Instalar:
   - **XAMPP** (https://www.apachefriends.org), con MySQL.
   - **Node.js LTS** (https://nodejs.org).
   - **Git**, si se va a bajar el proyecto desde GitHub (si no, alcanza con copiar la carpeta sin `node_modules`, `dist` ni `.env`).
2. Abrir el panel de XAMPP y apretar **Start** en **MySQL**.
3. Doble clic en **`instalar.bat`**. Hace todo solo:
   - instala las dependencias y compila el frontend;
   - crea `backend/.env` con claves al azar (si ya existe, lo respeta);
   - crea la base `caps_turnos`, sus tablas (`backend/db/schema.sql`) y el usuario `caps_app` con sus permisos (`backend/db/permisos.sql`);
   - carga los usuarios de prueba y, si se lo pedís, los datos de ejemplo completos.

   Pide la contraseña de root de MySQL (en XAMPP viene vacía: apretar Enter). Se puede correr de nuevo sin romper nada.
4. Si es la instalación definitiva, a la pregunta "¿Es la instalación definitiva?" responder **s**: todas las cuentas tendrán que cambiar la clave `demo1234` en el primer ingreso.

## Uso diario

1. Prender **MySQL** en el panel de XAMPP.
2. Doble clic en **`iniciar.bat`**. Se abre el navegador en http://localhost:3001.
3. Para cerrar el sistema, cerrar la ventana negra.

Usuarios de prueba (clave `demo1234`):

| Rol | DNI |
| --- | --- |
| Secretaria | 11111111 |
| Médica | 22222222 |
| Paciente | 33333333 |

Con los datos de ejemplo completos hay además 6 médicos (DNI 20100001 a 20100006) y 300 pacientes (DNI 30200001 a 30200300), con la misma clave.

## Copia de seguridad

Doble clic en **`copia-seguridad.bat`** (con MySQL prendido). Guarda un archivo `caps_turnos_AAAA-MM-DD_HH-MM.sql` en la carpeta `copias/`. Conviene hacerla seguido y pasarla a un pendrive: tiene datos de pacientes, **no subirla a internet**.

Para recuperar una copia: en phpMyAdmin, entrar a la base `caps_turnos` → pestaña **Importar** → elegir el archivo `.sql`.

## Mails (recuperar la clave y recordatorios de turnos)

Sin configurar, los mails no se envían: se muestran en la ventana del sistema (sirve para probar). Para mandarlos de verdad con Gmail:

1. Crear una cuenta de Gmail solo para el CAPS y activarle la **verificación en 2 pasos**.
2. En la cuenta de Google → Seguridad → **Contraseñas de aplicaciones**, crear una (son 16 letras).
3. En `backend/.env` completar:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=lacuenta@gmail.com
   SMTP_PASS=las16letras
   MAIL_FROM=CAPS Turnos <lacuenta@gmail.com>
   ```
4. Cerrar y volver a abrir `iniciar.bat`. Probar con "¿Olvidaste tu contraseña?" en el login.

El recordatorio se manda 24 horas antes de cada turno pendiente, con un enlace para confirmarlo (`RECORDATORIO_HORAS` en el `.env` cambia las horas). Como el sistema es local, el enlace del mail solo abre en la PC donde está instalado.

## Para programar

Dos terminales:

```
cd backend
npm run dev        # API en http://localhost:3001
```

```
cd frontend
npm run dev        # pantallas en http://localhost:5173
```

Pruebas: en `backend`, `npm test` (cálculo de turnos) y, con el backend andando, `npm run probar:permisos` (cada rol entra solo a lo suyo) y `npm run probar:doble-reserva`.

Si existe `frontend/dist` (después de `npm run build`), el backend también sirve las pantallas en http://localhost:3001.

## Límites

- Las recetas son **demostrativas** ("DOCUMENTO DEMOSTRATIVO – SIN VALIDEZ"): la Ley 27.553 exige receta electrónica en plataformas registradas.
- La historia clínica no cumple la Ley 27.706 (entre otras cosas, no tiene firma digital).
- Los avisos son solo por mail (no por WhatsApp).
