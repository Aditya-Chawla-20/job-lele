import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
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
          <div className="container">
            <div className="header-row">
              <div>
                <h1 className="site-name">
                  <svg className="site-mark" viewBox="0 0 32 32" aria-hidden="true">
                    <path d="M8 23 23 8m-11 0h11v11" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Job Lele
                </h1>
                <p className="site-tagline">
                  Fresh AI, full stack, software, and data jobs in India, for freshers and
                  early career developers.
                </p>
              </div>
              <div className="header-actions">
                <a className="feature-link" href="#guptai">GuptAI</a>
                <ThemeToggle />
                <a
                  className="x-link"
                  href="https://x.com/Aditya_Chawla20"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  @Aditya_Chawla20 on X
                </a>
              </div>
            </div>
          </div>
        </header>
        <main className="container">{children}</main>
        <footer className="site-footer">
          <div className="container">
            <p>
              Every job is verified live before it is listed. Salaries are shown only when
              the listing shows them. Jobs older than 7 days are removed automatically.
            </p>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
