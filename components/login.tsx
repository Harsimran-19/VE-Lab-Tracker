"use client";
import Image from "next/image";
import localFont from "next/font/local";
import { signIn } from "next-auth/react";
import { useState } from "react";

const displayFont = localFont({
  src: "../app/fonts/source-serif-400.ttf",
  weight: "400",
  display: "swap",
  variable: "--login-display-font",
});
const bodyFont = localFont({
  src: [
    { path: "../app/fonts/plex-sans-400.ttf", weight: "400" },
    { path: "../app/fonts/plex-sans-500.ttf", weight: "500" },
  ],
  display: "swap",
  variable: "--login-body-font",
});

export function Login({
  missing,
  error,
  callbackUrl = "/",
}: {
  missing: string[];
  error?: string;
  callbackUrl?: string;
}) {
  const [openingGoogle, setOpeningGoogle] = useState(false);
  const [signInError, setSignInError] = useState(false);

  async function openGoogle() {
    if (openingGoogle) return;
    setOpeningGoogle(true);
    setSignInError(false);
    try {
      await signIn("google", { callbackUrl });
    } catch {
      setOpeningGoogle(false);
      setSignInError(true);
    }
  }

  return (
    <main className={`login-page ${displayFont.variable} ${bodyFont.variable}`}>
      <section className="login-artwork" aria-labelledby="lab-name">
        <Image
          src="/images/sign-in-artwork-original.png"
          alt=""
          fill
          sizes="(max-width: 1000px) 100vw, 61.2vw"
          preload
          unoptimized
          className="login-artwork-image"
        />
        <h1 id="lab-name"><span className="login-name-first"><span>Venture</span>{" "}<span>Engineering</span></span><span className="login-name-last">Lab Tracker</span></h1>
      </section>
      <section className="login-form" aria-labelledby="sign-in-heading">
        <div className="login-content">
          <h2 id="sign-in-heading">Welcome to the lab</h2>
          <p className="login-description">Sign in to open your research workspace.</p>
          {missing.length ? (
            <div className="setup-notice" role="status">
              <strong>Google setup is still needed</strong>
              <p>Your administrator needs to finish setup before you can sign in.</p>
              <details>
                <summary>Administrator setup</summary>
                <ul>{missing.map((key) => <li key={key}><code>{key}</code></li>)}</ul>
              </details>
            </div>
          ) : (
            <button
              type="button"
              className="google-button"
              onClick={openGoogle}
              disabled={openingGoogle}
              aria-busy={openingGoogle}
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                aria-hidden="true"
              >
                <path
                  fill="#4285F4"
                  d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"
                />
                <path
                  fill="#34A853"
                  d="M12 22c2.7 0 4.96-.9 6.62-2.42l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.61 0-4.83-1.77-5.62-4.15H3.04v2.59A10 10 0 0 0 12 22Z"
                />
                <path
                  fill="#FBBC05"
                  d="M6.38 13.88A6 6 0 0 1 6.06 12c0-.65.11-1.29.32-1.88V7.53H3.04A10 10 0 0 0 2 12c0 1.61.39 3.13 1.04 4.47l3.34-2.59Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.97c1.47 0 2.79.5 3.82 1.5l2.86-2.86A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.96 5.53l3.34 2.59C7.17 7.74 9.39 5.97 12 5.97Z"
                />
              </svg>
              <span>{openingGoogle ? "Opening Google…" : "Continue with Google"}</span>
            </button>
          )}
          {(error || signInError) && (
            <p className="login-error" role="alert">
              {error === "AccessDenied"
                ? "Google sign-in or account creation could not be completed. Check Google access and try again."
                : "Sign-in could not be completed. Please try again or ask your administrator for help."}
            </p>
          )}
          {/* <p className="login-note">First time here? Signing in creates your account.</p> */}
        </div>
      </section>
    </main>
  );
}
