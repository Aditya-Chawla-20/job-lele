import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Lele - Fresher jobs in India",
  description:
    "Fresh AI, full stack, software, and data jobs in India for freshers and early career developers. Every job verified live before listing.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="container">
            <div className="header-row">
              <div>
                <p className="site-name">Job Lele</p>
                <p className="site-tagline">
                  Fresh AI, full stack, software, and data jobs in India, for freshers and
                  early career developers.
                </p>
              </div>
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
