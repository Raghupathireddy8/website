"use client"

import { useState } from "react"
import { AnnouncementBar } from "@/components/announcement-bar"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Mail, Globe, Clock, MapPin, Send, MessageSquare } from "lucide-react"

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  })
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

const handleSubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    if (!formData.name || !formData.email || !formData.message) return
    setStatus("sending")
    try {
      const mailtoLink = `mailto:support@marketgreeks.com?subject=...`
      window.location.href = mailtoLink
      setStatus("sent")
    } catch {
      setStatus("error")
    }
  }

  const isFormValid = formData.name && formData.email && formData.message

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AnnouncementBar />
      <Navbar />

      {/* HERO */}
      <section className="relative bg-foreground text-background overflow-hidden py-20 lg:py-28">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 text-[20rem] font-black text-white/[0.03] leading-none select-none pointer-events-none translate-x-16 hidden lg:block">
          ✉
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 border border-white/20 text-white/70 text-xs font-semibold px-4 py-2 rounded-full mb-6 backdrop-blur-sm">
            <MessageSquare className="w-3.5 h-3.5 text-primary" />
            Contact Us
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight tracking-tight mb-5">
            We&apos;re here to{" "}
            <span className="text-primary">help you</span>
          </h1>
          <p className="text-white/50 text-lg max-w-xl mx-auto leading-relaxed">
            Got a question about options analytics, IPO data, virtual trading, or anything else?
            Drop us a message and we&apos;ll get back within 24–48 hours.
          </p>

          {/* STATUS CHIPS */}
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            <div className="flex items-center gap-2 text-xs font-medium text-white/60 bg-white/5 border border-white/10 rounded-full px-4 py-2">
              <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_#4ade80]" />
              Support Active
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-white/60 bg-white/5 border border-white/10 rounded-full px-4 py-2">
              <Clock className="w-3.5 h-3.5" /> Response: 24–48 hrs
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-white/60 bg-white/5 border border-white/10 rounded-full px-4 py-2">
              <MapPin className="w-3.5 h-3.5" /> Bengaluru, India
            </div>
          </div>
        </div>
      </section>

      {/* MAIN CONTENT */}
      <section className="flex-1 py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

            {/* SIDEBAR */}
            <div className="flex flex-col gap-4">
              {/* Email */}
              <div className="bg-card border border-border rounded-2xl p-5 hover:border-primary/40 transition-colors group">
                <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                  <Mail className="w-5 h-5" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Email</p>
                <a
                  href="mailto:support@marketgreeks.com"
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  support@marketgreeks.com
                </a>
              </div>

              {/* Website */}
              <div className="bg-card border border-border rounded-2xl p-5 hover:border-primary/40 transition-colors group">
                <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                  <Globe className="w-5 h-5" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Website</p>
                <a
                  href="https://www.marketgreeks.com"
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  marketgreeks.com
                </a>
              </div>

              {/* Hours */}
              <div className="bg-card border border-border rounded-2xl p-5 hover:border-primary/40 transition-colors group">
                <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                  <Clock className="w-5 h-5" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Support Hours</p>
                <p className="text-sm font-semibold text-foreground">Mon – Fri</p>
                <p className="text-xs text-muted-foreground">9:00 AM – 6:00 PM IST</p>
              </div>

              {/* Location */}
              <div className="bg-card border border-border rounded-2xl p-5 hover:border-primary/40 transition-colors group">
                <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                  <MapPin className="w-5 h-5" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Location</p>
                <p className="text-sm font-semibold text-foreground">Bengaluru, India 🇮🇳</p>
              </div>

              {/* Telegram CTA */}
              <div className="bg-primary/10 border border-primary/30 rounded-2xl p-5 text-center">
                <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                  For instant market alerts and community support, join our Telegram.
                </p>
                <a
                  href="https://t.me/marketgreeks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-primary/90 transition-all hover:scale-105 active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  Join Telegram
                </a>
              </div>
            </div>

            {/* FORM */}
            <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 lg:p-8">
              <h2 className="text-lg font-bold text-foreground mb-6 pb-4 border-b border-border">
                Send us a message
              </h2>

              {status === "sent" && (
                <div className="flex items-start gap-3 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl p-4 mb-5 text-sm">
                  ✓ Message received! We&apos;ll get back to you within 24–48 business hours.
                </div>
              )}
              {status === "error" && (
                <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-4 mb-5 text-sm">
                  ⚠ Something went wrong. Please email us at support@marketgreeks.com
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Name */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="name" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Full Name *
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="Your name"
                    value={formData.name}
                    onChange={handleChange}
                    className="bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    required
                  />
                </div>

                {/* Email */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="email" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Email Address *
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    className="bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    required
                  />
                </div>

                {/* Topic */}
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label htmlFor="subject" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Topic
                  </label>
                  <select
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    className="bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
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

                {/* Message */}
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label htmlFor="message" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Message *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    placeholder="Describe your query in detail…"
                    value={formData.message}
                    onChange={handleChange}
                    rows={5}
                    className="bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-y"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 mt-6 pt-5 border-t border-border flex-wrap">
                <p className="text-xs text-muted-foreground">* Required fields</p>
                <button
                  onClick={handleSubmit}
                  disabled={!isFormValid || status === "sending" || status === "sent"}
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-bold text-sm px-6 py-3 rounded-xl hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg shadow-primary/20"
                  type="button"
                >
                  <Send className="w-4 h-4" />
                  {status === "sending" ? "Sending…" : status === "sent" ? "Sent ✓" : "Send Message"}
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
