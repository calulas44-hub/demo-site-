"use client";

import { useFormStatus } from "react-dom";
import { useActionPending } from "@/components/action-form";
import type { FormState } from "@/lib/shop-actions";

export function SubmitButton({ children, className = "btn-a", pendingLabel = "Enregistrement…", ...rest }: { children: React.ReactNode; className?: string; pendingLabel?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const formPending = useFormStatus().pending;
  const actionPending = useActionPending();
  const pending = formPending || actionPending;
  return (
    <button type="submit" className={className} disabled={pending} {...rest}>
      {pending ? pendingLabel : children}
    </button>
  );
}

/** Bouton de formulaire avec confirmation (suppression, actions sensibles). */
export function ConfirmButton({ children, message, className = "btn-a btn-a--danger btn-a--sm", ...rest }: { children: React.ReactNode; message: string; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Msg({ state }: { state: FormState | { ok: boolean; message: string } | null | undefined }) {
  if (!state?.message) return null;
  return (
    <p className={`msg ${state.ok ? "msg--ok" : "msg--err"}`} role={state.ok ? "status" : "alert"}>
      {state.message}
    </p>
  );
}
