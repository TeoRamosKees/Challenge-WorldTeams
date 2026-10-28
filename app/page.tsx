import { Suspense } from "react";
import Link from "next/link";
import { logout } from "@/app/auth/actions";
import { ReferralForm } from "@/app/referrals/referral-form";
import { requireEmployee } from "@/utils/supabase/auth";

async function Landing() {
  const { employee } = await requireEmployee();

  return (
    <div className="referral-portal">
      <header className="portal-header">
        <div className="portal-header-inner">
          <Link className="portal-brand" href="/" aria-label="WorldTeams, inicio">
            <span className="portal-brand-mark" aria-hidden="true">
              w.
            </span>
            <span>
              worldteams<span className="portal-brand-dot">.</span>
            </span>
          </Link>
          <div className="portal-account">
            <div className="portal-account-details">
              <span>{employee.full_name}</span>
              <span>{employee.email}</span>
            </div>
            <form action={logout}>
              <button className="portal-logout" type="submit">
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="portal-main">
        <div className="portal-intro">
          <p className="portal-eyebrow">PROGRAMA DE REFERIDOS</p>
          <h1>
            El próximo gran talento<br />
            puede estar en tu red<span>.</span>
          </h1>
          <p>
            Hola, {employee.full_name}. Presentanos a alguien con quien te
            encantaría trabajar.
          </p>
        </div>
        <div className="portal-form">
          <ReferralForm />
        </div>
        <footer className="portal-footer">
          <span>WorldTeams · Conectamos personas y oportunidades.</span>
          <span>Programa de referidos</span>
        </footer>
      </main>
    </div>
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
