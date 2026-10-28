// Contrato: docs oficiales de Supabase Auth y SDK instalado. Solo datos ficticios.
// Las restricciones reales de PostgreSQL se prueban en tests/employee-auth.database.test.mjs.
/* eslint-disable @typescript-eslint/no-require-imports -- Postman ejecuta handlers CommonJS. */
const http = require("node:http");
const { createHmac, randomUUID } = require("node:crypto");
const password = "PruebaSegura123!";

function initialAccounts() {
  return [
    {
      id: "11111111-1111-4111-8111-111111111111",
      email: "lucia.garcia@example.com",
      name: "Lucía García",
      active: true,
      registered: false,
      confirmed: false,
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      email: "mateo.rodriguez@example.com",
      name: "Mateo Rodríguez",
      active: false,
      registered: true,
      confirmed: true,
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      email: "sofia.martinez@example.com",
      name: "Sofía Martínez",
      active: true,
      registered: true,
      confirmed: true,
    },
  ];
}

function user(account) {
  return {
    id: account.id,
    aud: "authenticated",
    role: "authenticated",
    email: account.email,
    email_confirmed_at: account.confirmed ? "2026-10-28T12:00:00Z" : null,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    created_at: "2026-10-28T12:00:00Z",
    identities: [],
  };
}

function session(account) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: account.id,
      aud: "authenticated",
      role: "authenticated",
      email: account.email,
      iat: now,
      exp: now + 3600,
      session_id: randomUUID(),
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", "clave-ficticia-solo-para-pruebas")
    .update(`${header}.${payload}`)
    .digest("base64url");
  account.token = `${header}.${payload}.${signature}`;
  return {
    access_token: account.token,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: randomUUID(),
    user: user(account),
  };
}

http
  .createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(body === undefined ? undefined : JSON.stringify(body));
    };
    try {
      const url = new URL(req.url, "http://localhost");
      if (req.method === "POST" && url.pathname === "/__test/reset") {
        await pm.state.set("supabase.accounts", initialAccounts());
        await pm.state.set("supabase.referrals", []);
        return send(200, { mock: "worldteams-supabase-auth" });
      }
      if (req.method === "GET" && url.pathname === "/__test/referrals") {
        return send(200, (await pm.state.get("supabase.referrals")) || []);
      }
      const body = req.body || {};
      const accounts =
        (await pm.state.get("supabase.accounts")) || initialAccounts();
      const persist = () => pm.state.set("supabase.accounts", accounts);
      const account = accounts.find((entry) => entry.email === body.email);
      const token = req.headers.authorization?.replace(/^Bearer /, "");
      const current = accounts.find(
        (entry) => entry.token && entry.token === token,
      );

      if (req.method === "POST" && url.pathname === "/rest/v1/rpc/create_referral") {
        if (token !== "clave-service-role-ficticia")
          return send(403, { code: "42501", message: "Solo backend" });
        if (!accounts.some((entry) => entry.id === body.p_referrer_id && entry.active && entry.confirmed))
          return send(403, { code: "42501", message: "Empleado inactivo" });
        if (body.p_email === "fallo@example.com")
          return send(500, { code: "XX000", message: "Falla interna ficticia" });
        const referrals = (await pm.state.get("supabase.referrals")) || [];
        if (referrals.some((entry) => entry.email === body.p_email))
          return send(409, { code: "23505", message: "Referido duplicado" });
        const referral = { id: randomUUID(), candidate_id: randomUUID(), referrer_id: body.p_referrer_id, email: body.p_email };
        referrals.push(referral);
        await pm.state.set("supabase.referrals", referrals);
        return send(200, { id: referral.id, candidate_id: referral.candidate_id });
      }

      if (req.method === "POST" && url.pathname === "/auth/v1/signup") {
        if (!account?.active)
          return send(422, {
            code: "unexpected_failure",
            msg: "Registro no habilitado",
          });
        if (typeof body.password !== "string" || body.password.length < 8)
          return send(422, {
            code: "weak_password",
            msg: "Contraseña demasiado corta",
          });
        account.registered = true;
        await persist();
        return send(200, user(account));
      }
      if (req.method === "POST" && url.pathname === "/auth/v1/verify") {
        const pending = accounts[0];
        if (
          body.token_hash !== "lucia-confirmacion" ||
          body.type !== "signup" ||
          !pending.registered ||
          pending.confirmed
        )
          return send(403, { code: "otp_expired", msg: "Enlace inválido" });
        pending.confirmed = true;
        const result = session(pending);
        await persist();
        return send(200, result);
      }
      if (
        req.method === "POST" &&
        url.pathname === "/auth/v1/token" &&
        url.searchParams.get("grant_type") === "password"
      ) {
        if (!account?.registered || body.password !== password)
          return send(400, {
            code: "invalid_credentials",
            msg: "Credenciales inválidas",
          });
        if (!account.confirmed)
          return send(400, {
            code: "email_not_confirmed",
            msg: "Correo pendiente de confirmación",
          });
        const result = session(account);
        await persist();
        return send(200, result);
      }
      if (req.method === "GET" && url.pathname === "/auth/v1/user") {
        return current
          ? send(200, user(current))
          : send(401, { code: "bad_jwt", msg: "Sesión inválida" });
      }
      if (req.method === "POST" && url.pathname === "/auth/v1/logout") {
        if (current) {
          delete current.token;
          await persist();
        }
        return send(204);
      }
      if (req.method === "GET" && url.pathname === "/rest/v1/referrers") {
        if (!current) return send(401, { message: "Sesión inválida" });
        const matches =
          current.active &&
          current.confirmed &&
          url.searchParams.get("auth_user_id") === `eq.${current.id}`;
        return send(
          200,
          matches
            ? [
                {
                  id: current.id,
                  full_name: current.name,
                  email: current.email,
                },
              ]
            : [],
        );
      }
      return send(501, { message: "Ruta no modelada en esta prueba" });
    } catch {
      return send(500, { message: "Falló la simulación de Auth" });
    }
  })
  .listen(process.env.PORT || 4500);
