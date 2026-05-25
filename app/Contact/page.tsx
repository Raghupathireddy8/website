"use client";

import { useState } from "react";

export default function ContactPage() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [confirmedEmail, setConfirmedEmail] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fname = (form.elements.namedItem("fname") as HTMLInputElement).value.trim();
    const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();
    const msg = (form.elements.namedItem("message") as HTMLTextAreaElement).value.trim();

    if (!fname || !email || !msg) {
      setError("Please fill in all required fields.");
      return;
    }
    setError("");
    setSubmitting(true);
    // Replace setTimeout with your real endpoint / EmailJS / Formspree call
    setTimeout(() => {
      setConfirmedEmail(email);
      setSubmitting(false);
      setSubmitted(true);
    }, 1200);
  }

  return (
    <>
      <style>{`
        :root {
          --brand:       #2d4af0;
          --brand-light: #4f6bff;
          --brand-dim:   rgba(45,74,240,0.15);
          --bg:          #050c1a;
          --surface:     #0b1628;
          --surface2:    #101e35;
          --border:      rgba(255,255,255,0.07);
          --text:        #e8edf8;
          --muted:       #7a8aaa;
          --success:     #22d397;
          --accent:      #f0a020;
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body {
          font-family: 'DM Sans', sans-serif;
          background: var(--bg);
          color: var(--text);
          min-height: 100vh;
          overflow-x: hidden;
        }

        /* NAV */
        .mg-nav {
          position: sticky; top: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 2rem;
          height: 62px;
          background: rgba(5,12,26,0.85);
          backdrop-filter: blur(14px);
          border-bottom: 1px solid var(--border);
        }
        .mg-nav-logo {
          font-family: 'Syne', sans-serif;
          font-weight: 800; font-size: 1.25rem;
          color: var(--text); text-decoration: none;
          display: flex; align-items: center; gap: .5rem;
        }
        .mg-nav-logo span { color: var(--brand-light); }
        .mg-nav-links { display: flex; gap: 1.5rem; }
        .mg-nav-links a {
          color: var(--muted); text-decoration: none;
          font-size: .9rem; font-weight: 500;
          transition: color .2s;
        }
        .mg-nav-links a:hover { color: var(--text); }
        .mg-nav-cta {
          background: var(--brand);
          color: #fff; text-decoration: none;
          padding: .45rem 1.1rem; border-radius: 8px;
          font-size: .85rem; font-weight: 600;
          transition: background .2s, transform .15s;
        }
        .mg-nav-cta:hover { background: var(--brand-light); transform: translateY(-1px); }

        /* HERO BAND */
        .mg-hero {
          position: relative;
          padding: 5rem 2rem 3.5rem;
          text-align: center;
          overflow: hidden;
        }
        .mg-hero::before {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(ellipse 70% 60% at 50% 0%, rgba(45,74,240,.22) 0%, transparent 70%);
          pointer-events: none;
        }
        .mg-eyebrow {
          display: inline-flex; align-items: center; gap: .5rem;
          background: var(--brand-dim);
          border: 1px solid rgba(45,74,240,.35);
          color: var(--brand-light);
          padding: .3rem .9rem; border-radius: 50px;
          font-size: .78rem; font-weight: 600; letter-spacing: .08em;
          text-transform: uppercase; margin-bottom: 1.2rem;
        }
        .mg-hero h1 {
          font-family: 'Syne', sans-serif;
          font-size: clamp(2rem, 5vw, 3.2rem);
          font-weight: 800;
          line-height: 1.1;
          margin-bottom: .9rem;
        }
        .mg-hero h1 em { font-style: normal; color: var(--brand-light); }
        .mg-hero p {
          color: var(--muted); font-size: 1rem; max-width: 480px; margin: 0 auto;
          line-height: 1.7;
        }

        /* LAYOUT */
        .mg-contact-wrapper {
          max-width: 1100px; margin: 0 auto;
          padding: 1rem 2rem 6rem;
          display: grid;
          grid-template-columns: 1fr 1.4fr;
          gap: 3rem;
          align-items: start;
        }

        /* INFO CARDS */
        .mg-info-col { display: flex; flex-direction: column; gap: 1.2rem; }
        .mg-info-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 1.6rem;
          transition: border-color .25s, transform .25s;
        }
        .mg-info-card:hover {
          border-color: rgba(45,74,240,.4);
          transform: translateY(-2px);
        }
        .mg-icon {
          width: 44px; height: 44px; border-radius: 12px;
          background: var(--brand-dim);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.3rem; margin-bottom: 1rem;
        }
        .mg-info-card h3 {
          font-family: 'Syne', sans-serif;
          font-size: 1rem; font-weight: 700;
          margin-bottom: .4rem;
        }
        .mg-info-card p {
          font-size: .88rem; color: var(--muted); line-height: 1.6;
        }
        .mg-info-card a {
          color: var(--brand-light); text-decoration: none; font-weight: 500;
        }
        .mg-info-card a:hover { text-decoration: underline; }

        .mg-response-badge {
          display: inline-flex; align-items: center; gap: .4rem;
          background: rgba(34,211,151,.1);
          border: 1px solid rgba(34,211,151,.25);
          color: var(--success);
          padding: .25rem .75rem; border-radius: 50px;
          font-size: .75rem; font-weight: 600; margin-top: .8rem;
        }
        .mg-response-badge::before {
          content: ''; width: 6px; height: 6px;
          border-radius: 50%; background: var(--success);
          animation: mg-pulse 2s infinite;
        }
        @keyframes mg-pulse {
          0%,100% { opacity: 1; } 50% { opacity: .3; }
        }

        .mg-disclaimer-card {
          background: rgba(240,160,32,.06);
          border: 1px solid rgba(240,160,32,.2);
        }
        .mg-disclaimer-card .mg-icon { background: rgba(240,160,32,.12); }
        .mg-disclaimer-card h3 { color: var(--accent); }

        /* FORM */
        .mg-form-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 2.4rem;
        }
        .mg-form-card h2 {
          font-family: 'Syne', sans-serif;
          font-size: 1.4rem; font-weight: 700;
          margin-bottom: .3rem;
        }
        .mg-sub {
          color: var(--muted); font-size: .88rem; margin-bottom: 2rem;
        }

        .mg-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .mg-field { display: flex; flex-direction: column; gap: .45rem; margin-bottom: 1.1rem; }
        .mg-field label {
          font-size: .8rem; font-weight: 600;
          color: var(--muted); letter-spacing: .04em; text-transform: uppercase;
        }
        .mg-field input,
        .mg-field select,
        .mg-field textarea {
          background: var(--surface2);
          border: 1px solid var(--border);
          border-radius: 10px;
          color: var(--text);
          font-family: 'DM Sans', sans-serif;
          font-size: .92rem;
          padding: .75rem 1rem;
          transition: border-color .2s, box-shadow .2s;
          outline: none;
          width: 100%;
        }
        .mg-field input::placeholder,
        .mg-field textarea::placeholder { color: var(--muted); }
        .mg-field input:focus,
        .mg-field select:focus,
        .mg-field textarea:focus {
          border-color: var(--brand);
          box-shadow: 0 0 0 3px rgba(45,74,240,.15);
        }
        .mg-field select option { background: var(--surface2); }
        .mg-field textarea { resize: vertical; min-height: 130px; }

        .mg-error {
          color: #ff6b6b;
          font-size: .82rem;
          margin-bottom: .8rem;
        }

        .mg-submit-btn {
          width: 100%;
          background: var(--brand);
          color: #fff;
          border: none;
          border-radius: 12px;
          font-family: 'DM Sans', sans-serif;
          font-size: 1rem; font-weight: 600;
          padding: .9rem;
          cursor: pointer;
          transition: background .2s, transform .15s, box-shadow .2s;
          margin-top: .4rem;
        }
        .mg-submit-btn:hover:not(:disabled) {
          background: var(--brand-light);
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(45,74,240,.35);
        }
        .mg-submit-btn:disabled { opacity: .7; cursor: not-allowed; }

        /* SUCCESS */
        .mg-success {
          display: flex;
          flex-direction: column; align-items: center;
          gap: .8rem; text-align: center;
          padding: 2.5rem 1rem;
        }
        .mg-success .mg-check {
          width: 64px; height: 64px; border-radius: 50%;
          background: rgba(34,211,151,.12);
          display: flex; align-items: center; justify-content: center;
          font-size: 2rem;
        }
        .mg-success h3 {
          font-family: 'Syne', sans-serif; font-size: 1.3rem; font-weight: 700;
        }
        .mg-success p { color: var(--muted); font-size: .9rem; }

        /* FOOTER */
        .mg-footer {
          background: var(--surface);
          border-top: 1px solid var(--border);
          padding: 2rem;
          text-align: center;
          color: var(--muted); font-size: .82rem;
        }
        .mg-footer a { color: var(--brand-light); text-decoration: none; }
        .mg-footer a:hover { text-decoration: underline; }
        .mg-footer-links {
          display: flex; justify-content: center; gap: 1.5rem;
          flex-wrap: wrap; margin-bottom: .8rem;
        }

        /* RESPONSIVE */
        @media (max-width: 768px) {
          .mg-contact-wrapper { grid-template-columns: 1fr; gap: 2rem; }
          .mg-field-row { grid-template-columns: 1fr; }
          .mg-nav-links { display: none; }
          .mg-form-card { padding: 1.6rem; }
        }
      `}</style>

      <link
        rel="preconnect"
        href="https://fonts.googleapis.com"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,400&display=swap"
        rel="stylesheet"
      />

      {/* NAV */}
      <nav className="mg-nav">
        <a href="https://www.marketgreeks.com/" className="mg-nav-logo">
          Market<span>Greeks</span>
        </a>
        <div className="mg-nav-links">
          <a href="https://www.marketgreeks.com/options">Options</a>
          <a href="https://www.marketgreeks.com/screener">Screener</a>
          <a href="https://www.marketgreeks.com/ipo">IPO</a>
          <a href="https://www.marketgreeks.com/about">About</a>
        </div>
        <a href="https://t.me/marketgreeks" className="mg-nav-cta">
          Join Telegram
        </a>
      </nav>

      {/* HERO */}
      <div className="mg-hero">
        <div className="mg-eyebrow">📬 Contact Us</div>
        <h1>
          We&apos;d love to <em>hear from you</em>
        </h1>
        <p>Questions, feedback, bug reports or partnership ideas — our team is here to help.</p>
      </div>

      {/* MAIN */}
      <div className="mg-contact-wrapper">

        {/* LEFT: Info */}
        <div className="mg-info-col">

          <div className="mg-info-card">
            <div className="mg-icon">✉️</div>
            <h3>Email Support</h3>
            <p>
              For all queries, write to us at<br />
              <a href="mailto:support@marketgreeks.com">support@marketgreeks.com</a>
            </p>
            <div className="mg-response-badge">Typically replies within 24–48 hours</div>
          </div>

          <div className="mg-info-card">
            <div className="mg-icon">💬</div>
            <h3>Telegram Community</h3>
            <p>
              Join our active Telegram channel for live market alerts, IPO GMP updates,
              and quick answers from the community.
            </p>
            <p style={{ marginTop: ".6rem" }}>
              <a href="https://t.me/marketgreeks" target="_blank" rel="noreferrer">
                @marketgreeks →
              </a>
            </p>
          </div>

          <div className="mg-info-card">
            <div className="mg-icon">🤝</div>
            <h3>Partnerships &amp; Collaboration</h3>
            <p>
              Interested in featuring your fintech product, data partnership, or content
              collaboration? Let&apos;s talk.
            </p>
            <p style={{ marginTop: ".6rem" }}>
              <a href="mailto:support@marketgreeks.com?subject=Partnership Inquiry">
                support@marketgreeks.com
              </a>
            </p>
          </div>

          <div className="mg-info-card mg-disclaimer-card">
            <div className="mg-icon">⚠️</div>
            <h3>Important Disclaimer</h3>
            <p>
              MarketGreeks is not a SEBI-registered investment advisor. All tools and
              content are for <strong>educational purposes only</strong>. Please consult
              a SEBI-registered advisor before making investment decisions. Market data
              may be delayed by up to 15 minutes.
            </p>
          </div>

        </div>

        {/* RIGHT: Form */}
        <div className="mg-form-card">
          <h2>Send us a message</h2>
          <p className="mg-sub">Fill in the details below and we&apos;ll get back to you shortly.</p>

          {submitted ? (
            <div className="mg-success">
              <div className="mg-check">✅</div>
              <h3>Message received!</h3>
              <p>
                Thanks for reaching out. We&apos;ll respond to{" "}
                <strong>{confirmedEmail}</strong> within 24–48 hours.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div className="mg-field-row">
                <div className="mg-field">
                  <label htmlFor="fname">First Name</label>
                  <input type="text" id="fname" name="fname" placeholder="Arjun" required />
                </div>
                <div className="mg-field">
                  <label htmlFor="lname">Last Name</label>
                  <input type="text" id="lname" name="lname" placeholder="Sharma" />
                </div>
              </div>

              <div className="mg-field">
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="arjun@example.com"
                  required
                />
              </div>

              <div className="mg-field">
                <label htmlFor="subject">Subject</label>
                <select id="subject" name="subject" defaultValue="">
                  <option value="" disabled>Select a topic</option>
                  <option>General Inquiry</option>
                  <option>Bug Report</option>
                  <option>Feature Request</option>
                  <option>Data / Market Data Issue</option>
                  <option>Partnership / Collaboration</option>
                  <option>IPO Information</option>
                  <option>Options Tools</option>
                  <option>Other</option>
                </select>
              </div>

              <div className="mg-field">
                <label htmlFor="message">Message</label>
                <textarea
                  id="message"
                  name="message"
                  placeholder="Describe your query in detail…"
                  required
                />
              </div>

              {error && <p className="mg-error">{error}</p>}

              <button type="submit" className="mg-submit-btn" disabled={submitting}>
                {submitting ? "Sending…" : "Send Message →"}
              </button>
            </form>
          )}
        </div>

      </div>

      {/* FOOTER */}
      <footer className="mg-footer">
        <div className="mg-footer-links">
          <a href="https://www.marketgreeks.com/">Home</a>
          <a href="https://www.marketgreeks.com/ipo">IPO</a>
          <a href="https://www.marketgreeks.com/screener">Screener</a>
          <a href="https://www.marketgreeks.com/about">About</a>
          <a href="/contact">Contact Us</a>
          <a href="/terms">Terms &amp; Conditions</a>
        </div>
        <p>© 2026 MarketGreeks. Not SEBI registered. For educational purposes only.</p>
        <p style={{ marginTop: ".4rem" }}>Data delayed by 15 minutes. Not investment advice.</p>
      </footer>
    </>
  );
}
