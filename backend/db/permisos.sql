-- Permisos de la cuenta que usa el sistema (caps_app).
-- Regla del proyecto: nada se borra, solo se desactiva. Por eso caps_app NO tiene DELETE ni DROP,
-- salvo DELETE en especialidades (se pueden borrar las que nadie usó).
-- Se ejecuta como root (lo hace solo "npm run instalar"; a mano: en phpMyAdmin, pestaña SQL).
-- El usuario tiene que existir antes: CREATE USER 'caps_app'@'localhost' IDENTIFIED BY 'la-clave-del-.env';

-- Se arranca de cero para que no quede ningún permiso de más
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'caps_app'@'localhost';

GRANT SELECT, INSERT, UPDATE, CREATE, REFERENCES, INDEX, ALTER, CREATE TEMPORARY TABLES, LOCK TABLES,
      EXECUTE, CREATE VIEW, SHOW VIEW, CREATE ROUTINE, ALTER ROUTINE, EVENT, TRIGGER, DELETE HISTORY
  ON caps_turnos.* TO 'caps_app'@'localhost';

GRANT DELETE ON caps_turnos.especialidades TO 'caps_app'@'localhost';

FLUSH PRIVILEGES;
