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

async function createReferral(email = "nuevo@example.com", referrerEmail = "lucia.garcia@example.com") {
  return db.query(`
    select public.create_referral(
      (select id from public.referrers where email = $1),
      $2, 'Nuevo candidato', 'engineering', null, null, null, 'Una recomendación'
    ) as referral
  `, [referrerEmail, email]);
}

test("la RPC crea candidato qualified y referral sin embedding ni consentimiento", async () => {
  await db.exec("set local role service_role");
  const { rows: [{ referral }] } = await createReferral("  NUEVO@EXAMPLE.COM  ");
  const { rows: [candidate] } = await db.query("select * from public.candidates where id = $1", [referral.candidate_id]);
  assert.equal(candidate.email, "nuevo@example.com");
  assert.equal(candidate.status, "qualified");
  assert.equal(Object.hasOwn(candidate, "profile_embedding"), false);
  assert.equal(candidate.consent_confirmed, false);
  assert.equal(candidate.country, null);
  assert.equal(candidate.notes, "Una recomendación");
  assert.equal((await db.query("select candidate_id from public.referrals where id = $1", [referral.id])).rows[0].candidate_id, candidate.id);
});

test("rechaza el mismo referido por email normalizado sin modificar al candidato", async () => {
  await db.exec("set local role service_role");
  const { rows: [{ referral }] } = await createReferral();
  const before = (await db.query("select * from public.candidates where id = $1", [referral.candidate_id])).rows;
  await db.exec("savepoint duplicate_referral");
  await assert.rejects(createReferral("  NUEVO@EXAMPLE.COM  "), { code: "23505" });
  await db.exec("rollback to savepoint duplicate_referral");
  assert.deepEqual((await db.query("select * from public.candidates where id = $1", [referral.candidate_id])).rows, before);
  assert.equal((await db.query("select * from public.referrals where candidate_id = $1", [referral.candidate_id])).rows.length, 1);
});

test("rechaza otro referrer por el mismo email y conserva el primer referral y candidato", async () => {
  await db.exec(`update auth.users set email_confirmed_at = now() where id = '${mateo}'`);
  await db.exec("set local role service_role");
  const first = (await createReferral()).rows[0].referral;
  const originalCandidate = (await db.query("select * from public.candidates where id = $1", [first.candidate_id])).rows;
  const originalReferral = (await db.query("select * from public.referrals where id = $1", [first.id])).rows;
  await db.exec("savepoint other_referrer");
  await assert.rejects(
    createReferral("  NUEVO@EXAMPLE.COM  ", "mateo.rodriguez@example.com"),
    { code: "23505" },
  );
  await db.exec("rollback to savepoint other_referrer");
  assert.deepEqual((await db.query("select * from public.candidates where id = $1", [first.candidate_id])).rows, originalCandidate);
  assert.deepEqual((await db.query("select * from public.referrals where candidate_id = $1", [first.candidate_id])).rows, originalReferral);
  await db.exec("reset role");
  await asEmployee(mateo);
  assert.equal((await db.query("select * from public.candidates where id = $1", [first.candidate_id])).rows.length, 0);
});

test("califica candidatos submitted y conserva los estados posteriores y el perfil existente", async () => {
  await db.exec(`
    insert into public.candidates (email, full_name, status) values
      ('submitted@example.com', 'Perfil original', 'submitted'),
      ('hired@example.com', 'Perfil contratado', 'hired'),
      ('rejected@example.com', 'Perfil rechazado', 'rejected');
    set local role service_role;
  `);
  for (const status of ["submitted", "hired", "rejected"]) {
    await createReferral(`${status}@example.com`);
  }
  const { rows } = await db.query("select email, full_name, status from public.candidates where email in ('submitted@example.com', 'hired@example.com', 'rejected@example.com') order by email");
  assert.deepEqual(rows, [
    { email: "hired@example.com", full_name: "Perfil contratado", status: "hired" },
    { email: "rejected@example.com", full_name: "Perfil rechazado", status: "rejected" },
    { email: "submitted@example.com", full_name: "Perfil original", status: "qualified" },
  ]);
});

test("una falla al insertar el referral revierte la creación del candidato", async () => {
  await db.exec(`
    create function private.reject_test_referral() returns trigger language plpgsql as $$
    begin raise exception 'Falla de escritura de prueba'; end;
    $$;
    create trigger reject_test_referral before insert on public.referrals
      for each row execute function private.reject_test_referral();
    set local role service_role;
    savepoint failed_referral;
  `);
  await assert.rejects(createReferral(), /Falla de escritura de prueba/);
  await db.exec("rollback to savepoint failed_referral");
  assert.equal((await db.query("select * from public.candidates where email = 'nuevo@example.com'")).rows.length, 0);
});

test("la RPC bloquea empleados inactivos, sin cuenta y candidatos archivados", async () => {
  await db.exec(`update public.referrers set active = false where auth_user_id = '${lucia}'`);
  await db.exec("set local role service_role; savepoint inactive_referral");
  await assert.rejects(createReferral(), { code: "42501" });
  await db.exec("rollback to savepoint inactive_referral; savepoint unlinked_referral");
  await assert.rejects(createReferral("nuevo@example.com", "mateo.rodriguez@example.com"), { code: "42501" });
  await db.exec("rollback to savepoint unlinked_referral; reset role");
  await db.exec(`
    update public.referrers set active = true where auth_user_id = '${lucia}';
    insert into public.candidates (email, full_name, deleted_at) values ('archivado@example.com', 'Archivado', now());
    set local role service_role;
    savepoint archived_referral;
  `);
  await assert.rejects(createReferral("archivado@example.com"), { code: "P0002" });
  await db.exec("rollback to savepoint archived_referral");
  assert.equal((await db.query("select status from public.candidates where email = 'archivado@example.com'")).rows[0].status, "submitted");
});

test("solo service_role puede ejecutar la RPC y el navegador no obtiene escrituras directas", async () => {
  for (const role of ["anon", "authenticated", "service_role"]) {
    const { rows: [permissions] } = await db.query(`
      select has_function_privilege($1, 'public.create_referral(uuid,text,text,text,text,text,text,text)', 'execute') as execute,
        has_table_privilege($1, 'public.candidates', 'insert') as insert
    `, [role]);
    assert.equal(permissions.execute, role === "service_role");
    assert.equal(permissions.insert, role === "service_role");
  }
});
