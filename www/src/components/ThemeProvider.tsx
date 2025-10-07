import { useEffect } from "react";
import { useSnapshot } from "valtio";
import { store } from "../store";
import { getTheme } from "../themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const snap = useSnapshot(store);

  useEffect(() => {
    const theme = getTheme(snap.theme);
    const root = document.documentElement;

    // Apply all theme colors as CSS variables
    Object.entries(theme.colors).forEach(([key, value]) => {
      // Convert camelCase to kebab-case
      const cssVarName = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      root.style.setProperty(`--${cssVarName}`, value);
    });
  }, [snap.theme]);

  return <>{children}</>;
}
