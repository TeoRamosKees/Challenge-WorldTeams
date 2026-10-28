import { redirect } from "next/navigation";
import { createClient } from "./server";

export async function requireEmployee() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user || !user.email_confirmed_at) {
    redirect("/login");
  }

  const { data: employee, error } = await supabase
    .from("referrers")
    .select("id, full_name, email")
    .eq("auth_user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (error) throw new Error("No pudimos verificar el acceso del empleado.");
  if (!employee) redirect("/login?error=access");

  return { supabase, employee };
}
