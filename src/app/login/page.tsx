"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import SplashScreen from "@/components/SplashScreen";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const forceSplash = urlParams.get("splash") === "true";
      const seen = sessionStorage.getItem("navsense_splash_seen");

      if (forceSplash || !seen) {
        setShowSplash(true);
      }
    } catch {
      // Ignore if sessionStorage is unavailable
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      router.push("/dashboard");
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to send reset link");
      } else {
        setMessage("Password reset link sent to your email.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {showSplash && (
        <SplashScreen
          autoRedirect={false}
          onComplete={() => setShowSplash(false)}
        />
      )}

      <div className="login-container">
        <div className="login-card animate-in">
          <h1>NavSense</h1>
          <p>Smart Campus Monitoring System</p>

          {error && <div className="login-error">{error}</div>}
          {message && <div style={{ color: "green", marginBottom: "1rem" }}>{message}</div>}

          {!isForgotPassword ? (
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="admin@navsense.io"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </button>
              <div
                style={{
                  marginTop: "1.2rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 13,
                }}
              >
                <button
                  type="button"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--accent-blue, #00ADB5)",
                    cursor: "pointer",
                    padding: 0,
                    fontSize: 13,
                  }}
                  onClick={() => setIsForgotPassword(true)}
                >
                  Forgot Password?
                </button>

                <button
                  type="button"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-muted, #8a8f98)",
                    cursor: "pointer",
                    padding: 0,
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                  onClick={() => setShowSplash(true)}
                  title="Replay intro splash animation"
                >
                  <span>⚡ Intro Splash</span>
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleForgotPassword}>
              <div className="form-group">
                <label className="form-label">Enter your Email</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="admin@navsense.io"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
              <div style={{ marginTop: "1rem", textAlign: "center" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ background: "transparent", border: "none", color: "var(--text-muted)" }}
                  onClick={() => {
                    setIsForgotPassword(false);
                    setError("");
                    setMessage("");
                  }}
                >
                  Back to Login
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
