"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, register } from "./actions";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const registering = mode === "register";
  const [state, action, pending] = useActionState(
    registering ? register : login,
    {},
  );

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border border-black/15 p-8 dark:border-white/20">
        <p className="mb-2 text-sm font-medium">
          WorldTeams · Programa de referidos
        </p>
        <h1 className="text-3xl font-semibold">
          {registering ? "Creá tu cuenta" : "Bienvenido de nuevo"}
        </h1>
        <p className="mt-3 text-sm opacity-70">
          {registering
            ? "El registro está habilitado para empleados activos. Usá tu correo laboral."
            : "Iniciá sesión con tu correo laboral para acceder al portal de referidos."}
        </p>
        <form action={action} className="mt-8 flex flex-col gap-5">
          <label
            className="flex flex-col gap-2 text-sm font-medium"
            htmlFor="email"
          >
            Correo laboral
            <input
              className="rounded-lg border border-current/25 bg-transparent px-3 py-2"
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </label>
          <label
            className="flex flex-col gap-2 text-sm font-medium"
            htmlFor="password"
          >
            Contraseña
            <input
              className="rounded-lg border border-current/25 bg-transparent px-3 py-2"
              id="password"
              name="password"
              type="password"
              autoComplete={registering ? "new-password" : "current-password"}
              minLength={registering ? 8 : undefined}
              required
            />
          </label>
          {registering && (
            <p className="text-sm opacity-70">Usá al menos 8 caracteres.</p>
          )}
          {state.error && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">
              {state.error}
            </p>
          )}
          {state.message && (
            <p
              role="status"
              className="text-sm text-green-700 dark:text-green-400"
            >
              {state.message}
            </p>
          )}
          <button
            className="rounded-lg bg-foreground px-4 py-3 font-medium text-background disabled:opacity-50"
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
        <p className="mt-6 text-sm">
          {registering ? "¿Ya tenés una cuenta? " : "¿Es tu primera vez? "}
          <Link
            className="underline"
            href={registering ? "/login" : "/register"}
          >
            {registering ? "Iniciar sesión" : "Crear una cuenta"}
          </Link>
        </p>
      </section>
    </main>
  );
}
