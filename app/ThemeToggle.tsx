"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";

const STORAGE_KEY = "job-lele-theme";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    function applyTheme() {
      const root = document.documentElement;
      const next = root.dataset.theme === "dark" ? "light" : "dark";
      root.dataset.theme = next;
      setTheme(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // The theme still applies when storage is unavailable.
      }
    }

    if (document.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.startViewTransition(() => flushSync(applyTheme));
    } else {
      applyTheme();
    }
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
    >
      <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {theme === "dark" ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2" />
          </>
        ) : (
          <path d="M20.8 15.6A9.4 9.4 0 0 1 8.4 3.2a9.3 9.3 0 1 0 12.4 12.4Z" />
        )}
      </svg>
    </button>
  );
}
