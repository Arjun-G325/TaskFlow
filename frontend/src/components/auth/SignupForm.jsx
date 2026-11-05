import React, { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";

import { registerAccount, sendSignupCode, verifyGoogleSignup, verifySignupCode } from "../../api/auth";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function SignupForm({ onRegistered, onError, onMessage }) {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [signupToken, setSignupToken] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  function clearNotices() {
    onError("");
    onMessage("");
  }

  async function handleSendCode(event) {
    event.preventDefault();
    clearNotices();
    setBusy(true);
    try {
      const result = await sendSignupCode(email);
      onMessage(result.message);
      setStep("code");
    } catch (error) {
      onError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyCode(event) {
    event.preventDefault();
    clearNotices();
    setBusy(true);
    try {
      const result = await verifySignupCode(email, code);
      setSignupToken(result.signup_token);
      setStep("credentials");
      onMessage("Email verified. Choose a username and password.");
    } catch (error) {
      onError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleSignup(response) {
    clearNotices();
    if (!response.credential) {
      onError("Google did not return a verification credential. Please try again.");
      return;
    }
    setBusy(true);
    try {
      const result = await verifyGoogleSignup(response.credential);
      setEmail(result.email);
      setSignupToken(result.signup_token);
      setStep("credentials");
      onMessage("Google verified your email. Choose a username and password.");
    } catch (error) {
      onError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    clearNotices();
    setBusy(true);
    try {
      await registerAccount(signupToken, username, password);
      onRegistered();
    } catch (error) {
      onError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {step === "email" && (
        <>
          <form className="auth-form" onSubmit={handleSendCode}>
            <label htmlFor="signup-email">Email address</label>
            <input id="signup-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            <button className="primary-button full-width" type="submit" disabled={busy}>
              {busy ? "Sending..." : "Send verification code"}
            </button>
          </form>
          {GOOGLE_CLIENT_ID && (
            <>
              <div className="auth-divider"><span>or sign up with</span></div>
              <div className="google-button">
                <GoogleLogin
                  onSuccess={handleGoogleSignup}
                  onError={() => onError("Google signup could not be completed. Please try again.")}
                  text="signup_with"
                  shape="rectangular"
                  width="320"
                />
              </div>
            </>
          )}
        </>
      )}

      {step === "code" && (
        <form className="auth-form" onSubmit={handleVerifyCode}>
          <label htmlFor="signup-code">Six-digit email code</label>
          <input id="signup-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} required />
          <button className="primary-button full-width" type="submit" disabled={busy}>
            {busy ? "Checking..." : "Verify email"}
          </button>
          <button className="text-button" type="button" onClick={() => { setStep("email"); clearNotices(); }}>
            Use a different email
          </button>
        </form>
      )}

      {step === "credentials" && (
        <form className="auth-form" onSubmit={handleRegister}>
          <label htmlFor="signup-username">Username</label>
          <input id="signup-username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required minLength={3} maxLength={50} pattern="[A-Za-z0-9_]+" />
          <small className="field-help">Use 3-50 letters, numbers, or underscores.</small>
          <label htmlFor="signup-password">Password</label>
          <input id="signup-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} maxLength={128} />
          <button className="primary-button full-width" type="submit" disabled={busy}>
            {busy ? "Creating account..." : "Create account"}
          </button>
        </form>
      )}
    </>
  );
}
