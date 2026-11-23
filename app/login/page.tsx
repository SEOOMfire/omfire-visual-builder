"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: password || undefined }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string; ok?: boolean };
      if (!response.ok) {
        setMessage(body.error || "Anmeldung abgelehnt.");
        return;
      }
      if (password) {
        window.location.assign("/visual-builder");
        return;
      }
      setMessage("Wenn das Konto freigeschaltet ist, liegt der Zugang in deinem Postfach.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="login-card" onSubmit={(event) => void submit(event)}>
      <h1>Visual Builder</h1>
      <p>Anmeldung für OMfire.</p>
      <label>
        E-Mail
        <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </label>
      <label>
        Passwort, falls eingerichtet
        <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
      </label>
      <button className="primary-button" type="submit" disabled={busy}>{busy ? "…" : "Weiter"}</button>
      {message && <p>{message}</p>}
    </form>
  );
}
