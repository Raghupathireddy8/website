"use client";

import { useState } from "react";
import "./contact.css";

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
    <div className="contact-page">

      <div className="contact-topbar">
        🚀 MarketGreeks Beta — Free tools for Indian traders &amp; investors.{" "}
        <a href="https://t.me/marketgreeks" target="_blank" rel="noopener noreferrer">
          Join Telegram for alerts →
        </a>
      </div>

      <div className="contact-header">
        <span className="contact-eyebrow">✉ Contact Us</span>
        <h1>We&apos;re here to <span>help you</span></h1>
        <p>
          Got a question about options analytics, IPO data, virtual trading, or anything else?
          Drop us a message and we&apos;ll get back within 24–48 hours.
        </p>
        <div className="contact-chips">
          <div className="chip">
            <span className="chip-dot" />
            Support Active
          </div>
          <div className="chip">⏱ Response: 24–48 hrs</div>
          <div className="chip">📍 Bengaluru, India</div>
        </div>
      </div>

      <div className="contact-grid">
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

        <div className="form-card">
          <div className="form-title">Send us a message</div>

          {status === "sent" && (
            <div className="status-banner sent" role="alert">
              ✓ Message received! We&apos;ll get back to you within 24–48 business hours.
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

      <div className="contact-footer">
        <p className="footer-brand">
          <span>MarketGreeks</span> · Indian Market Intelligence
        </p>
        <p className="footer-disclaimer">
          Not SEBI registered. For educational purposes only.
        </p>
      </div>
    </div>
  );
}
