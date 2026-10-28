"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

const profileTypes = [
  { value: "architecture", label: "Arquitectura" },
  { value: "engineering", label: "Ingeniería" },
  { value: "design", label: "Diseño" },
  { value: "support", label: "Soporte" },
  { value: "other", label: "Otra área" },
];

type ReferralDraft = {
  full_name: string;
  email: string;
  country: string;
  linkedin_url: string;
  profile_type: string;
  profile_description: string;
  notes: string;
};

export function ReferralForm() {
  const [draft, setDraft] = useState<ReferralDraft | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const formIntro = useRef<HTMLDivElement>(null);
  const hasReviewed = useRef(false);

  useEffect(() => {
    if (draft) {
      hasReviewed.current = true;
      reviewHeading.current?.focus();
    } else if (hasReviewed.current) {
      formIntro.current?.focus();
    }
  }, [draft]);

  function reviewReferral(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (name: string) => String(data.get(name) ?? "").trim();
    setError(null);

    setDraft({
      full_name: value("full_name"),
      email: value("email"),
      country: value("country"),
      linkedin_url: value("linkedin_url"),
      profile_type: value("profile_type"),
      profile_description: value("profile_description"),
      notes: value("notes"),
    });
  }

  async function submitReferral() {
    if (!draft || pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "No pudimos guardar el referido.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError(
        "No pudimos confirmar el envío. Revisá tu conexión e intentá nuevamente.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="referral-card" aria-label="Nuevo referido">
      <form ref={form} onSubmit={reviewReferral} hidden={draft !== null}>
        <div
          className="referral-form-intro referral-edit-intro"
          ref={formIntro}
          tabIndex={-1}
        >
          <p>Completá su perfil para dar el primer paso.</p>
          <p className="referral-required-note">
            Los campos con <span aria-hidden="true">*</span> son obligatorios.
          </p>
        </div>

        <div className="referral-fields">
          <div className="referral-field">
            <label htmlFor="full_name">
              Nombre y apellido <span aria-hidden="true">*</span>
            </label>
            <input
              id="full_name"
              name="full_name"
              placeholder="Ej. Sofía Martínez"
              autoComplete="off"
              required
              pattern={".*\\S.*"}
              maxLength={150}
            />
          </div>
          <div className="referral-field">
            <label htmlFor="candidate_email">
              Correo electrónico <span aria-hidden="true">*</span>
            </label>
            <input
              id="candidate_email"
              name="email"
              type="email"
              placeholder="Ej. sofia@correo.com"
              autoComplete="off"
              required
              maxLength={254}
            />
          </div>
          <div className="referral-field">
            <label htmlFor="profile_type">
              Área profesional <span aria-hidden="true">*</span>
            </label>
            <select id="profile_type" name="profile_type" defaultValue="" required>
              <option value="" disabled>
                Seleccioná un área
              </option>
              {profileTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          <div className="referral-field referral-field-half">
            <label htmlFor="country">
              País de residencia <span className="referral-optional">Opcional</span>
            </label>
            <input
              id="country"
              name="country"
              placeholder="Ej. Argentina"
              autoComplete="off"
              maxLength={100}
            />
          </div>
          <div className="referral-field referral-field-half referral-field-linkedin">
            <label htmlFor="linkedin_url">
              Perfil de LinkedIn <span className="referral-optional">Opcional</span>
            </label>
            <input
              id="linkedin_url"
              name="linkedin_url"
              type="url"
              pattern="https?://.+"
              placeholder="https://www.linkedin.com/in/usuario"
              aria-describedby="linkedin-hint"
              autoComplete="off"
              maxLength={500}
            />
            <p id="linkedin-hint" className="referral-field-hint">
              Pegá el enlace completo, incluyendo https://.
            </p>
          </div>
          <div className="referral-field referral-field-half">
            <label htmlFor="profile_description">
              Sobre su experiencia <span className="referral-optional">Opcional</span>
            </label>
            <textarea
              id="profile_description"
              name="profile_description"
              rows={3}
              maxLength={2000}
              placeholder="Contanos a qué se dedica, sus principales habilidades y en qué proyectos trabajó…"
              aria-describedby="experience-hint"
            />
            <p id="experience-hint" className="referral-field-hint">
              Herramientas, especialidades e idiomas. Hasta 2.000 caracteres.
            </p>
          </div>
          <div className="referral-field referral-field-half">
            <label htmlFor="notes">
              ¿Por qué recomendás a esta persona? <span className="referral-optional">Opcional</span>
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              maxLength={2000}
              placeholder="¿Cómo se conocen? ¿Qué te gustaría destacar de su forma de trabajar?"
              aria-describedby="notes-hint"
            />
            <p id="notes-hint" className="referral-field-hint">
              Tu perspectiva suma. Hasta 2.000 caracteres.
            </p>
          </div>
        </div>

        <div className="referral-form-footer">
          <p>
            Vas a poder revisar los datos antes de enviar el referido.
          </p>
          <button className="referral-primary-button" type="submit">
            Revisar referido <span aria-hidden="true">↗</span>
          </button>
        </div>
      </form>

      {draft && (
        <div className="referral-review">
          <div className="referral-form-intro">
            <h2 ref={reviewHeading} tabIndex={-1}>
              {submitted ? "Referido enviado" : "Revisá tu referido"}
            </h2>
            <p>
              {submitted
                ? "Guardamos tu recomendación correctamente."
                : "Confirmá los datos antes de enviar tu recomendación."}
            </p>
          </div>
          <dl className="referral-review-data">
            {[
              ["Nombre y apellido", draft.full_name],
              ["Correo electrónico", draft.email],
              ["País de residencia", draft.country],
              ["Perfil de LinkedIn", draft.linkedin_url],
              [
                "Área profesional",
                profileTypes.find((type) => type.value === draft.profile_type)
                  ?.label,
              ],
              ["Sobre su experiencia", draft.profile_description],
              ["Tu recomendación", draft.notes],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value || "Sin completar"}</dd>
              </div>
            ))}
          </dl>
          {submitted && (
            <div className="referral-review-notice" role="status">
              <strong>Tu referido ya está registrado.</strong>
              <p>Gracias por acercarnos a alguien de tu red.</p>
            </div>
          )}
          {error && <p role="alert">{error}</p>}
          <div className="referral-review-actions">
            {!submitted && (
              <button
                className="referral-primary-button"
                type="button"
                disabled={pending}
                onClick={submitReferral}
              >
                {pending ? "Enviando…" : "Enviar referido"}
              </button>
            )}
            <button
              className="referral-primary-button"
              type="button"
              disabled={pending}
              onClick={() => {
                if (submitted) form.current?.reset();
                setSubmitted(false);
                setError(null);
                setDraft(null);
              }}
            >
              {submitted ? "Referir a otra persona" : "← Volver a editar"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
