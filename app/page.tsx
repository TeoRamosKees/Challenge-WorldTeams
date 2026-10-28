import { Suspense } from "react";
import Link from "next/link";
import { logout } from "@/app/auth/actions";
import { ReferralForm } from "@/app/referrals/referral-form";
import { requireEmployee } from "@/utils/supabase/auth";

function ReferralProgramCard() {
  return (
    <section
      className="referral-card referral-program"
      aria-labelledby="referral-program-title"
    >
      <h2 id="referral-program-title">¿Cómo funciona el programa?</h2>
      <ol className="referral-program-steps">
        <li>
          <h3>Referí a alguien de tu red</h3>
          <p>
            Completá el formulario y enviá su perfil a nuestra base de candidatos.
          </p>
        </li>
        <li>
          <h3>Si se contrata, te avisamos</h3>
          <p>
            Cuando tu referido es contratado, se genera una recompensa y te
            notificamos.
          </p>
        </li>
        <li>
          <h3>Cobrá tu bono</h3>
          <p>
            Recibís un bono por cada contratación de una persona que hayas referido.
          </p>
        </li>
      </ol>
    </section>
  );
}

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
        <ReferralProgramCard />
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

function PortalLoading() {
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
            Qué bueno tenerte acá. Tu próxima recomendación puede abrir una gran
            oportunidad.
          </p>
        </div>
        <ReferralProgramCard />
        <section
          className="referral-card portal-form portal-loading-card"
          aria-label="Cargando tu portal"
        >
          <div className="portal-loading-status" role="status">
            <span className="portal-loading-dot" aria-hidden="true" />
            <div>
              <p className="portal-loading-title">
                Estamos preparando tu espacio…
              </p>
              <p className="portal-loading-description">
                Enseguida vas a poder presentarnos a alguien con quien te
                encantaría trabajar.
              </p>
            </div>
          </div>
          <div
            className="referral-fields portal-loading-fields"
            aria-hidden="true"
          >
            {Array.from({ length: 7 }, (_, index) => (
              <div
                className={`referral-field${index >= 3 ? " referral-field-half" : ""}`}
                key={index}
              >
                <span className="portal-skeleton-label" />
                <span
                  className={`portal-skeleton-input${index >= 5 ? " portal-skeleton-textarea" : ""}`}
                />
              </div>
            ))}
          </div>
        </section>
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
    <Suspense fallback={<PortalLoading />}>
      <Landing />
    </Suspense>
  );
}
