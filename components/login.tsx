"use client";
import { signIn } from "next-auth/react";
import { ArrowUpRight, FlaskConical, Check, AlertCircle } from "lucide-react";
export function Login({ missing, error }: { missing: string[]; error?: string }) {
  return <main className="login-page">
    <section className="login-story"><a className="brand" href="/"><span className="brand-icon"><FlaskConical size={22}/></span><span>VE <strong>Lab</strong></span></a>
      <div><p className="eyebrow">VENTURE ENGINEERING LAB</p><h1>More research.<br/>Less reporting.</h1><p className="login-description">A shared home for your projects, people, and the small steps that move big ideas forward.</p>
        <div className="login-points"><p><Check size={18}/> Know what needs your attention</p><p><Check size={18}/> Share progress in a few minutes</p><p><Check size={18}/> Keep the whole lab connected</p></div></div>
      <p className="login-footer">Ideas become progress, together.</p>
    </section>
    <section className="login-form"><div className="login-card"><span className="small-mark"><FlaskConical size={28}/></span><p className="eyebrow">YOUR RESEARCH WORKSPACE</p><h2>Welcome to the lab.</h2><p>Sign in with Google to join the lab and add your work.</p>
      {missing.length ? <div className="setup-notice"><AlertCircle size={20}/><div><strong>Google setup is still needed</strong><p>Your administrator needs to configure:</p><ul>{missing.map(k => <li key={k}><code>{k}</code></li>)}</ul><p>Follow the setup guide included with the project.</p></div></div> : <button className="google-button" onClick={() => signIn("google", { callbackUrl: "/" })}><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.42l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.61 0-4.83-1.77-5.62-4.15H3.04v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.38 13.88A6 6 0 0 1 6.06 12c0-.65.11-1.29.32-1.88V7.53H3.04A10 10 0 0 0 2 12c0 1.61.39 3.13 1.04 4.47l3.34-2.59Z"/><path fill="#EA4335" d="M12 5.97c1.47 0 2.79.5 3.82 1.5l2.86-2.86A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.96 5.53l3.34 2.59C7.17 7.74 9.39 5.97 12 5.97Z"/></svg> Continue with Google <ArrowUpRight size={17}/></button>}
      {error && <p className="error" role="alert">{error === "AccessDenied" ? "Google sign-in or account creation could not be completed. Check Google access and try again." : "Sign-in could not be completed. Please try again or ask the administrator to check Google setup."}</p>}
      <p className="login-note">Your account is created automatically. No invitation or admin approval needed.</p>
    </div></section>
  </main>;
}
