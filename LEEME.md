# Darian Spalla · Cloudflare Pages

Sitio público y portal de coaching con backend en Cloudflare Pages y base de datos D1. Producción: https://darianspalla.pages.dev y https://darianspalla.com.

## Funciones

- Sesiones con cookies HttpOnly, contraseñas PBKDF2 y protección CSRF.
- Administración de usuarios, contraseñas, suspensión y habilitación de módulos y herramientas por programa.
- Diagnósticos, notas, planes, mensajes privados y respuestas del coach guardados en D1.
- Evaluaciones corregidas por el servidor y certificados emitidos tras aprobar el programa.
- Programas, videos, frases, reflexiones aprobadas y consultas del formulario administrables.
- Activación de cuentas por enlace de un solo uso; el administrador puede crear enlaces de restablecimiento que vencen en 72 horas.

## Administración

Ingresar en `/portal.html`. La cuenta de Darian conservada desde la base anterior es `darianspalla@gmail.com`. Su contraseña inicial se establece con un enlace privado de activación; ninguna contraseña ni enlace privado debe subirse al repositorio.

Desde **Usuarios**, crear cuentas y habilitar módulos/herramientas. Desde **Consultas del sitio**, revisar los mensajes del formulario. Los alumnos sólo ven sus propios datos.

## Desarrollo y publicación

```sh
npm ci
npm run build
npx wrangler d1 execute darianspalla-production --local --file cloudflare/schema.sql
node scripts/seed-local.mjs
npx wrangler d1 execute darianspalla-production --local --file /tmp/darian-test/seed.sql
npm test
npm run dev
```

El script de pruebas arranca Pages localmente y verifica autenticación, permisos, privacidad, persistencia, conflictos atómicos, evaluaciones, certificados, consultas y suspensión. Las credenciales de prueba se generan en `/tmp` y nunca se incluyen en el sitio.

Para publicar con una cuenta autorizada:

```sh
npx wrangler login
npm run deploy
```

`wrangler.jsonc` enlaza exclusivamente el proyecto `darianspalla` y su D1 `darianspalla-production`. La carpeta `dist` contiene los archivos públicos y un Worker privado con el contenido. El proceso de build excluye los antiguos archivos PHP de Hostinger.

Para una base nueva, ejecutar `cloudflare/schema.sql` y crear una cuenta de administrador mediante una migración privada. En la base histórica de este proyecto se ejecutó también `cloudflare/migrate-existing.sql`: conserva las tablas anteriores y copia perfiles sin consultar ni cambiar sus contraseñas antiguas.

## Integraciones externas

Los enlaces reales de Mercado Pago se configuran en **Programas**. Hasta entonces, el sitio ofrece consultar la inscripción por WhatsApp. No hay cobros ni alta automática por pago sin una integración de pagos verificada.

El envío automático de certificados utiliza EmailJS y requiere Service ID, Template ID y Public Key propios, configurables en **Certificados**. La descarga del certificado funciona sin EmailJS. El correo de contacto abre el cliente de correo; las consultas se guardan además en D1.

Los archivos históricos de Hostinger permanecen en el repositorio como referencia y no se publican en Pages. No cargar una copia de `public/` a un servidor PHP esperando el backend actual; utilizar `npm run build` y Cloudflare Pages.
