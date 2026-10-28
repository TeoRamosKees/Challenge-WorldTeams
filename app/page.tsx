import { Suspense } from "react";
import { logout } from "@/app/auth/actions";
import { requireEmployee } from "@/utils/supabase/auth";

async function Landing() {
  const { employee } = await requireEmployee();

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <header className="flex items-start justify-between gap-6 border-b border-current/20 pb-6">
        <div>
          <p className="text-sm opacity-70">
            WorldTeams · Programa de referidos
          </p>
          <h1 className="mt-3 text-3xl font-semibold">
            Hola, {employee.full_name}
          </h1>
          <p className="mt-2 text-sm opacity-70">{employee.email}</p>
        </div>
        <form action={logout}>
          <button
            className="rounded-lg border border-current/25 px-4 py-2"
            type="submit"
          >
            Cerrar sesión
          </button>
        </form>
      </header>
      <section className="py-10">
        <h2 className="text-xl font-semibold">Tu portal de referidos</h2>
        <p className="mt-3 opacity-70">
          Ya iniciaste sesión. Desde acá vas a poder referir candidatos a
          WorldTeams.
        </p>
      </section>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <p className="p-8" role="status">
          Cargando tu portal…
        </p>
      }
    >
      <Landing />
    </Suspense>
  );
}
