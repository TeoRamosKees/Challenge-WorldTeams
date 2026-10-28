import { Suspense } from "react";
import { AuthForm } from "@/app/auth/auth-form";

async function LoginNotice({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  if (params.error === "access") {
    return (
      <p role="alert" className="auth-feedback auth-feedback-error">
        El acceso está limitado a empleados activos. Contactá al administrador.
      </p>
    );
  }
  if (params.error === "confirmation") {
    return (
      <p role="alert" className="auth-feedback auth-feedback-error">
        El enlace de confirmación es inválido o venció. Volvé a registrarte para
        solicitar otro correo.
      </p>
    );
  }
  if (params.confirmed === "true") {
    return (
      <p role="status" className="auth-feedback auth-feedback-success">
        Correo confirmado. Ya podés iniciar sesión.
      </p>
    );
  }
  return null;
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <AuthForm mode="login">
      <Suspense fallback={null}>
        <LoginNotice {...props} />
      </Suspense>
    </AuthForm>
  );
}
