import { Suspense } from "react";
import { AuthForm } from "@/app/auth/auth-form";

async function LoginNotice({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  if (params.error === "access") {
    return (
      <p role="alert" className="px-6 pt-6 text-center">
        El acceso está limitado a empleados activos. Contactá al administrador.
      </p>
    );
  }
  if (params.error === "confirmation") {
    return (
      <p role="alert" className="px-6 pt-6 text-center">
        El enlace de confirmación es inválido o venció. Volvé a registrarte para
        solicitar otro correo.
      </p>
    );
  }
  if (params.confirmed === "true") {
    return (
      <p role="status" className="px-6 pt-6 text-center">
        Correo confirmado. Ya podés iniciar sesión.
      </p>
    );
  }
  return null;
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <>
      <Suspense fallback={null}>
        <LoginNotice {...props} />
      </Suspense>
      <AuthForm mode="login" />
    </>
  );
}
