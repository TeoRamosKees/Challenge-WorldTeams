-- La identidad de Auth es independiente del ID de empleado y sus referidos.
alter table public.referrers
  add column auth_user_id uuid unique references auth.users (id) on delete set null;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Solo Auth puede activar este trigger. No es una función expuesta por la API.
-- SECURITY DEFINER permite consultar el padrón privado durante el alta,
-- cuando todavía no existe una sesión ni un auth.uid().
create function private.handle_employee_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.email is null or not exists (
      select 1 from public.referrers
      where lower(email) = lower(new.email)
        and active
        and auth_user_id is null
    ) then
      raise exception 'Registro disponible solo para empleados habilitados.';
    end if;
  end if;

  -- La cuenta se vincula recién después de demostrar la titularidad del correo.
  -- Un cambio posterior de correo no permite apropiarse de otro empleado.
  if new.email_confirmed_at is not null and not exists (
    select 1 from public.referrers where auth_user_id = new.id
  ) then
    update public.referrers
      set auth_user_id = new.id
      where lower(email) = lower(new.email)
        and active
        and auth_user_id is null;

    if not found then
      raise exception 'No hay un empleado habilitado para esta cuenta.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.handle_employee_auth() from public, anon, authenticated, service_role;

create trigger on_employee_auth_created_or_confirmed
after insert or update of email_confirmed_at on auth.users
for each row execute function private.handle_employee_auth();

-- Conserva las cuentas existentes que ya confirmaron su correo.
update public.referrers as referrer
set auth_user_id = auth_user.id
from auth.users as auth_user
where lower(referrer.email) = lower(auth_user.email)
  and referrer.active
  and auth_user.email_confirmed_at is not null;

-- Los empleados tienen acceso de lectura a sus propios datos.
-- Las escrituras de negocio siguen a cargo del backend y n8n.
revoke all on public.referrers, public.referrals, public.candidates, public.rewards from anon, authenticated;
grant select on public.referrers, public.referrals, public.candidates, public.rewards to authenticated;

create policy employee_read_own_profile on public.referrers
for select to authenticated
using (auth_user_id = (select auth.uid()) and active);

create policy employee_read_own_referrals on public.referrals
for select to authenticated
using (referrer_id in (select id from public.referrers));

create policy employee_read_referred_candidates on public.candidates
for select to authenticated
using (id in (select candidate_id from public.referrals));

create policy employee_read_own_rewards on public.rewards
for select to authenticated
using (referral_id in (select id from public.referrals));
