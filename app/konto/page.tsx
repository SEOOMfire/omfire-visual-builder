"use client";

import { useState } from "react";

export default function AccountPage() {
  const [name, setName] = useState("Langdock");
  const [secret, setSecret] = useState("");
  const [message, setMessage] = useState("");

  async function createToken() {
    setMessage("");
    const response = await fetch("/api/account/tokens", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const body = await response.json() as { secret?: string; message?: string };
    if (!response.ok) {
      setMessage(body.message ?? "Der Schlüssel konnte nicht angelegt werden.");
      return;
    }
    setSecret(body.secret ?? "");
    setMessage(body.message ?? "");
  }

  return (
    <main style={{ maxWidth: 640, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>API-Schlüssel</h1>
      <p>Der Schlüssel gilt für dein Konto. Er wird nur direkt nach dem Anlegen gezeigt.</p>
      <label>
        Name
        <input value={name} onChange={(event) => setName(event.target.value)} style={{ display: "block", margin: "8px 0 16px", width: "100%" }} />
      </label>
      <button type="button" onClick={() => void createToken()}>Schlüssel erzeugen</button>
      {secret ? <textarea readOnly value={secret} style={{ display: "block", width: "100%", marginTop: 16 }} rows={3} /> : null}
      {message ? <p>{message}</p> : null}
    </main>
  );
}
