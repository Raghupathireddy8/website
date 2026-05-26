"use client";

import { useState } from "react";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) return;
    setStatus("sending");
    try {
      const mailtoLink = `mailto:support@marketgreeks.com?subject=${encodeURIComponent(
        formData.subject || "Contact Form Inquiry"
      )}&body=${encodeURIComponent(
        `Name: ${formData.name}\nEmail: ${formData.email}\n\n${formData.message}`
      )}`;
      window.location.href = mailtoLink;
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  const isFormValid = formData.name && formData.email && formData.message;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg:        #0b0e1a;
          --bg-card:   #111527;
          --bg-input:  #161a2e;
          --border:    #1e2440;
          --border-focus: #2d4af0;
          --blue:      #2d4af0;
          --blue-hover:#3d5aff;
          --blue-glow: rgba(45,74,240,0.18);
          --text:      #e8ecf5;
          --muted:     #6b7498;
          --label:     #9099bd;
          --success-bg:#0d1f2d;
          --success:   #3dd68c;
          --error-bg:  #1e0d0d;
          --error:     #f06060;
          --font:      'Inter', system-ui, sans-serif;
        }

        .contact-page {
          min-height: 100vh;
          background: var(--bg);
          font-family: var(--font);
          color: var(--text);
          padding: 0 1.25rem 5rem;
        }

        /* ── TOP NAV STRIP (matches site's beta banner style) ─────── */
        .contact-topbar {
          text-align: center;
          background: linear-gradient(90deg, #1a2050, #0d1230, #1a2050);
          border-bottom: 1px solid var(--border);
          padding: 0.6rem 1rem;
          font-size: 0.78rem;
          color: var(--label);
          letter-spacing: 0.01em;
        }
        .contact-topbar a {
          color: var(--blue-hover);
          text-decoration: none;
          font-weight: 500;
        }

        /* ── PAGE HEADER ──────────────────────────────────────────── */
        .contact-header {
          max-width: 900px;
          margin: 3.5rem auto 0;
          text-align: center;
        }

        .contact-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--blue-hover);
          background: var(--blue-glow);
          border: 1px solid rgba(45,74,240,0.3);
          border-radius: 100px;
          padding: 0.35rem 0.9rem;
          margin-bottom: 1.25rem;
        }

        .contact-header h1 {
          font-size: clamp(2rem, 5vw, 3rem);
          font-weight: 700;
          line-height: 1.15;
          letter-spacing: -0.02em;
          color: var(--text);
          margin-bottom: 0.9rem;
        }

        .contact-header h1 span {
          background: linear-gradient(135deg, #2d4af0, #7c9eff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .contact-header p {
          font-size: 0.97rem;
          color: var(--muted);
          line-height: 1.7;
          max-width: 520px;
          margin: 0 auto 2.5rem;
        }

        /* ── QUICK INFO CHIPS ─────────────────────────────────────── */
        .contact-chips {
          display: flex;
          justify-content: center;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-bottom: 3rem;
        }

        .chip {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          font-size: 0.78rem;
          font-weight: 500;
          color: var(--label);
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 0.5rem 0.9rem;
        }

        .chip-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--success);
          box-shadow: 0 0 6px var(--success);
          flex-shrink: 0;
        }

        /* ── LAYOUT GRID ──────────────────────────────────────────── */
        .contact-grid {
          max-width: 900px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 260px 1fr;
          gap: 1.5rem;
          align-items: start;
        }

        @media (max-width: 680px) {
          .contact-grid {
            grid-template-columns: 1fr;
          }
        }

        /* ── SIDEBAR CARDS ────────────────────────────────────────── */
        .sidebar {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .info-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 1.25rem;
        }

        .info-card-icon {
          font-size: 1.3rem;
          margin-bottom: 0.6rem;
        }

        .info-card-label {
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 0.3rem;
        }

        .info-card-value {
          font-size: 0.9rem;
          font-weight: 500;
          color: var(--text);
          line-height: 1.5;
        }

        .info-card-value a {
          color: var(--blue-hover);
          text-decoration: none;
        }

        .info-card-value a:hover {
          text-decoration: underline;
        }

        .telegram-card {
          background: linear-gradient(135deg, #0d1845 0%, #111527 100%);
          border: 1px solid rgba(45,74,240,0.35);
          border-radius: 14px;
          padding: 1.25rem;
          text-align: center;
        }

        .telegram-card p {
          font-size: 0.82rem;
          color: var(--label);
          margin-bottom: 0.9rem;
          line-height: 1.5;
        }

        .telegram-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          font-size: 0.8rem;
          font-weight: 600;
          color: #fff;
          background: var(--blue);
          border: none;
          border-radius: 8px;
          padding: 0.6rem 1.1rem;
          text-decoration: none;
          transition: background 0.2s;
          cursor: pointer;
        }

        .telegram-btn:hover {
          background: var(--blue-hover);
        }

        /* ── FORM CARD ────────────────────────────────────────────── */
        .form-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 2rem;
        }

        .form-title {
          font-size: 1.05rem;
          font-weight: 600;
          color: var(--text);
          margin-bottom: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--border);
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.1rem;
        }

        @media (max-width: 500px) {
          .form-grid { grid-template-columns: 1fr; }
          .form-card { padding: 1.25rem; }
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          margin-bottom: 1.1rem;
        }

        .form-field.full { grid-column: 1 / -1; }

        .form-field label {
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--label);
        }

        .form-field input,
        .form-field select,
        .form-field textarea {
          font-family: var(--font);
          font-size: 0.9rem;
          color: var(--text);
          background: var(--bg-input);
          border: 1px solid var(--border);
          border-radius: 9px;
          padding: 0.72rem 0.95rem;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          width: 100%;
          -webkit-appearance: none;
          appearance: none;
        }

        .form-field input::placeholder,
        .form-field textarea::placeholder {
          color: #3a4060;
        }

        .form-field input:focus,
        .form-field select:focus,
        .form-field textarea:focus {
          border-color: var(--border-focus);
          box-shadow: 0 0 0 3px var(--blue-glow);
        }

        .form-field textarea {
          resize: vertical;
          min-height: 130px;
          line-height: 1.6;
        }

        .form-field select {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%236b7498'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0.9rem center;
          padding-right: 2.2rem;
          cursor: pointer;
        }

        .form-field select option {
          background: #161a2e;
        }

        /* ── SUBMIT ROW ───────────────────────────────────────────── */
        .submit-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding-top: 1.25rem;
          border-top: 1px solid var(--border);
          flex-wrap: wrap;
        }

        .submit-note {
          font-size: 0.75rem;
          color: var(--muted);
        }

        .submit-btn {
          font-family: var(--font);
          font-size: 0.88rem;
          font-weight: 600;
          color: #fff;
          background: var(--blue);
          border: none;
          border-radius: 9px;
          padding: 0.8rem 2rem;
          cursor: pointer;
          transition: background 0.2s, opacity 0.2s, transform 0.1s;
          white-space: nowrap;
          letter-spacing: 0.01em;
        }

        .submit-btn:hover:not(:disabled) {
          background: var(--blue-hover);
          transform: translateY(-1px);
        }

        .submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .submit-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        /* ── STATUS BANNERS ───────────────────────────────────────── */
        .status-banner {
          display: flex;
          align-items: flex-start;
          gap: 0.7rem;
          padding: 0.9rem 1.1rem;
          border-radius: 9px;
          font-size: 0.87rem;
          line-height: 1.5;
          margin-bottom: 1.25rem;
          border: 1px solid;
        }

        .status-banner.sent {
          background: var(--success-bg);
          border-color: rgba(61,214,140,0.3);
          color: var(--success);
        }

        .status-banner.error {
          background: var(--error-bg);
          border-color: rgba(240,96,96,0.3);
          color: var(--error);
        }

        /* ── FOOTER ───────────────────────────────────────────────── */
        .contact-footer {
          max-width: 900px;
          margin: 3rem auto 0;
          padding-top: 1.5rem;
          border-top: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .footer-brand {
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--label);
        }

        .footer-brand span {
          color: var(--blue-hover);
        }

        .footer-disclaimer {
          font-size: 0.72rem;
          color: var(--muted);
        }
      `}</style>

      <div className="contact-page">

        {/* TOP BAR */}
        <div className="contact-topbar">
          🚀 MarketGreeks Beta — Free tools for Indian traders &amp; investors.{" "}
          <a href="https://t.me/marketgreeks" target="_blank" rel="noopener noreferrer">
            Join Telegram for alerts →
          </a>
        </div>

        {/* PAGE HEADER */}
        <div className="contact-header">
          <span className="contact-eyebrow">✉ Contact Us</span>
          <h1>We're here to <span>help you</span></h1>
          <p>
            Got a question about options analytics, IPO data, virtual trading, or anything else?
            Drop us a message and we'll get back within 24–48 hours.
          </p>

          {/* CHIPS */}
          <div className="contact-chips">
            <div className="chip">
              <span className="chip-dot" />
              Support Active
            </div>
            <div className="chip">⏱ Response: 24–48 hrs</div>
            <div className="chip">📍 Bengaluru, India</div>
          </div>
        </div>

        {/* GRID */}
        <div className="contact-grid">

          {/* SIDEBAR */}
          <aside className="sidebar">
            <div className="info-card">
              <div className="info-card-icon">✉️</div>
              <div className="info-card-label">Email</div>
              <div className="info-card-value">
                <a href="mailto:support@marketgreeks.com">support@marketgreeks.com</a>
              </div>
            </div>

            <div className="info-card">
              <div className="info-card-icon">🌐</div>
              <div className="info-card-label">Website</div>
              <div className="info-card-value">
                <a href="https://www.marketgreeks.com" target="_blank" rel="noopener noreferrer">
                  marketgreeks.com
                </a>
              </div>
            </div>

            <div className="info-card">
              <div className="info-card-icon">🕐</div>
              <div className="info-card-label">Support Hours</div>
              <div className="info-card-value">
                Mon – Fri<br />
                9:00 AM – 6:00 PM IST
              </div>
            </div>

            <div className="info-card">
              <div className="info-card-icon">📍</div>
              <div className="info-card-label">Location</div>
              <div className="info-card-value">Bengaluru, India 🇮🇳</div>
            </div>

            <div className="telegram-card">
              <p>For instant updates and market alerts, join our Telegram community.</p>
              <a
                href="https://t.me/marketgreeks"
                target="_blank"
                rel="noopener noreferrer"
                className="telegram-btn"
              >
                ✈ Join Telegram
              </a>
            </div>
          </aside>

          {/* FORM CARD */}
          <div className="form-card">
            <div className="form-title">Send us a message</div>

            {status === "sent" && (
              <div className="status-banner sent" role="alert">
                ✓ Message received! We'll get back to you within 24–48 business hours.
              </div>
            )}
            {status === "error" && (
              <div className="status-banner error" role="alert">
                ⚠ Something went wrong. Please email us directly at support@marketgreeks.com
              </div>
            )}

            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="name">Full Name *</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Your name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="email">Email Address *</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-field full">
                <label htmlFor="subject">Topic</label>
                <select
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                >
                  <option value="">Select a topic…</option>
                  <option value="General Inquiry">General Inquiry</option>
                  <option value="Options & Virtual Trading">Options &amp; Virtual Trading</option>
                  <option value="IPO Tracker">IPO Tracker</option>
                  <option value="IV Screener">IV / Screener</option>
                  <option value="Subscription & Billing">Subscription &amp; Billing</option>
                  <option value="Data & API">Data &amp; API Access</option>
                  <option value="Technical Support">Technical Support</option>
                  <option value="Partnership">Partnership / Business</option>
                  <option value="Feedback">Feedback &amp; Suggestions</option>
                </select>
              </div>

              <div className="form-field full">
                <label htmlFor="message">Message *</label>
                <textarea
                  id="message"
                  name="message"
                  placeholder="Describe your query in detail…"
                  value={formData.message}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="submit-row">
              <span className="submit-note">* Required fields</span>
              <button
                className="submit-btn"
                onClick={handleSubmit}
                disabled={!isFormValid || status === "sending" || status === "sent"}
                type="button"
              >
                {status === "sending" ? "Sending…" : status === "sent" ? "Sent ✓" : "Send Message →"}
              </button>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="contact-footer">
          <p className="footer-brand">
            <span>MarketGreeks</span> · Indian Market Intelligence
          </p>
          <p className="footer-disclaimer">
            Not SEBI registered. For educational purposes only.
          </p>
        </div>
      </div>
    </>
  );
}
