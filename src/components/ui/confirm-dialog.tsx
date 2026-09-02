"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { ModalShell } from "@/components/modals/modal-shell";
import { dangerSolidButtonClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/buttons";

export interface ConfirmOptions {
  title: string;
  /** Ce que l'action fait vraiment, et ce qui est irréversible — pas une reformulation du titre. */
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Suppression ou perte de données : bouton en teinte d'alerte. */
  danger?: boolean;
}

type Ask = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Ask | null>(null);

/**
 * Demande de confirmation aux couleurs de l'appli, en remplacement de
 * `window.confirm`.
 *
 * Les dix confirmations de l'appli passaient par la boîte native du
 * navigateur : préfixée « localhost says: », impossible à mettre en forme,
 * incapable de distinguer une suppression définitive d'une simple mise à la
 * corbeille, et bloquant tout l'onglet. Ici le titre porte la question, le
 * corps porte la conséquence, et le bouton d'action prend la teinte d'alerte
 * quand l'opération détruit quelque chose.
 *
 * L'API reste une promesse booléenne, donc les appelants gardent la même
 * forme qu'avec `confirm()` : `if (!(await ask({...}))) return;`
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);

  const ask = useCallback<Ask>((options) => {
    setPending(options);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  function settle(ok: boolean) {
    resolveRef.current?.(ok);
    resolveRef.current = null;
    setPending(null);
  }

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      {pending && (
        <ModalShell
          title={pending.title}
          onClose={() => settle(false)}
          footer={
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => settle(false)}
                className={`px-4 py-2 text-sm font-semibold ${secondaryButtonClass}`}
              >
                {pending.cancelLabel ?? "Annuler"}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => settle(true)}
                className={`px-4 py-2 text-sm font-semibold ${pending.danger ? dangerSolidButtonClass : primaryButtonClass}`}
              >
                {pending.confirmLabel ?? "Confirmer"}
              </button>
            </div>
          }
        >
          {pending.body && <p className="text-sm text-ink">{pending.body}</p>}
        </ModalShell>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): Ask {
  const ask = useContext(ConfirmContext);
  if (!ask) throw new Error("useConfirm doit être utilisé sous ConfirmProvider (voir AppShell).");
  return ask;
}
