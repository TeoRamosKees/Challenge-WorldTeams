# WorldTeams — Programa de referidos

Aplicación Next.js con Supabase Auth. El registro y el acceso están limitados a los empleados activos que ya figuran en `public.referrers`.

## Desarrollo

```sh
pnpm install
cp .env.example .env.local
pnpm dev
```

Completar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` con los valores del proyecto. Configurar también `SUPABASE_SERVICE_ROLE_KEY` en el servidor para guardar referidos. Esta clave nunca debe llevar el prefijo `NEXT_PUBLIC_` ni enviarse al navegador.

## Configurar Supabase

1. Revisar y aplicar las migraciones pendientes en el proyecto vinculado:

   ```sh
   bunx supabase db push --linked --dry-run
   bunx supabase db push --linked
   bunx supabase db advisors --linked --type security
   ```

   La migración `20261028160258_employee_auth.sql` agrega el vínculo con Auth, restringe el registro mediante un trigger y habilita la lectura de datos propios con RLS. Conserva los IDs y el historial de empleados y referidos. No se aplica automáticamente al iniciar Next.js.

2. En el panel de Supabase, habilitar el proveedor de correo y los registros, activar **Confirm email** y establecer una contraseña mínima de 8 caracteres.
3. En **URL Configuration**, configurar **Site URL** con la URL de la aplicación, por ejemplo `http://localhost:3000` durante desarrollo. En producción usar el dominio HTTPS correspondiente.
4. En la plantilla de confirmación de registro, usar el contenido de `supabase/templates/confirmation.html`. El enlace debe apuntar a:

   ```html
   <a
     href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=signup"
     >Confirmar correo</a
   >
   ```

5. Configurar SMTP propio para enviar correos a empleados reales. El servicio de correo predeterminado de Supabase tiene restricciones de destinatarios y de cantidad de envíos.

`supabase/config.toml` ya contiene estas opciones y la plantilla para el entorno local. Esas opciones no actualizan por sí solas la configuración del proyecto alojado en Supabase.

## Flujo de acceso

- `/register`: recibe correo laboral y contraseña. Supabase rechaza el alta si el correo no corresponde a un empleado activo sin cuenta vinculada, incluso si se llama a Auth directamente.
- `/auth/confirm`: verifica el enlace enviado por correo. Un trigger vincula la identidad confirmada mediante `referrers.auth_user_id`; luego el usuario puede iniciar sesión.
- `/login`: comprueba las credenciales y que la cuenta esté vinculada a un empleado activo.
- `/`: página protegida con el formulario de nuevo referido. Verifica la sesión y el estado del empleado en cada acceso. El botón **Cerrar sesión** elimina la sesión.
- `proxy.ts`: mantiene actualizados los tokens y las cookies de sesión.

Las políticas permiten leer únicamente el perfil, los referidos, los candidatos referidos y las recompensas del empleado conectado. No otorgan escrituras sobre las tablas de negocio. Desactivar `referrers.active` bloquea el acceso y la lectura de datos aunque el token no haya vencido. El vínculo usa el ID de Auth después de la confirmación; cambiar el correo no reasigna referidos.

El archivo `supabase/seed.sql` contiene empleados ficticios de desarrollo; no crea cuentas ni contraseñas de Auth.

## Formulario de referidos

Después de iniciar sesión, el empleado puede completar nombre, correo, país, LinkedIn, área profesional, experiencia y recomendación. Nombre, correo y área son obligatorios. **Revisar referido** valida los campos y muestra una vista previa; **Volver a editar** conserva lo ingresado.

**Enviar referido** llama a `POST /api/referrals`. El endpoint valida la sesión confirmada y que el empleado siga activo; el referrer se obtiene de esa sesión, sin aceptar un ID enviado por el navegador. La pantalla conserva los datos ante errores y permite cargar otra persona después de un envío exitoso. La confirmación de consentimiento por parte del candidato sigue pendiente.

Aplicar las migraciones de `supabase/migrations` antes de usar el endpoint. La RPC `create_referral`, disponible solo para `service_role`, guarda candidato y referral en una única transacción. Los nuevos candidatos quedan con `status = 'qualified'` y `consent_confirmed = false`.

El correo se normaliza con trim y minúsculas. Cada candidato puede tener un solo referral, incluso ante envíos concurrentes. Si ya fue referido por cualquier empleado, el endpoint devuelve `409` con el mensaje **Este candidato ya fue referido.**, conservando el candidato y el referrer originales. Un candidato existente sin referral se reutiliza sin sobrescribir su perfil o notas originales; si estaba `submitted`, pasa a `qualified`, y los estados posteriores se conservan. Los candidatos archivados no admiten nuevos referidos.

### Contrato de `POST /api/referrals`

Requiere cookies de sesión y `Content-Type: application/json`. Campos obligatorios: `full_name` (hasta 150 caracteres), `email` (hasta 254), `profile_type` (`architecture`, `engineering`, `design`, `support` u `other`). Opcionales: `country` (100), `linkedin_url` (URL HTTP/HTTPS, 500), `profile_description` y `notes` (2.000 cada uno).

```json
{
  "full_name": "Sofía Martínez",
  "email": "sofia@example.com",
  "profile_type": "engineering",
  "country": "Argentina",
  "notes": "Trabajamos juntos en varios proyectos."
}
```

Respuesta `201`: `{ "referral": { "id": "uuid", "candidate_id": "uuid" } }`. Los errores devuelven `{ "error": "mensaje" }`: `400` para datos inválidos, `401` sin sesión confirmada, `403` sin empleado activo, `409` para duplicados o candidatos archivados, `415` si no es JSON y `500` ante fallas de persistencia. No se genera un referral parcial si falla la transacción.

## Verificación

```sh
pnpm lint --max-warnings=0
pnpm exec tsc --noEmit
pnpm test:db
pnpm build
```

Las pruebas de base de datos ejecutan las migraciones en PostgreSQL embebido (PGlite), con un esquema mínimo que reproduce las columnas de Auth utilizadas. Solo se omiten la extensión y el índice de búsqueda vectorial. Cubren restricciones de alta, confirmación, conservación de datos, aislamiento entre empleados, bajas, creación de referidos, normalización de correo, duplicados, estados y rollback.

La simulación HTTP de Supabase y sus instrucciones están en `postman/simulations/auth.context.md`. Permite comprobar la aplicación y el SDK sin crear cuentas reales ni enviar correos. No reemplaza una prueba final con el proyecto Supabase y su proveedor SMTP configurados.
