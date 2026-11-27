import type { Metadata } from "next";
import { GuptAIQuickLink } from "./GuptAIInstall";
import ThemeToggle from "./ThemeToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Lele - Fresher jobs in India",
  description:
    "Fresh AI, full stack, software, and data jobs in India for freshers and early career developers. Every job verified live before listing.",
};

// Runs before first paint so the saved theme applies with no flash.
const THEME_SCRIPT = `(function(){try{var t;try{t=localStorage.getItem('job-lele-theme')}catch(e){}if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';document.documentElement.setAttribute('data-theme',t)}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <header className="site-header">
          <div className="container header-actions">
            <GuptAIQuickLink />
            <ThemeToggle />
            <a
              className="x-link"
              href="https://x.com/Aditya_Chawla20"
              target="_blank"
              rel="noopener noreferrer"
            >
              @Aditya_Chawla20
            </a>
          </div>
        </header>
        <main className="container">
          <h1 className="visually-hidden">Job Lele</h1>
          {children}
        </main>
        <footer className="site-footer">
          <div className="container">
            <p>
              Every job is verified live before it is listed. Salaries are shown only when
              the listing shows them. Jobs older than 7 days are removed automatically.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
