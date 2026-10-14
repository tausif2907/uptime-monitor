"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";
const order: Theme[] = ["system", "light", "dark"];
const icons = { light: Sun, dark: Moon, system: Monitor };

function apply(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    try {
      setTheme((localStorage.getItem("theme") as Theme) || "system");
    } catch {
      // storage blocked: stay on system
    }
  }, []);

  const Icon = icons[theme];
  const next = order[(order.indexOf(theme) + 1) % order.length]!;

  return (
    <button
      type="button"
      onClick={() => {
        setTheme(next);
        apply(next);
        try {
          localStorage.setItem("theme", next);
        } catch {
          // ignore
        }
      }}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      title={`Theme: ${theme} (click for ${next})`}
      aria-label={`Switch to ${next} theme`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
