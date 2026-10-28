"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export type AuthState = { error?: string; message?: string };

function credentials(formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string") return null;
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || !password)
    return null;

  return { email: normalizedEmail, password };
}

export async function register(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const values = credentials(formData);
  if (!values || values.password.length < 8) {
    return {
      error:
        "Ingresá un correo laboral válido y una contraseña de al menos 8 caracteres.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp(values);

  if (error) {
    return {
      error:
        "No pudimos completar el registro. Usá el correo con el que figurás como empleado o contactá al administrador.",
    };
  }

  return {
    message:
      "Revisá tu correo laboral para confirmar tu cuenta. Después podés iniciar sesión.",
  };
}

export async function login(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const values = credentials(formData);
  if (!values) return { error: "Ingresá tu correo y contraseña." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(values);
  if (error || !data.user?.email_confirmed_at) {
    return {
      error:
        "No pudimos iniciar sesión. Revisá tus credenciales y confirmá tu correo primero.",
    };
  }

  const { data: employee, error: employeeError } = await supabase
    .from("referrers")
    .select("id")
    .eq("auth_user_id", data.user.id)
    .eq("active", true)
    .maybeSingle();

  if (employeeError || !employee) {
    await supabase.auth.signOut();
    return {
      error:
        "El acceso está limitado a empleados activos. Contactá al administrador.",
    };
  }

  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error)
    throw new Error("No pudimos cerrar la sesión. Intentá nuevamente.");
  redirect("/login");
}
