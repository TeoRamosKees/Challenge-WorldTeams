# WorldTeams — Programa de referidos

Aplicación Next.js con Supabase Auth. El registro y el acceso están limitados a los empleados activos que ya figuran en `public.referrers`.

## Desarrollo

```sh
pnpm install
cp .env.example .env.local
pnpm dev
```

Completar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` con los valores del proyecto. La aplicación no necesita una clave `service_role`.

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
- `/`: página protegida. Verifica la sesión y el estado del empleado en cada acceso. El botón **Cerrar sesión** elimina la sesión.
- `proxy.ts`: mantiene actualizados los tokens y las cookies de sesión.

Las políticas permiten leer únicamente el perfil, los referidos, los candidatos referidos y las recompensas del empleado conectado. No otorgan escrituras sobre las tablas de negocio. Desactivar `referrers.active` bloquea el acceso y la lectura de datos aunque el token no haya vencido. El vínculo usa el ID de Auth después de la confirmación; cambiar el correo no reasigna referidos.

El archivo `supabase/seed.sql` contiene empleados ficticios de desarrollo; no crea cuentas ni contraseñas de Auth.

## Verificación

```sh
pnpm lint --max-warnings=0
pnpm exec tsc --noEmit
pnpm test:db
pnpm build
```

Las pruebas de base de datos ejecutan las migraciones en PostgreSQL embebido (PGlite), con un esquema mínimo que reproduce las columnas de Auth utilizadas. Solo se omiten la extensión y el índice de búsqueda vectorial, ajenos a la autenticación. Cubren restricciones de alta, confirmación, conservación de datos, aislamiento entre empleados y bajas.

La simulación HTTP de Supabase y sus instrucciones están en `postman/simulations/auth.context.md`. Permite comprobar la aplicación y el SDK sin crear cuentas reales ni enviar correos. No reemplaza una prueba final con el proyecto Supabase y su proveedor SMTP configurados.
