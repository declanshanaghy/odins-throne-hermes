import { useEffect } from "react";
import type { NamespaceOption } from "./useNamespace";

/** Returns true when the keyboard event originates from a text-entry element. */
function isTypingTarget(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (t.isContentEditable) return true;
  return false;
}

/**
 * Global keyboard shortcut: pressing 'n' (outside any text input) cycles the
 * namespace list to the next entry in order, wrapping from last back to first.
 * Satisfies issue #108 acceptance criteria:
 *   - cycles namespaces in order
 *   - does not fire while typing in inputs
 */
export function useNamespaceCycleKey(
  namespaces: NamespaceOption[],
  namespace: string,
  setNamespace: (ns: string) => void,
): void {
  useEffect(() => {
    if (namespaces.length === 0) return;

    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key !== "n") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e)) return;

      const idx = namespaces.findIndex((ns) => ns.id === namespace);
      const next = namespaces[(idx + 1) % namespaces.length];
      if (next) setNamespace(next.id);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [namespaces, namespace, setNamespace]);
}
