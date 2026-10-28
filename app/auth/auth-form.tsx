"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import { login, register } from "./actions";

export function AuthForm({
  mode,
  children,
}: {
  mode: "login" | "register";
  children?: ReactNode;
}) {
  const registering = mode === "register";
  const [state, action, pending] = useActionState(
    registering ? register : login,
    {},
  );

  return (
    <div className="referral-portal auth-portal">
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
      <main className="auth-main">
        <section className="auth-card" aria-labelledby="auth-title">
          <p className="portal-eyebrow">PROGRAMA DE REFERIDOS</p>
          <h1 id="auth-title">
            {registering ? "Creá tu cuenta" : "Bienvenido de nuevo"}
          </h1>
          <p className="auth-description">
            {registering
              ? "El registro está habilitado para empleados activos. Usá tu correo laboral."
              : "Iniciá sesión con tu correo laboral para acceder al portal de referidos."}
          </p>
          {children}
          <form
            action={action}
            className="auth-form"
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.nativeEvent.isComposing &&
                event.target instanceof HTMLInputElement
              ) {
                event.preventDefault();
                if (!pending) event.currentTarget.requestSubmit();
              }
            }}
          >
            <div className="referral-field">
              <label htmlFor="email">Correo laboral</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="nombre@empresa.com"
                autoComplete="email"
                required
              />
            </div>
            <div className="referral-field">
              <label htmlFor="password">Contraseña</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={registering ? "new-password" : "current-password"}
                minLength={registering ? 8 : undefined}
                aria-describedby={registering ? "password-hint" : undefined}
                required
              />
              {registering && (
                <p id="password-hint" className="referral-field-hint">
                  Usá al menos 8 caracteres.
                </p>
              )}
            </div>
            {state.error && (
              <p role="alert" className="auth-feedback auth-feedback-error">
                {state.error}
              </p>
            )}
            {state.message && (
              <p role="status" className="auth-feedback auth-feedback-success">
                {state.message}
              </p>
            )}
            <button
              className="referral-primary-button"
              type="submit"
              disabled={pending}
            >
              {pending
                ? "Un momento…"
                : registering
                  ? "Registrarme"
                  : "Iniciar sesión"}
            </button>
          </form>
          <p className="auth-switch">
            {registering ? "¿Ya tenés una cuenta? " : "¿Es tu primera vez? "}
            <Link href={registering ? "/login" : "/register"}>
              {registering ? "Iniciar sesión" : "Crear una cuenta"}
            </Link>
          </p>
        </section>
      </main>
      <footer className="portal-footer auth-footer">
        <span>WorldTeams · Conectamos personas y oportunidades.</span>
        <span>Programa de referidos</span>
      </footer>
    </div>
  );
}
