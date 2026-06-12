"use client"

import { AnnouncementBar } from "@/components/announcement-bar"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { useEffect, useRef, useState } from "react"
import {
  TrendingUp, ArrowRight, Zap, Shield, BookOpen,
  Users, BarChart2, Flame, Lightbulb, Lock
} from "lucide-react"

// ── Animated counter hook ─────────────────────────────────────────────────────
function useCounter(target: number, duration = 1800, start = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!start) return
    let startTime: number
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(ease * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration, start])
  return count
}

// ── Intersection observer hook ────────────────────────────────────────────────
function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true) }, { threshold })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, inView }
}

// ── Stat card with animated counter ──────────────────────────────────────────
function StatCard({ value, suffix, label, delay }: { value: number; suffix: string; label: string; delay: number }) {
  const { ref, inView } = useInView(0.3)
  const count = useCounter(value, 1600, inView)
  return (
    <div ref={ref} className="text-center" style={{ animationDelay: `${delay}ms` }}>
      <div className="text-4xl lg:text-5xl font-black text-foreground font-mono tracking-tight">
        {count.toLocaleString("en-IN")}<span className="text-primary">{suffix}</span>
      </div>
      <div className="text-sm text-muted-foreground mt-2 font-medium">{label}</div>
    </div>
  )
}

// ── Greek letter floating badge ───────────────────────────────────────────────
function GreekBadge({ letter, name, desc, color }: { letter: string; name: string; desc: string; color: string }) {
  return (
    <div className={`group relative bg-card border border-border rounded-2xl p-5 hover:border-${color}-400/50 hover:-translate-y-1 transition-all duration-300 cursor-default`}>
      <div className={`text-5xl font-black text-${color}-500/20 group-hover:text-${color}-500/40 transition-colors leading-none mb-3 select-none`}>
        {letter}
      </div>
      <div className="font-bold text-foreground text-sm">{name}</div>
      <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</div>
    </div>
  )
}

// ── Feature row ───────────────────────────────────────────────────────────────
function FeatureRow({ icon, title, desc, tag, reverse = false }: {
  icon: React.ReactNode; title: string; desc: string; tag: string; reverse?: boolean
}) {
  const { ref, inView } = useInView(0.15)
  return (
    <div
      ref={ref}
      className={`flex flex-col ${reverse ? "lg:flex-row-reverse" : "lg:flex-row"} gap-10 items-center transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
    >
      <div className="flex-1">
        <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full mb-4">
          {tag}
        </span>
        <h3 className="text-2xl lg:text-3xl font-bold text-foreground mb-4 leading-tight">{title}</h3>
        <p className="text-muted-foreground leading-relaxed">{desc}</p>
      </div>
      <div className="flex-shrink-0 w-full lg:w-72">
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-4">
            {icon}
          </div>
          <div className="h-2 bg-muted rounded-full mb-2 w-3/4" />
          <div className="h-2 bg-muted rounded-full mb-2 w-1/2" />
          <div className="h-2 bg-primary/20 rounded-full w-2/3" />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function AboutPage() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60)
    window.addEventListener("scroll", handler)
    return () => window.removeEventListener("scroll", handler)
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-background overflow-x-hidden">
      <AnnouncementBar />
      <Navbar />

      {/* ═══════════════════════════════════════════════════════════════════
          HERO — dark, kinetic, bold
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-[90vh] flex items-center bg-foreground text-background overflow-hidden">
        {/* Animated grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Big Greek Δ watermark */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 text-[28rem] font-black text-white/[0.03] leading-none select-none pointer-events-none translate-x-24 hidden lg:block">
          Δ
        </div>

        {/* Glow blobs */}
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 lg:py-32 w-full">
          <div className="max-w-4xl">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 border border-white/20 text-white/70 text-xs font-semibold px-4 py-2 rounded-full mb-8 backdrop-blur-sm">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              India's sharpest Options practice platform
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-[1.05] tracking-tight mb-8">
              Stop gambling.
              <br />
              <span className="text-primary">Start knowing</span>
              <br />
              the Greeks.
            </h1>

            <p className="text-white/60 text-lg lg:text-xl leading-relaxed max-w-2xl mb-10">
              MarketGreeks is a free virtual trading platform built by Options traders
              for Options traders — where you master Delta, Theta, Vega and Gamma through
              doing, not just reading. Real NSE instruments. Real mechanics. Zero real risk.
            </p>

            <div className="flex flex-wrap gap-4">
              <a href="/virtual-trade"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-bold px-6 py-3.5 rounded-xl text-sm hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary/30">
                Try Virtual Trading Free <ArrowRight className="w-4 h-4" />
              </a>
              <a href="/learn"
                className="inline-flex items-center gap-2 border border-white/20 text-white font-semibold px-6 py-3.5 rounded-xl text-sm hover:bg-white/10 transition-colors">
                <BookOpen className="w-4 h-4" /> Learn the Greeks
              </a>
            </div>
          </div>
        </div>

        {/* Bottom fade to background */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          STATS — kinetic counters
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-10">
            <StatCard value={10000}  suffix="+"  label="Registered traders"    delay={0}   />
            <StatCard value={50}     suffix="Cr+" label="Virtual trades placed" delay={100} />
            <StatCard value={40}     suffix="+"  label="F&O instruments"       delay={200} />
            <StatCard value={100}    suffix="%"  label="Free, forever"         delay={300} />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          THE PROBLEM — bold, direct
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-destructive bg-destructive/10 px-3 py-1 rounded-full mb-5">
                The Hard Truth
              </span>
              <h2 className="text-4xl lg:text-5xl font-black text-foreground leading-tight mb-6">
                9 out of 10<br />
                <span className="text-destructive">F&O traders</span><br />
                lose money.
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                That's not a rumour — it's SEBI data. And the leading cause isn't bad luck
                or bad stocks. It's <strong className="text-foreground">not understanding the mechanics.</strong>
              </p>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Most new traders jump into options without ever simulating what happens
                when they <em>write</em> a call, how margin gets blocked, what theta decay
                actually looks like across 20 trading days, or how a position auto-squares
                off when losses approach the margin.
              </p>
              <p className="text-foreground font-semibold leading-relaxed">
                MarketGreeks is the practice ground that changes that.
              </p>
            </div>

            {/* SEBI stat card */}
            <div className="relative">
              <div className="bg-destructive/5 border border-destructive/20 rounded-3xl p-8">
                <div className="text-8xl font-black text-destructive/20 leading-none mb-2 select-none">90%</div>
                <p className="text-lg font-bold text-foreground mb-2">of retail F&O traders booked net losses</p>
                <p className="text-sm text-muted-foreground mb-6">Source: SEBI Study on Derivatives Market, 2024</p>
                <div className="space-y-3">
                  {[
                    ["Didn't understand margin mechanics", "68%"],
                    ["Never paper-traded before going live", "74%"],
                    ["Unaware of Theta decay impact",       "81%"],
                  ].map(([reason, pct]) => (
                    <div key={reason} className="flex items-center gap-3">
                      <div className="flex-1 text-xs text-muted-foreground">{reason}</div>
                      <div className="text-xs font-bold text-destructive">{pct}</div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground/60 mt-4">*Illustrative figures based on industry surveys</p>
              </div>

              <div className="absolute -bottom-4 -right-4 bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-full shadow-lg">
                MarketGreeks fixes this ↗
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          THE GREEKS — interactive cards
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 bg-muted/30 border-y border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full mb-4">
              Why "Greeks"?
            </span>
            <h2 className="text-3xl lg:text-4xl font-black text-foreground mb-3">
              The four forces behind every option price
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Understanding these isn't optional — it <em>is</em> options trading.
              We help you feel them through real simulated trades.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <GreekBadge letter="Δ" name="Delta" color="blue"
              desc="How much the option price moves per ₹1 move in the underlying. Your directional exposure." />
            <GreekBadge letter="Γ" name="Gamma" color="emerald"
              desc="How fast Delta itself changes. High gamma = your position accelerates with moves." />
            <GreekBadge letter="Θ" name="Theta" color="orange"
              desc="Time decay. Options lose value every single day. Sellers love it. Buyers fear it." />
            <GreekBadge letter="V" name="Vega" color="violet"
              desc="Sensitivity to implied volatility. Earnings events, news — vega explains the spike." />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          HOW IT WORKS — features
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full mb-4">
              Platform
            </span>
            <h2 className="text-3xl lg:text-4xl font-black text-foreground">What MarketGreeks gives you</h2>
          </div>

          <div className="space-y-20">
            <FeatureRow
              tag="Options Writing"
              title="Feel what it means to SELL an option"
              desc="When you write an option on MarketGreeks, we block accurate SPAN margin (~20% of notional), track your P&L as the premium moves (not the spot!), and auto square off your position if losses approach your margin — exactly like the real NSE. This is muscle memory you can't get from videos."
              icon={<BarChart2 className="w-6 h-6" />}
            />
            <FeatureRow
              tag="Premium-Based P&L"
              title="Options P&L is all about the premium"
              desc="A common beginner mistake: tracking the underlying instead of the option premium. If you sell a RELIANCE 1350CE at ₹86 and it falls to ₹62, your profit is ₹12,000 — regardless of where Reliance spot is trading. We make this crystal clear in every trade."
              icon={<TrendingUp className="w-6 h-6" />}
              reverse
            />
            <FeatureRow
              tag="Expiry Mechanics"
              title="See what happens on expiry day"
              desc="OTM options expire worthless. ITM options get settled. We simulate both. Your BUY positions go to zero at expiry if they're out of the money — teaching you why time is always working against the buyer. No more surprises on expiry Thursday."
              icon={<Zap className="w-6 h-6" />}
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          PRINCIPLES — energetic grid
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 bg-foreground text-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/20 px-3 py-1 rounded-full mb-4">
              Our Principles
            </span>
            <h2 className="text-3xl lg:text-4xl font-black text-white">Built different.</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: <BookOpen className="w-5 h-5" />,  title: "Education over entertainment",   desc: "No signals, no tips, no noise. Just clean mechanics that teach you how markets actually work." },
              { icon: <Shield className="w-5 h-5" />,    title: "Real simulation, zero real risk", desc: "₹10L virtual wallet. Real lot sizes. Real margin. Real expiry. Everything except real money." },
              { icon: <Zap className="w-5 h-5" />,       title: "Built for speed",                desc: "Fast-loading, snappy UI. No laggy dashboards. Your virtual trades execute in milliseconds." },
              { icon: <Lock className="w-5 h-5" />,      title: "No ads. Ever.",                  desc: "We don't sell your data. We don't push broker referrals. Our only product is your learning." },
              { icon: <Lightbulb className="w-5 h-5" />, title: "Transparent mechanics",          desc: "We show our margin formulas. We cite our data sources. We tell you exactly what's an approximation." },
              { icon: <Users className="w-5 h-5" />,     title: "Community first",                desc: "Every feature on this platform came from a real user request in our trader community." },
            ].map((p) => (
              <div key={p.title} className="border border-white/10 rounded-2xl p-6 hover:border-primary/50 hover:bg-white/[0.03] transition-all group">
                <div className="w-10 h-10 bg-white/10 text-primary rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  {p.icon}
                </div>
                <h3 className="font-bold text-white mb-2 text-sm">{p.title}</h3>
                <p className="text-white/50 text-xs leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          ORIGIN STORY — replaces team section
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full mb-5">
            Our Story
          </span>
          <h2 className="text-3xl lg:text-4xl font-black text-foreground mb-6 leading-tight">
            Built by a trader who got tired<br />of paying tuition fees to the market.
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-5 text-lg">
            MarketGreeks started with one frustrating question: <em>"Why isn't there a simulator that actually works like NSE?"</em>
          </p>
          <p className="text-muted-foreground leading-relaxed mb-5">
            Every paper trading tool either ignored margin, got lot sizes wrong, treated options P&L like equity, or expired positions incorrectly.
            The result? Traders who practised on those tools still got blindsided the moment they went live.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            So we built MarketGreeks — from Bengaluru 🇮🇳, for Indian traders — where the mechanics are real,
            the lot sizes are accurate, the margin gets blocked, and expiry actually means something.
            No team page. No org chart. Just a platform that does what it says.
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          DISCLAIMER
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-12 border-t border-border bg-muted/20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-start gap-4">
            <Shield className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground leading-relaxed space-y-1.5">
              <p><strong className="text-foreground">Disclaimer:</strong> MarketGreeks is a virtual trading and education platform only. No real money is involved.</p>
              <p>We are not SEBI registered as an investment advisor, broker, or research analyst. Nothing on this website constitutes investment advice.</p>
              <p>Option premiums are calculated via Black-Scholes (IV 18%). Live prices via Yahoo Finance (~15 min delay). Margins are SPAN approximations.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          CTA
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 relative overflow-hidden bg-primary">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="text-6xl font-black text-primary-foreground/10 mb-4 select-none">Δ Γ Θ V</div>
          <h2 className="text-3xl lg:text-4xl font-black text-primary-foreground mb-4">
            Ready to actually understand Options?
          </h2>
          <p className="text-primary-foreground/70 mb-8 max-w-md mx-auto">
            Free account. ₹10,00,000 virtual wallet. Real NSE mechanics. No credit card.
          </p>
          <a href="/virtual-trade"
            className="inline-flex items-center gap-2 bg-background text-foreground font-bold px-8 py-4 rounded-xl text-sm hover:bg-background/90 transition-all hover:scale-105 active:scale-95 shadow-2xl">
            Start Trading Free <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      <Footer />
    </div>
  )
}
