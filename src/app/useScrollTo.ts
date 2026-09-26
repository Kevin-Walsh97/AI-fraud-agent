import { useEffect, useRef } from "react";

/** Scrolls the returned ref into view when `key` changes (used when a list item opens a detail pane below it on phones). */
export function useScrollTo<T extends HTMLElement>(key: unknown) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (key == null || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    if (r.top < 0 || r.top > window.innerHeight * 0.6) ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [key]);
  return ref;
}
