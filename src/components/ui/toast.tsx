"use client";

import { AlertTriangle, Check, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export type ToastTone = "success" | "error";

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

/** Durée d'affichage — assez pour être lu sans relire, assez court pour ne pas gêner. */
const DISMISS_MS = 4000;

const ToastContext = createContext<((message: string, tone?: ToastTone) => void) | null>(null);

/**
 * Confirmation discrète après une action.
 *
 * L'appli n'avait jusqu'ici aucun retour : enregistrer une tâche, supprimer
 * une écriture, démarrer un minuteur ou changer un statut ne provoquaient
 * qu'un rafraîchissement silencieux. Rien ne distinguait « c'est fait » de
 * « le clic n'a pas pris », ce qui pousse à recliquer — et donc à créer des
 * doublons ou à re-supprimer.
 *
 * Volontairement en bas à droite, hors du champ de lecture : une action
 * réussie ne mérite pas d'interrompre. Les échecs restent aussi affichés au
 * plus près du formulaire concerné quand il y en a un ; le toast ne les
 * remplace pas, il couvre les actions qui n'ont pas d'endroit où afficher
 * une erreur (une suppression depuis une liste, par exemple).
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const push = useCallback((message: string, tone: ToastTone = "success") => {
    const id = nextId.current++;
    setToasts((list) => [...list, { id, message, tone }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDismiss, DISMISS_MS);
    return () => clearTimeout(id);
  }, [onDismiss]);

  const error = toast.tone === "error";
  const Icon = error ? AlertTriangle : Check;
  return (
    <div
      role={error ? "alert" : "status"}
      className="pointer-events-auto flex items-start gap-2.5 rounded-lg border-[1.5px] px-3 py-2.5 shadow-lg motion-safe:animate-[toast-in_150ms_ease-out]"
      style={{
        background: error ? "var(--color-alert-wash)" : "var(--color-paper)",
        borderColor: error ? "var(--color-alert)" : "var(--color-heading)",
      }}
    >
      <Icon
        size={16}
        aria-hidden="true"
        className="mt-0.5 flex-shrink-0"
        style={{ color: error ? "var(--color-alert)" : "var(--color-heading)" }}
      />
      <span className="flex-1 text-sm font-medium text-ink">{toast.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fermer"
        className="-mt-0.5 -mr-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors duration-100 hover:bg-wash hover:text-ink"
      >
        <X size={13} />
      </button>
    </div>
  );
}

export function useToast() {
  const push = useContext(ToastContext);
  if (!push) throw new Error("useToast doit être utilisé sous ToastProvider (voir AppShell).");
  return push;
}
