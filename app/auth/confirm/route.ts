import { createClient } from "@/utils/supabase/server";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const destination = new URL("/login", request.url);

  if (tokenHash && type === "signup") {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "signup",
    });
    if (!error) {
      // Confirmar el correo e iniciar sesión son pasos separados.
      await supabase.auth.signOut();
      destination.searchParams.set("confirmed", "true");
    } else {
      destination.searchParams.set("error", "confirmation");
    }
  } else {
    destination.searchParams.set("error", "confirmation");
  }

  const response = NextResponse.redirect(destination);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
