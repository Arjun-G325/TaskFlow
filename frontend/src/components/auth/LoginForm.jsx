import React, { useState } from "react";

export default function LoginForm({ onLogin, onError, onMessage }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    onError("");
    onMessage("");
    setBusy(true);
    try {
      await onLogin(username, password);
    } catch (error) {
      onError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label htmlFor="login-username">Username</label>
      <input id="login-username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required minLength={3} maxLength={50} />
      <label htmlFor="login-password">Password</label>
      <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
      <button className="primary-button full-width" type="submit" disabled={busy}>
        {busy ? "Logging in..." : "Log in"}
      </button>
    </form>
  );
}
