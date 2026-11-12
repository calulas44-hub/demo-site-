"use client";

import { createContext, useContext, useTransition } from "react";

export const FormPendingContext = createContext(false);

/**
 * Formulaire branché sur une action serveur (useActionState) qui CONSERVE les
 * valeurs saisies après une erreur de validation : l'action est appelée dans
 * une transition au lieu de passer par l'attribut `action`, ce qui évite la
 * réinitialisation automatique du formulaire par React.
 */
export function ActionForm({ action, onSubmit, children, ...rest }: { action: (formData: FormData) => void } & Omit<React.FormHTMLAttributes<HTMLFormElement>, "action">) {
  const [pending, startTransition] = useTransition();
  return (
    <form
      {...rest}
      onSubmit={(e) => {
        onSubmit?.(e);
        if (e.defaultPrevented) return;
        e.preventDefault();
        const form = e.currentTarget;
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
        const fd = new FormData(form, submitter ?? undefined);
        startTransition(() => action(fd));
      }}
      aria-busy={pending || undefined}
    >
      <FormPendingContext.Provider value={pending}>{children}</FormPendingContext.Provider>
    </form>
  );
}

export function useActionPending(): boolean {
  return useContext(FormPendingContext);
}
