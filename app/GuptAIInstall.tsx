"use client";

import { useState } from "react";

const MAC_CMD =
  "curl -fSL https://guptai.vercel.app/install.sh -o install-guptai-mac.sh && bash install-guptai-mac.sh";
const MAC_DISPLAY =
  "curl -fSL https://guptai.vercel.app/install.sh -o install-guptai-mac.sh &&\nbash install-guptai-mac.sh";
const WIN_CMD =
  'Invoke-WebRequest -Uri https://guptai.vercel.app/install.ps1 -OutFile "$env:TEMP\\guptai-install.ps1" -UseBasicParsing; if ($?) { powershell -NoProfile -ExecutionPolicy Bypass -File "$env:TEMP\\guptai-install.ps1" }';

type Os = "mac" | "windows";

export default function GuptAIInstall() {
  const [os, setOs] = useState<Os>("mac");
  const [copied, setCopied] = useState(false);

  const command = os === "mac" ? MAC_CMD : WIN_CMD;
  const display = os === "mac" ? MAC_DISPLAY : WIN_CMD;

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
    } catch {
      const area = document.createElement("textarea");
      area.value = command;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="guptai-section" aria-labelledby="guptai-heading">
      <h2 id="guptai-heading">
        <a href="https://guptai.vercel.app" target="_blank" rel="noopener noreferrer">
          Gupt-AI
        </a>
      </h2>
      <p className="guptai-desc">
        A real-time AI assistant for your meetings, interviews, and sales calls.
        Download and install it free:
      </p>
      <div className="install-tabs" role="tablist" aria-label="Operating system">
        <button
          type="button"
          role="tab"
          aria-selected={os === "mac"}
          className={os === "mac" ? "install-tab active" : "install-tab"}
          onClick={() => setOs("mac")}
        >
          macOS
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={os === "windows"}
          className={os === "windows" ? "install-tab active" : "install-tab"}
          onClick={() => setOs("windows")}
        >
          Windows
        </button>
      </div>
      <div className="install-box">
        <pre className="install-code">{display}</pre>
        <button type="button" className="copy-btn" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="install-note">
        {os === "mac"
          ? "Run this in Terminal."
          : "Paste this in PowerShell."}
      </p>
    </section>
  );
}
