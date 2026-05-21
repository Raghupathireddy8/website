```tsx
import "./about.css"

export default function AboutUsPage() {
  return (
    <div>

      <nav>
        <a href="https://www.marketgreeks.com/" className="nav-brand">Market<span>Greeks</span></a>

        <ul className="nav-links">
          <li><a href="https://www.marketgreeks.com/">Home</a></li>
          <li><a href="https://www.marketgreeks.com/ipo">IPO</a></li>
          <li><a href="https://www.marketgreeks.com/screener">Screener</a></li>
          <li><a href="/about-us" className="active">About</a></li>
          <li><a href="/contact.html">Contact</a></li>
        </ul>

        <a href="https://t.me/marketgreeks" className="nav-cta">
          Get Alerts
        </a>
      </nav>

      {/* HERO */}
      <div className="hero">
        <div className="hero-badge">🇮🇳 Made for Indian Markets</div>

        <h1>
          Empowering India's
          <br />
          <span>Smart Traders</span>
        </h1>

        <p>
          Free, powerful tools built for every Indian trader and investor —
          from the first-time buyer to the seasoned options strategist.
        </p>
      </div>

      {/* OUR STORY */}
      <section>
        <div className="story-grid">

          <div className="story-text">
            <div className="section-label">Our Story</div>

            <h2>
              Built by traders,
              <br />
              for traders.
            </h2>

            <p>
              MarketGreeks was born out of frustration. Premium tools cost
              thousands. Free tools were either outdated or buried under ads.
              We decided to change that.
            </p>

            <p>
              We're a small team of passionate market enthusiasts and developers
              who believe that quality market intelligence shouldn't have a
              price tag. Every tool on this platform — IPO trackers, options
              screeners, virtual trading, tax calculators — is completely free.
            </p>

            <p>
              Our mission is simple: democratize access to Indian stock market
              data and tools for every retail investor across Bharat.
            </p>
          </div>

          <div className="story-visual">
            <div className="stat-grid">

              <div className="stat-item">
                <div className="stat-num">10+</div>
                <div className="stat-label">Free Tools</div>
              </div>

              <div className="stat-item">
                <div className="stat-num">NSE</div>
                <div className="stat-label">BSE Coverage</div>
              </div>

              <div className="stat-item">
                <div className="stat-num">0₹</div>
                <div className="stat-label">Always Free</div>
              </div>

              <div className="stat-item">
                <div className="stat-num">Live</div>
                <div className="stat-label">Market Data</div>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* MISSION */}
      <section>
        <div className="section-label">Our Mission</div>

        <div className="mission-card">
          <p>
            To give every Indian retail investor — regardless of capital size
            or technical background — access to the same quality market tools,
            data, and insights that were once reserved for institutional
            players.
          </p>
        </div>
      </section>

      {/* TOOLS */}
      <section>
        <div className="section-label">What We Offer</div>

        <h2>Your Complete Market Toolkit</h2>

        <div className="tools-grid">

          <div className="tool-card">
            <div className="tool-icon">📈</div>
            <div className="tool-name">IPO Tracker</div>
            <div className="tool-desc">
              Live GMP, dates & allotment status
            </div>
          </div>

          <div className="tool-card">
            <div className="tool-icon">🎯</div>
            <div className="tool-name">Options Screener</div>
            <div className="tool-desc">
              IV Rank & volatility analysis
            </div>
          </div>

          <div className="tool-card">
            <div className="tool-icon">🔬</div>
            <div className="tool-name">Strategy Backtest</div>
            <div className="tool-desc">
              Test ideas on historical data
            </div>
          </div>

          <div className="tool-card">
            <div className="tool-icon">💸</div>
            <div className="tool-name">Tax Calculator</div>
            <div className="tool-desc">
              STCG & LTCG in seconds
            </div>
          </div>

          <div className="tool-card">
            <div className="tool-icon">🏦</div>
            <div className="tool-name">Virtual Trading</div>
            <div className="tool-desc">
              Practice with ₹10L virtual money
            </div>
          </div>

          <div className="tool-card">
            <div className="tool-icon">📊</div>
            <div className="tool-name">MF Compare</div>
            <div className="tool-desc">
              Compare mutual fund returns
            </div>
          </div>

        </div>
      </section>

      {/* DISCLAIMER */}
      <section style={{ paddingTop: 0 }}>
        <div className="disclaimer">
          <strong>⚠️ Important Disclaimer:</strong> MarketGreeks is not
          registered with SEBI. All content, tools, and information provided on
          this platform are for <strong>educational and informational purposes only</strong>.
          Nothing on this website constitutes investment advice, financial
          advice, or a recommendation to buy or sell any security.
        </div>
      </section>

      {/* CTA */}
      <div className="cta-section">

        <h2>Start Exploring</h2>

        <p>
          Dive into our free tools or join our Telegram for daily market alerts.
        </p>

        <div className="cta-buttons">

          <a
            href="https://www.marketgreeks.com/"
            className="btn-primary"
          >
            Explore Tools
          </a>

          <a
            href="https://t.me/marketgreeks"
            className="btn-secondary"
          >
            Join Telegram →
          </a>

        </div>
      </div>

      <footer>

        <div className="footer-links">
          <a href="https://www.marketgreeks.com/">Home</a>
          <a href="/about-us">About Us</a>
          <a href="/contact.html">Contact Us</a>
          <a href="/terms.html">Terms & Conditions</a>
        </div>

        <p>
          © 2026 MarketGreeks. Not SEBI registered.
          For educational purposes only.
        </p>

      </footer>

    </div>
  )
}
```
