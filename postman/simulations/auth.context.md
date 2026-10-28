# Pruebas locales de autenticación — 2026-10-28

## Propósito

Ejecutar Next.js y su SDK contra un sustituto HTTP de Supabase, sin enviar correos ni crear cuentas reales. El contrato se tomó de la documentación oficial y del SDK instalado. No se buscó un mock publicado porque el CLI de Postman no tiene una sesión iniciada; Orbit devolvió endpoints de administración que no correspondían al flujo.

## Ejecución

```sh
postman simulation run postman/simulations/auth.sim.yaml --port 4918 --no-history --output ndjson
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:4918/supabase NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=clave-publica-ficticia SUPABASE_SERVICE_ROLE_KEY=clave-service-role-ficticia pnpm build
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:4918/supabase NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=clave-publica-ficticia SUPABASE_SERVICE_ROLE_KEY=clave-service-role-ficticia pnpm start --port 3010
pnpm test:auth
```

Ejecutar la simulación, el servidor y las pruebas en terminales separadas; esperar que la compilación termine antes de iniciar el servidor. Las pruebas reinician los datos ficticios. Al terminar, detener el servidor de prueba y volver a ejecutar `pnpm build` sin las variables de simulación. Las credenciales de prueba están en `postman/mocks/supabase-auth/default.cjs`.

## Supuestos

- El sustituto modela solo el flujo utilizado por la aplicación, no entrega correos ni verifica firmas como Supabase real. Los triggers y políticas se verifican por separado con `pnpm test:db`. (2026-10-28, revisión del código)

## Observaciones

<!-- begin:observations -->

2026-10-28: tras corregir la regla a un único referrer por candidato, `pnpm test:auth` pasó con dos empleados activos distintos. El primer envío devolvió `201`; los reintentos del mismo empleado y de otro devolvieron `409` con **Este candidato ya fue referido.**. El estado del mock conservó el primer referral sin cambios. Las 21 pruebas de PGlite también pasaron: la restricción `referrals_candidate_uk` rechaza al segundo referrer y conserva el candidato, su atribución original y el aislamiento por RLS. Esta verificación es local y con simulación HTTP; sigue pendiente aplicar la migración en Supabase real.

2026-10-28: `pnpm test:auth` pasó con `POST /api/referrals` contra el servidor compilado. Verificó `201`, normalización del email, atribución al empleado de la sesión pese a un ID adulterado, `409` por duplicado, `400` por campos inválidos/JSON malformado, `401` sin sesión, `405` para GET, `415` sin JSON y `500` ante una falla ficticia de persistencia sin exponer el error interno. El estado del mock conservó un solo referral tras el duplicado y la falla. El SDK llamó a `/rest/v1/rpc/create_referral`; la transacción, los estados y los permisos reales se verificaron por separado con las 21 pruebas de PGlite. Sigue pendiente aplicar la migración y probar contra Supabase real. El asesor de seguridad local no pudo ejecutarse porque no hay un servidor Supabase en el puerto 54322.

2026-10-28: la repetición de `pnpm test:auth` pasó sin errores en el registro del servidor después de agregar `connection()` antes de crear el cliente. `supabase` recibió todas las operaciones de Auth y la consulta del empleado; no hubo miembros sin tráfico.

2026-10-28: `pnpm test:auth` pasó contra el servidor compilado en el puerto 3010. El único miembro, `supabase`, recibió las solicitudes de alta, confirmación, login, consulta de usuario y empleado, y logout. Se verificaron errores de credenciales, correo sin confirmar y empleado inactivo. Ningún miembro quedó sin tráfico.
<!-- end:observations -->

## Problemas encontrados

- 2026-10-28: el CLI exige una ruta a `config.yaml` en `mocks.path`; una carpeta produjo `Mock 'file' must point to a file`. Se corrigió la ruta en `auth.sim.yaml`.
- 2026-10-28: había otro `next dev` del mismo proyecto; se usó un servidor de producción separado para no detenerlo. Turbopack conservó un error de permisos del sandbox en su caché; una compilación autorizada con caché nueva lo resolvió.
- 2026-10-28: la primera ejecución HTTP dejó `Date.now()` de `_emitInitialSession` en el registro de precarga de Next.js. Se corrigió esperando una solicitud real con `connection()` en el cliente de servidor; la segunda ejecución pasó sin ese error.
