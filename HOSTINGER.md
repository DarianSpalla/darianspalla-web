# Activar usuarios en Hostinger

Esta versión requiere PHP 8.1 o superior, extensión PDO MySQL y HTTPS. No funciona en hosting estático. El repositorio no contiene la contraseña de MySQL.

1. Importar `database/schema.sql` en phpMyAdmin, dentro de `u285474793_darianspalla`.
2. Subir el contenido completo de `public/` a `public_html/` del dominio darianspalla.com. Conservar las imágenes y los demás archivos existentes. No subir worker.js ni ejecutar Wrangler.
3. Crear `portal-private/` al mismo nivel que `public_html/`. Copiar allí `config/portal-config.example.php` con el nombre `config.php`. Poner la contraseña vigente de MySQL y un token aleatorio de instalación de al menos 32 caracteres. Confirmar host y usuario en hPanel; el ejemplo usa 127.0.0.1 y el usuario informado. No poner este archivo dentro de public_html ni en GitHub.
4. Abrir `https://darianspalla.com/instalar.html`, ingresar el token y crear el administrador con una contraseña nueva de al menos 10 caracteres. La instalación se bloquea automáticamente después de crear la primera cuenta. Eliminar instalar.html y quitar setup_token del archivo privado.
5. Entrar a `portal.html` con esa cuenta. Desde Agregar usuario, crear alumnos y habilitar sus módulos con Gestionar.

## Verificación

Probar una cuenta de alumno en una ventana privada: debe ingresar, guardar una nota o diagnóstico, cerrar sesión y recuperar esos datos desde otro navegador. Cambiar accesos como administrador y recargar la sesión del alumno. Contraseñas incorrectas deben rechazarse. Los datos previos guardados sólo en cada navegador no se importan automáticamente.

El portal muestra si está guardando o si falló. Si otra sesión guardó antes, se rechaza la escritura para evitar sobrescribir datos: copiar los cambios pendientes y recargar. No cerrar la pestaña mientras hay cambios pendientes. Los certificados emitidos y las respuestas del coach son de administración; el alumno no puede modificarlos desde la API.

Subir código a GitHub no configura automáticamente MySQL ni instala archivos en Hostinger. Hace falta acceso al hosting o ejecutar estos pasos en hPanel. La verificación final debe realizarse en el dominio con PHP y MySQL activos.
