"use client";

import { useState } from "react";

const MAC_CMD =
  "curl -fSL https://guptai.vercel.app/install.sh -o install-guptai-mac.sh && bash install-guptai-mac.sh";
const WIN_CMD =
  'Invoke-WebRequest -Uri https://guptai.vercel.app/install.ps1 -OutFile "$env:TEMP\\guptai-install.ps1" -UseBasicParsing; if ($?) { powershell -NoProfile -ExecutionPolicy Bypass -File "$env:TEMP\\guptai-install.ps1" }';

type Os = "mac" | "windows";

export default function GuptAIInstall() {
  const [os, setOs] = useState<Os>("mac");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const command = os === "mac" ? MAC_CMD : WIN_CMD;

  function selectOs(next: Os) {
    setOs(next);
    setCopyStatus("idle");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  }

  return (
    <aside className="guptai-section" id="guptai" tabIndex={-1} aria-labelledby="guptai-heading">
      <h2 id="guptai-heading">
        <a href="https://guptai.vercel.app" target="_blank" rel="noopener noreferrer">
          GuptAI
        </a>
      </h2>
      <p className="guptai-headline">Real Time Interview Assistant</p>
      <p className="guptai-desc">
        Invisible on screen share, Live Answers of the Questions Asked
      </p>
      <a className="button button-primary guide-btn" href="https://guptai.vercel.app" target="_blank" rel="noopener noreferrer">
        See how Gupt-AI works
        <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 15 15 5M7 5h8v8" />
        </svg>
      </a>

      <details className="quick-commands" open>
        <summary>Install commands</summary>
        <div className="install-tabs" role="group" aria-label="Operating system">
          <button type="button" aria-pressed={os === "mac"} className="install-tab" onClick={() => selectOs("mac")}>
            macOS
          </button>
          <button type="button" aria-pressed={os === "windows"} className="install-tab" onClick={() => selectOs("windows")}>
            Windows
          </button>
        </div>
        <p className="install-note">
          {os === "mac" ? "Run in Terminal on an Apple Silicon Mac." : "Run in PowerShell on Windows."}
        </p>
        <div className="install-box">
          <pre className="install-code"><code>{command}</code></pre>
          <button type="button" className="button copy-btn" onClick={copy}>
            {copyStatus === "copied" ? "Copied" : "Copy command"}
          </button>
        </div>
        <p className={copyStatus === "error" ? "install-note" : "visually-hidden"} role="status">
          {copyStatus === "error" ? "Clipboard unavailable. Select and copy the command above." : copyStatus === "copied" ? "Command copied to your clipboard." : ""}
        </p>
      </details>
    </aside>
  );
}
