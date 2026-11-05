import { useEffect, useState } from "react";

/** subscribe to a CSS media query and re-render when it changes */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" && "matchMedia" in window
      ? window.matchMedia(query).matches
      : false,
  );
  useEffect(() => {
    if (!("matchMedia" in window)) return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

export type Breakpoint = "mobile" | "tablet" | "desktop";

/** coarse breakpoint used to swap table<->card and drawer<->dock */
export function useBreakpoint(): Breakpoint {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const isTablet = useMediaQuery("(min-width: 768px)");
  if (isDesktop) return "desktop";
  if (isTablet) return "tablet";
  return "mobile";
}

/** true once the viewport is below the `lg` rail breakpoint */
export const useIsCompact = () => !useMediaQuery("(min-width: 1024px)");
