import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);

    setMatches(mql.matches);

    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }

    // Safari < 14 (typed as deprecated/optional in modern TS DOM libs)
    const legacy = mql as MediaQueryList & {
      addListener?: (listener: (this: MediaQueryList, ev: MediaQueryListEvent) => unknown) => void;
      removeListener?: (listener: (this: MediaQueryList, ev: MediaQueryListEvent) => unknown) => void;
    };

    legacy.addListener?.(onChange);
    return () => legacy.removeListener?.(onChange);
  }, [query]);

  return matches;
}
