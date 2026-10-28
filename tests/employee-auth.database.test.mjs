import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

let db;
const lucia = "11111111-1111-4111-8111-111111111111";
const mateo = "22222222-2222-4222-8222-222222222222";
const other = "33333333-3333-4333-8333-333333333333";

before(async () => {
  db = new PGlite();
  // Auth administra este esquema en Supabase. Reproducimos las columnas usadas
  // por la migración para probar triggers y RLS en un PostgreSQL local aislado.
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users (
      id uuid primary key, email text unique, email_confirmed_at timestamptz,
      raw_user_meta_data jsonb default '{}'
    );
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth to authenticated;
  `);

  for (const file of (await readdir("supabase/migrations")).sort()) {
    if (file.endsWith("_employee_auth.sql")) {
      await db.exec(await readFile("supabase/seed.sql", "utf8"));
      await db.exec(`
        insert into auth.users (id, email, email_confirmed_at) values
          ('${lucia}', 'lucia.garcia@example.com', now()),
          ('${mateo}', 'mateo.rodriguez@example.com', null);
      `);
    }
    let sql = await readFile(`supabase/migrations/${file}`, "utf8");
    // pgvector no interviene en Auth; el entorno embebido usa texto para ese
    // campo y omite únicamente la extensión y su índice de búsqueda vectorial.
    sql = sql
      .replace(
        /create extension if not exists vector with schema extensions;/,
        "",
      )
      .replace(/extensions\.vector\(1536\)/, "text")
      .replace(/create index candidates_profile_embedding_idx[\s\S]*?;/, "");
    await db.exec(sql);
  }

  await db.exec(`
    insert into public.candidates (email, full_name) values
      ('candidato1@example.com', 'Candidato de Lucía'),
      ('candidato2@example.com', 'Candidato de Mateo');
    insert into public.referrals (referrer_id, candidate_id)
      select r.id, c.id from public.referrers r join public.candidates c on
        (r.email = 'lucia.garcia@example.com' and c.email = 'candidato1@example.com') or
        (r.email = 'mateo.rodriguez@example.com' and c.email = 'candidato2@example.com');
    insert into public.rewards (referral_id, amount_usd)
      select id, 100 from public.referrals;
  `);
});

beforeEach(async () => {
  await db.exec("begin");
});
afterEach(async () => {
  await db.exec("rollback");
});
after(async () => {
  await db?.close();
});

async function asEmployee(id) {
  await db.query("select set_config('request.jwt.claim.sub', $1, true)", [id]);
  await db.exec("set local role authenticated");
}

test("vincula cuentas existentes confirmadas y conserva pendientes sin vincular", async () => {
  const { rows } = await db.query(
    "select email, auth_user_id from public.referrers where email in ('lucia.garcia@example.com', 'mateo.rodriguez@example.com') order by email",
  );
  assert.equal(rows[0].auth_user_id, lucia);
  assert.equal(rows[1].auth_user_id, null);
});

test("rechaza el registro directo de alguien que no figura como empleado", async () => {
  await assert.rejects(
    db.exec(
      `insert into auth.users (id, email) values ('${other}', 'externo@example.com')`,
    ),
    /solo para empleados habilitados/,
  );
});

test("rechaza empleados inactivos", async () => {
  await db.exec(
    "update public.referrers set active = false where email = 'sofia.martinez@example.com'",
  );
  await assert.rejects(
    db.exec(
      `insert into auth.users (id, email) values ('${other}', 'sofia.martinez@example.com')`,
    ),
    /solo para empleados habilitados/,
  );
});

test("el registro admite mayúsculas pero no vincula antes de confirmar", async () => {
  await db.exec(
    `insert into auth.users (id, email, raw_user_meta_data) values ('${other}', 'SOFIA.MARTINEZ@EXAMPLE.COM', '{"auth_user_id":"${lucia}","active":true}')`,
  );
  const { rows } = await db.query(
    "select auth_user_id from public.referrers where email = 'sofia.martinez@example.com'",
  );
  assert.equal(rows[0].auth_user_id, null);
  await asEmployee(other);
  assert.equal(
    (await db.query("select * from public.referrers")).rows.length,
    0,
  );
});

test("la confirmación vincula al empleado sin modificar sus referidos", async () => {
  const before = (await db.query("select * from public.referrals order by id"))
    .rows;
  await db.exec(
    `update auth.users set email_confirmed_at = now() where id = '${mateo}'`,
  );
  assert.deepEqual(
    (await db.query("select * from public.referrals order by id")).rows,
    before,
  );
  const { rows } = await db.query(
    "select auth_user_id from public.referrers where email = 'mateo.rodriguez@example.com'",
  );
  assert.equal(rows[0].auth_user_id, mateo);
});

test("un empleado desactivado entre registro y confirmación no puede vincularse", async () => {
  await db.exec(
    "update public.referrers set active = false where email = 'mateo.rodriguez@example.com'",
  );
  await assert.rejects(
    db.exec(
      `update auth.users set email_confirmed_at = now() where id = '${mateo}'`,
    ),
    /No hay un empleado habilitado/,
  );
});

test("RLS permite ver solo el perfil, referidos, candidatos y recompensas propios", async () => {
  await asEmployee(lucia);
  assert.deepEqual(
    (await db.query("select email from public.referrers")).rows,
    [{ email: "lucia.garcia@example.com" }],
  );
  assert.deepEqual(
    (await db.query("select full_name from public.candidates")).rows,
    [{ full_name: "Candidato de Lucía" }],
  );
  assert.equal(
    (await db.query("select * from public.referrals")).rows.length,
    1,
  );
  assert.equal((await db.query("select * from public.rewards")).rows.length, 1);
});

test("una cuenta sin vínculo no puede leer datos de empleados", async () => {
  await asEmployee(mateo);
  for (const table of ["referrers", "referrals", "candidates", "rewards"]) {
    assert.equal(
      (await db.query(`select * from public.${table}`)).rows.length,
      0,
    );
  }
});

test("la baja de un empleado revoca la lectura incluso con el mismo JWT", async () => {
  await db.exec(
    `update public.referrers set active = false where auth_user_id = '${lucia}'`,
  );
  await asEmployee(lucia);
  for (const table of ["referrers", "referrals", "candidates", "rewards"]) {
    assert.equal(
      (await db.query(`select * from public.${table}`)).rows.length,
      0,
    );
  }
});

test("un empleado no puede modificar su vínculo ni habilitarse a sí mismo", async () => {
  await asEmployee(lucia);
  await assert.rejects(
    db.exec(
      `update public.referrers set auth_user_id = '${other}', active = true`,
    ),
    /permission denied/,
  );
});

test("un visitante anónimo no puede consultar el padrón", async () => {
  await db.exec("set local role anon");
  await assert.rejects(
    db.exec("select * from public.referrers"),
    /permission denied/,
  );
});

test("eliminar Auth conserva el empleado y el historial de referidos", async () => {
  await db.exec(`delete from auth.users where id = '${lucia}'`);
  assert.equal(
    (
      await db.query(
        "select auth_user_id from public.referrers where email = 'lucia.garcia@example.com'",
      )
    ).rows[0].auth_user_id,
    null,
  );
  assert.equal(
    (await db.query("select * from public.referrals")).rows.length,
    2,
  );
});

test("cambiar el correo no cambia la identidad del empleado vinculado", async () => {
  await db.exec(
    `update auth.users set email = 'nuevo@example.com', email_confirmed_at = now() where id = '${lucia}'`,
  );
  await asEmployee(lucia);
  assert.deepEqual(
    (await db.query("select email from public.referrers")).rows,
    [{ email: "lucia.garcia@example.com" }],
  );
});

test("el trigger no puede invocarse directamente desde las APIs", async () => {
  const { rows } = await db.query(
    "select has_function_privilege('authenticated', 'private.handle_employee_auth()', 'execute') as allowed",
  );
  assert.equal(rows[0].allowed, false);
});
