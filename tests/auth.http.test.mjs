import assert from "node:assert/strict";
import { test } from "node:test";

const base = "http://127.0.0.1:3010";
const mock = "http://127.0.0.1:4918/supabase";
const password = "PruebaSegura123!";

function decode(value) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function client() {
  const cookies = new Map();
  async function request(path, options = {}) {
    const response = await fetch(`${base}${path}`, {
      ...options,
      redirect: "manual",
      headers: {
        origin: base,
        cookie: [...cookies]
          .map(([key, value]) => `${key}=${value}`)
          .join("; "),
        ...options.headers,
      },
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const separator = pair.indexOf("=");
      const name = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      if (!value || /max-age=0/i.test(cookie)) cookies.delete(name);
      else cookies.set(name, value);
    }
    return {
      status: response.status,
      location: response.headers.get("location"),
      html: await response.text(),
      headers: response.headers,
    };
  }
  async function submit(path, fields) {
    const { html } = await request(path);
    const form = new FormData();
    const inputs = [...html.matchAll(/<input\b[^>]*type="hidden"[^>]*>/g)];
    assert.ok(
      inputs.length > 0,
      "El formulario debe exponer una acción de servidor",
    );
    for (const [input] of inputs) {
      const name = input.match(/\bname="([^"]*)"/)?.[1];
      const value = input.match(/\bvalue="([^"]*)"/)?.[1] || "";
      if (name) form.append(decode(name), decode(value));
    }
    for (const [name, value] of Object.entries(fields)) form.set(name, value);
    return request(path, { method: "POST", body: form });
  }
  return { request, submit };
}

function assertProtected(result) {
  assert.ok(
    result.location === "/login" ||
      result.html.includes("NEXT_REDIRECT;replace;/login;307"),
    "El visitante debe ser enviado a iniciar sesión",
  );
  assert.ok(
    !result.html.includes("Lucía García"),
    "El visitante no debe recibir datos del empleado",
  );
}

test("registro, confirmación, acceso y cierre de sesión contra la simulación HTTP", async () => {
  const reset = await fetch(`${mock}/__test/reset`, { method: "POST" });
  assert.equal(
    (await reset.json()).mock,
    "worldteams-supabase-auth",
    "Estas pruebas requieren el sustituto local, nunca Supabase real",
  );
  const browser = client();
  const candidate = {
    full_name: "  Nueva candidata  ",
    email: "  NUEVA@EXAMPLE.COM  ",
    profile_type: "engineering",
    country: "Argentina",
  };
  const postReferral = (body, requester = browser) => requester.request("/api/referrals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  assert.equal((await postReferral(candidate)).status, 401);
  assert.equal((await browser.request("/api/referrals")).status, 405);

  assertProtected(await browser.request("/"));
  let result = await browser.submit("/register", {
    email: "externo@example.com",
    password,
  });
  assert.match(result.html, /No pudimos completar el registro/);

  result = await browser.submit("/register", {
    email: "  LUCIA.GARCIA@EXAMPLE.COM  ",
    password,
  });
  assert.match(result.html, /Revisá tu correo laboral/);
  assertProtected(await browser.request("/"));

  result = await browser.submit("/login", {
    email: "lucia.garcia@example.com",
    password,
  });
  assert.match(result.html, /confirmá tu correo primero/);

  result = await browser.request(
    "/auth/confirm?token_hash=invalido&type=signup",
  );
  assert.ok(result.location.endsWith("/login?error=confirmation"));
  assert.match(result.headers.get("cache-control"), /no-store/);
  result = await browser.request(
    "/auth/confirm?token_hash=lucia-confirmacion&type=signup",
  );
  assert.ok(result.location.endsWith("/login?confirmed=true"));
  assertProtected(await browser.request("/"));

  result = await browser.submit("/login", {
    email: "lucia.garcia@example.com",
    password: "incorrecta",
  });
  assert.match(result.html, /No pudimos iniciar sesión/);
  result = await browser.submit("/login", {
    email: "lucia.garcia@example.com",
    password,
  });
  assert.equal(result.status, 303);
  assert.equal(result.location, "/");
  result = await browser.request("/");
  assert.match(result.html, /Lucía García/);
  assert.match(result.html, /Cerrar sesión/);

  for (const invalid of [
    null, [], { ...candidate, email: "invalido" },
    { ...candidate, full_name: "   " },
    { ...candidate, profile_type: "invalid" },
    { ...candidate, notes: "a".repeat(2001) },
    { ...candidate, linkedin_url: "javascript:alert(1)" },
    { ...candidate, country: 123 },
  ]) {
    assert.equal((await postReferral(invalid)).status, 400);
  }
  assert.equal((await browser.request("/api/referrals", { method: "POST", body: "texto" })).status, 415);
  assert.equal((await browser.request("/api/referrals", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{",
  })).status, 400);
  result = await postReferral({ ...candidate, referrer_id: "otro-empleado", status: "hired", profile_embedding: [1] });
  assert.equal(result.status, 201);
  assert.ok(JSON.parse(result.html).referral.id);
  let referrals = await (await fetch(`${mock}/__test/referrals`)).json();
  assert.equal(referrals.length, 1);
  assert.equal(referrals[0].email, "nueva@example.com");
  assert.equal(referrals[0].referrer_id, "11111111-1111-4111-8111-111111111111");
  const firstReferral = structuredClone(referrals);
  result = await postReferral({ ...candidate, email: "nueva@example.com" });
  assert.equal(result.status, 409);
  assert.equal(JSON.parse(result.html).error, "Este candidato ya fue referido.");

  const otherBrowser = client();
  result = await otherBrowser.submit("/login", {
    email: "sofia.martinez@example.com",
    password,
  });
  assert.equal(result.status, 303);
  result = await postReferral(candidate, otherBrowser);
  assert.equal(result.status, 409);
  assert.equal(JSON.parse(result.html).error, "Este candidato ya fue referido.");
  referrals = await (await fetch(`${mock}/__test/referrals`)).json();
  assert.deepEqual(referrals, firstReferral);
  result = await postReferral({ ...candidate, email: "fallo@example.com" });
  assert.equal(result.status, 500);
  assert.doesNotMatch(result.html, /Falla interna ficticia/);
  referrals = await (await fetch(`${mock}/__test/referrals`)).json();
  assert.equal(referrals.length, 1);

  result = await browser.submit("/", {});
  assert.equal(result.location, "/login");
  assertProtected(await browser.request("/"));

  result = await browser.submit("/login", {
    email: "mateo.rodriguez@example.com",
    password,
  });
  assert.match(result.html, /El acceso está limitado a empleados activos/);
  assertProtected(await browser.request("/"));
});
