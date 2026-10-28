-- Conserva referrals_candidate_uk: el candidato pertenece al primer referral.

-- La RPC se llama únicamente desde el endpoint, después de verificar la sesión.
-- SECURITY INVOKER conserva los permisos del llamador; no expone escrituras al cliente.
create function public.create_referral(
  p_referrer_id uuid,
  p_email text,
  p_full_name text,
  p_profile_type text,
  p_country text default null,
  p_linkedin_url text default null,
  p_profile_description text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_candidate_id uuid;
  v_deleted_at timestamptz;
  v_referral_id uuid;
begin
  -- Verifica también el estado del empleado al realizar la escritura.
  perform 1 from public.referrers
    where id = p_referrer_id and active and auth_user_id is not null;
  if not found then
    raise exception 'Empleado no habilitado.' using errcode = '42501';
  end if;

  insert into public.candidates (
    email, full_name, profile_type, country, linkedin_url, profile_description, notes, status
  ) values (
    lower(btrim(p_email)), btrim(p_full_name), p_profile_type,
    nullif(btrim(p_country), ''), nullif(btrim(p_linkedin_url), ''),
    nullif(btrim(p_profile_description), ''), nullif(btrim(p_notes), ''), 'qualified'
  )
  on conflict (lower(email)) do update
    -- No sobrescribir el perfil ni retroceder estados de un candidato existente.
    set status = case when candidates.status = 'submitted' then 'qualified' else candidates.status end
  returning id, deleted_at into v_candidate_id, v_deleted_at;

  if v_deleted_at is not null then
    raise exception 'El candidato está archivado.' using errcode = 'P0002';
  end if;

  insert into public.referrals (referrer_id, candidate_id)
    values (p_referrer_id, v_candidate_id)
    returning id into v_referral_id;

  return jsonb_build_object('id', v_referral_id, 'candidate_id', v_candidate_id);
end;
$$;

revoke all on function public.create_referral(uuid, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_referral(uuid, text, text, text, text, text, text, text)
  to service_role;
grant select on public.referrers to service_role;
grant select, insert, update on public.candidates to service_role;
grant select, insert on public.referrals to service_role;
