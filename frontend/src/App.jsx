import React, { useEffect, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.detail || "The request could not be completed.");
  }
  return body;
}

export default function App() {
  const [page, setPage] = useState("login");
  const [signupStep, setSignupStep] = useState("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [signupToken, setSignupToken] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadCurrentUser(token) {
    const account = await request("/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    setUser(account);
  }

  useEffect(() => {
    const savedToken = localStorage.getItem("taskflow_access_token");
    if (!savedToken) return;

    loadCurrentUser(savedToken).catch(() => {
      localStorage.removeItem("taskflow_access_token");
    });
  }, []);

  function clearNotices() {
    setError("");
    setMessage("");
  }

  async function handleSendCode(event) {
    event.preventDefault();
    clearNotices();
    setBusy(true);
    try {
      const result = await request("/auth/email-code", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMessage(result.message);
      setSignupStep("code");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyCode(event) {
    event.preventDefault();
    clearNotices();
    setBusy(true);
    try {
      const result = await request("/auth/email-code/verify", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      setSignupToken(result.signup_token);
      setSignupStep("credentials");
      setMessage("Email verified. Choose a username and password.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleSignup(googleResponse) {
    clearNotices();
    if (!googleResponse.credential) {
      setError("Google did not return a verification credential. Please try again.");
      return;
    }

    setBusy(true);
    try {
      const result = await request("/auth/google", {
        method: "POST",
        body: JSON.stringify({ credential: googleResponse.credential }),
      });
      setEmail(result.email);
      setSignupToken(result.signup_token);
      setSignupStep("credentials");
      setMessage("Google verified your email. Choose a username and password.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    clearNotices();
    setBusy(true);
    try {
      await request("/auth/register", {
        method: "POST",
        body: JSON.stringify({ signup_token: signupToken, username, password }),
      });
      setPage("login");
      setSignupStep("email");
      setPassword("");
      setCode("");
      setMessage("Account created. Log in with your new username and password.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    clearNotices();
    setBusy(true);
    try {
      const result = await request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      localStorage.setItem("taskflow_access_token", result.access_token);
      await loadCurrentUser(result.access_token);
      setPassword("");
    } catch (err) {
      localStorage.removeItem("taskflow_access_token");
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("taskflow_access_token");
    setUser(null);
    setUsername("");
    setPassword("");
    setMessage("You have been logged out.");
  }

  if (user) {
    return (
      <main className="auth-page">
        <section className="auth-card account-card">
          <Brand />
          <div className="success-mark" aria-hidden="true">✓</div>
          <p className="eyebrow">SIGNED IN</p>
          <h1>Welcome, {user.username}</h1>
          <p className="auth-subtitle">Your login token was accepted. The backend identified this account:</p>
          <dl className="account-details">
            <div><dt>Username</dt><dd>{user.username}</dd></div>
            <div><dt>Email</dt><dd>{user.email}</dd></div>
            <div><dt>User ID</dt><dd>{user.id}</dd></div>
          </dl>
          <button className="primary-button full-width" onClick={handleLogout}>Log out</button>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Brand />
        <p className="eyebrow">YOUR TEAM WORKSPACE</p>
        <h1>{page === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="auth-subtitle">
          {page === "login" ? "Log in to continue to TaskFlow." : "Verify your email, then choose your login details."}
        </p>

        {error && <div className="notice error-notice" role="alert">{error}</div>}
        {message && <div className="notice success-notice" role="status">{message}</div>}

        {page === "login" ? (
          <form className="auth-form" onSubmit={handleLogin}>
            <label htmlFor="login-username">Username</label>
            <input id="login-username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required minLength={3} maxLength={50} />
            <label htmlFor="login-password">Password</label>
            <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            <button className="primary-button full-width" type="submit" disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>
          </form>
        ) : (
          <>
            {signupStep === "email" && (
              <>
                <form className="auth-form" onSubmit={handleSendCode}>
                  <label htmlFor="signup-email">Email address</label>
                  <input id="signup-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                  <button className="primary-button full-width" type="submit" disabled={busy}>{busy ? "Sending…" : "Send verification code"}</button>
                </form>
                {GOOGLE_CLIENT_ID && (
                  <>
                    <div className="auth-divider"><span>or sign up with</span></div>
                    <div className="google-button">
                      <GoogleLogin
                        onSuccess={handleGoogleSignup}
                        onError={() => setError("Google signup could not be completed. Please try again.")}
                        text="signup_with"
                        shape="rectangular"
                        width="320"
                      />
                    </div>
                  </>
                )}
              </>
            )}
            {signupStep === "code" && (
              <form className="auth-form" onSubmit={handleVerifyCode}>
                <label htmlFor="signup-code">Six-digit email code</label>
                <input id="signup-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} required />
                <button className="primary-button full-width" type="submit" disabled={busy}>{busy ? "Checking…" : "Verify email"}</button>
                <button className="text-button" type="button" onClick={() => { setSignupStep("email"); clearNotices(); }}>Use a different email</button>
              </form>
            )}
            {signupStep === "credentials" && (
              <form className="auth-form" onSubmit={handleRegister}>
                <label htmlFor="signup-username">Username</label>
                <input id="signup-username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required minLength={3} maxLength={50} pattern="[A-Za-z0-9_]+" />
                <small className="field-help">Use 3–50 letters, numbers, or underscores.</small>
                <label htmlFor="signup-password">Password</label>
                <input id="signup-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} maxLength={128} />
                <button className="primary-button full-width" type="submit" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
              </form>
            )}
          </>
        )}

        <div className="auth-switch">
          {page === "login" ? "New to TaskFlow?" : "Already have an account?"}
          <button type="button" onClick={() => { setPage(page === "login" ? "signup" : "login"); setSignupStep("email"); clearNotices(); }}>
            {page === "login" ? "Sign up" : "Log in"}
          </button>
        </div>
      </section>
    </main>
  );
}

function Brand() {
  return <a className="auth-brand" href="#home"><span className="brand-mark">T</span><span>taskflow</span></a>;
}
