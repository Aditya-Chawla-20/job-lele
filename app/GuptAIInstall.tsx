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
      <p className="guptai-headline">Your next interview starts with practice.</p>
      <p className="guptai-desc">
        Use GuptAI for live transcription and AI help on calls. Try it in a mock interview to practice answering questions out loud.
      </p>
      <a className="guide-btn" href="https://guptai.vercel.app/docs" target="_blank" rel="noopener noreferrer">
        Read the install guide
        <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 15 15 5M7 5h8v8" />
        </svg>
      </a>

      <details className="quick-commands">
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
          <button type="button" className="copy-btn" onClick={copy}>
            {copyStatus === "copied" ? "Copied" : "Copy command"}
          </button>
        </div>
        <span className={copyStatus === "error" ? "install-note copy-error" : "visually-hidden"} role="status">
          {copyStatus === "error" ? "Clipboard unavailable. Select and copy the command above." : copyStatus === "copied" ? "Command copied to your clipboard." : ""}
        </span>
      </details>

    </aside>
  );
}
