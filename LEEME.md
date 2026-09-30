# Darian Roy Spalla — versión mejorada

## Cambios
- Portada editorial verde oscuro y dorado, fotos originales y mejor jerarquía de lectura.
- Navegación adaptable, menú con teclado, contraste, tamaños táctiles y respeto por la preferencia de movimiento reducido.
- Imágenes incrustadas extraídas a archivos para evitar repetir grandes bloques base64.
- Metadatos corregidos y etiquetas sociales básicas.
- Formulario de contacto que abre WhatsApp con los datos escritos, sin simular un envío.
- Página de retorno que no confirma pagos ni crea cuentas sin verificación.
- API en el mismo dominio bajo /api, con sesiones de 8 horas, permisos del servidor, claves fuera del código y limitación de intentos de acceso.
- Contraseñas de usuarios heredadas migradas a PBKDF2 al iniciar sesión; los listados no devuelven claves ni hashes.

## Estado y límites
No está publicado. La sesión de trabajo no dispone de conexión utilizable a Cloudflare: no hay conector de cuenta disponible, la terminal no resuelve api.cloudflare.com y el acceso a Chrome fue rechazado.
La comprobación visual tampoco fue posible: el entorno impide abrir un servidor local y el navegador bloquea páginas file://. La composición requiere revisión visual antes de reemplazar el sitio público.
Se verificó la sintaxis de los scripts y se ejecutaron 11 comprobaciones del Worker con una base simulada. No se verificaron servicios reales, pagos ni correos.
El portal conserva sus herramientas y contenidos originales. Parte del seguimiento, notas, mensajes y progreso sigue dependiendo del almacenamiento local que tenía el sitio. No se convirtió en un campus con persistencia central completa; no debe asumirse que esos datos se comparten entre dispositivos o usuarios.
Los certificados generados en el navegador conservan el comportamiento original y no cuentan con un mecanismo de autenticidad o verificación pública nuevo.
Los precios, enlaces de pago, testimonios y afirmaciones profesionales proceden del archivo entregado; no se verificaron externamente.
La inscripción pública automática se deshabilitó. La habilitación de usuarios requiere gestión administrativa y comprobación del pago. No hay webhook ni confirmación automática nueva de Mercado Pago.

## Preparación del despliegue en tu cuenta
1. Instalar las dependencias con `npm install`.
2. Iniciar sesión: `npx wrangler login` y comprobar la cuenta con `npx wrangler whoami`.
3. Respaldar el namespace COACHING_DB que usa el Worker original antes de migrar.
4. Agregar a wrangler.jsonc el namespace existente, con binding DB:
   `"kv_namespaces": [{ "binding": "DB", "id": "ID_REAL_DEL_NAMESPACE" }]`
   No crear una base vacía si se quieren conservar usuarios existentes.
5. El namespace debe tener la cuenta administrativa existente en la clave `users`. La nueva API exige la contraseña administrativa desde el secreto ADMIN_PASSWORD; ya no acepta la clave incrustada antigua.
6. Configurar el secreto con `npx wrangler secret put ADMIN_PASSWORD`. Usar una contraseña nueva y privada. No incluirla en HTML, JavaScript público ni wrangler.jsonc.
7. Ejecutar `node verify.mjs`, `npm run check` y revisar el sitio con `npm run dev` en escritorio y celular.
8. Publicar con `npm run deploy`. El Worker propuesto se llama darian-coaching-web; no sobrescribe automáticamente darian-coaching-db.
9. Revisar la URL devuelta y conectar darianspalla.com solo después de confirmar el dominio y las rutas existentes en la cuenta.
10. Retirar del Worker anterior las claves expuestas y los endpoints sin autorización: publicar el nuevo sitio no corrige el Worker viejo. Mantener una copia recuperable antes de reemplazarlo.

## Archivos
`public/` contiene el sitio. `worker.js` contiene la API. `wrangler.jsonc` prepara Cloudflare Workers con Static Assets. `verify.mjs` contiene las comprobaciones de seguridad y compatibilidad básicas.
