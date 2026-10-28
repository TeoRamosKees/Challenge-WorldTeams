import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
  const contentType = request.headers
    .get("content-type")
    ?.split(";")[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    return Response.json(
      { error: "Enviá los datos como JSON." },
      { status: 415 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "El JSON no es válido." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json(
      { error: "Los datos del referido no son válidos." },
      { status: 400 },
    );
  }

  const input = body as Record<string, unknown>;
  const fields: Record<string, string> = {};
  const limits = {
    full_name: 150,
    email: 254,
    country: 100,
    linkedin_url: 500,
    profile_type: 30,
    profile_description: 2000,
    notes: 2000,
  };
  for (const [field, limit] of Object.entries(limits)) {
    const value = input[field] ?? "";
    if (typeof value !== "string" || value.trim().length > limit) {
      return Response.json(
        { error: `El campo ${field} no es válido.` },
        { status: 400 },
      );
    }
    fields[field] = value.trim();
  }
  fields.email = fields.email.toLowerCase();

  if (
    !fields.full_name ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email) ||
    !["architecture", "engineering", "design", "support", "other"].includes(
      fields.profile_type,
    )
  ) {
    return Response.json(
      { error: "Completá nombre, un correo válido y área profesional." },
      { status: 400 },
    );
  }
  if (fields.linkedin_url) {
    try {
      const url = new URL(fields.linkedin_url);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    } catch {
      return Response.json(
        {
          error: "El enlace de LinkedIn debe ser una URL HTTP o HTTPS válida.",
        },
        { status: 400 },
      );
    }
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user?.email_confirmed_at) {
      return Response.json(
        { error: "Iniciá sesión para enviar un referido." },
        { status: 401 },
      );
    }
    const { data: employee, error: employeeError } = await supabase
      .from("referrers")
      .select("id")
      .eq("auth_user_id", user.id)
      .eq("active", true)
      .maybeSingle();
    if (employeeError) throw employeeError;
    if (!employee) {
      return Response.json(
        { error: "El acceso está limitado a empleados activos." },
        { status: 403 },
      );
    }

    const { data, error } = await createAdminClient().rpc("create_referral", {
      p_referrer_id: employee.id,
      p_email: fields.email,
      p_full_name: fields.full_name,
      p_profile_type: fields.profile_type,
      p_country: fields.country || null,
      p_linkedin_url: fields.linkedin_url || null,
      p_profile_description: fields.profile_description || null,
      p_notes: fields.notes || null,
    });
    if (error?.code === "23505") {
      return Response.json(
        { error: "Este candidato ya fue referido." },
        { status: 409 },
      );
    }
    if (error?.code === "42501") {
      return Response.json(
        { error: "El acceso está limitado a empleados activos." },
        { status: 403 },
      );
    }
    if (error?.code === "P0002") {
      return Response.json(
        {
          error:
            "No se puede referir a este candidato. Contactá al equipo de WorldTeams.",
        },
        { status: 409 },
      );
    }
    if (error) throw error;

    return Response.json({ referral: data }, { status: 201 });
  } catch {
    return Response.json(
      { error: "No pudimos guardar el referido. Intentá nuevamente." },
      { status: 500 },
    );
  }
}
