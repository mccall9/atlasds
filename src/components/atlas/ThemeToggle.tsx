import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const ThemeContext = createContext({ dark: false, toggle: () => {} });
const storageKey = "atlas-theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      const enabled = saved === "dark";
      setDark(enabled);
      document.documentElement.classList.toggle("dark", enabled);
      document.body.classList.toggle("dark", enabled);
    } catch {
      // Storage may be blocked; the switch still works for this visit.
    }
  }, []);

  const toggle = () => {
    const enabled = !dark;
    setDark(enabled);
    document.documentElement.classList.toggle("dark", enabled);
    document.body.classList.toggle("dark", enabled);
    try {
      localStorage.setItem(storageKey, enabled ? "dark" : "light");
    } catch {
      // Keep the selected theme even when storage is unavailable.
    }
  };

  return <ThemeContext.Provider value={{ dark, toggle }}>{children}</ThemeContext.Provider>;
}

export function ThemeToggle() {
  const { dark, toggle } = useContext(ThemeContext);
  const label = dark ? "Ativar tema claro" : "Ativar tema escuro";
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label={label} title={label} aria-pressed={dark} className="no-print shrink-0">
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}