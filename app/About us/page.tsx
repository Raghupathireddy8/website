<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="description" content="About MarketGreeks – Your complete Indian stock market toolkit. Free tools for traders & investors." />
  <meta name="theme-color" content="#2d4af0" />
  <title>About Us – MarketGreeks</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --brand: #2d4af0;
      --brand-light: #4f6fff;
      --brand-dark: #1a2fa0;
      --accent: #00e5a0;
      --bg: #0a0e1a;
      --bg2: #111827;
      --bg3: #1a2235;
      --text: #e8eaf6;
      --text-muted: #8892b0;
      --border: rgba(45,74,240,0.25);
      --card-shadow: 0 4px 32px rgba(45,74,240,0.12);
    }
    * { margin:0; padding:0; box-sizing:border-box; }
    html { scroll-behavior: smooth; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'DM Sans', sans-serif;
      line-height: 1.7;
    }

    /* NAV */
    nav {
      background: rgba(10,14,26,0.92);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      padding: 0 2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 60px;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .nav-brand {
      font-family: 'Space Mono', monospace;
      font-weight: 700;
      font-size: 1.2rem;
      color: var(--text);
      text-decoration: none;
      letter-spacing: -0.5px;
    }
    .nav-brand span { color: var(--brand-light); }
    .nav-links { display: flex; gap: 1.5rem; list-style: none; }
    .nav-links a {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.875rem;
      font-weight: 500;
      transition: color 0.2s;
    }
    .nav-links a:hover, .nav-links a.active { color: var(--text); }
    .nav-cta {
      background: var(--brand);
      color: #fff;
      padding: 0.45rem 1.1rem;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 600;
      text-decoration: none;
      transition: background 0.2s;
    }
    .nav-cta:hover { background: var(--brand-light); }

    /* HERO */
    .hero {
      padding: 5rem 2rem 3rem;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .hero::before {
      content: '';
      position: absolute;
      top: -80px; left: 50%; transform: translateX(-50%);
      width: 600px; height: 400px;
      background: radial-gradient(ellipse, rgba(45,74,240,0.18) 0%, transparent 70%);
      pointer-events: none;
    }
    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: rgba(45,74,240,0.15);
      border: 1px solid var(--border);
      color: var(--brand-light);
      font-size: 0.78rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 0.35rem 0.9rem;
      border-radius: 100px;
      margin-bottom: 1.5rem;
    }
    .hero h1 {
      font-family: 'Space Mono', monospace;
      font-size: clamp(2rem, 5vw, 3.2rem);
      font-weight: 700;
      line-height: 1.15;
      letter-spacing: -1px;
      margin-bottom: 1.2rem;
    }
    .hero h1 span { color: var(--brand-light); }
    .hero p {
      max-width: 600px;
      margin: 0 auto;
      color: var(--text-muted);
      font-size: 1.05rem;
      font-weight: 400;
    }

    /* SECTION */
    section { padding: 4rem 2rem; max-width: 1000px; margin: 0 auto; }
    .section-label {
      font-family: 'Space Mono', monospace;
      font-size: 0.72rem;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--accent);
      margin-bottom: 0.75rem;
    }
    h2 {
      font-family: 'Space Mono', monospace;
      font-size: 1.7rem;
      font-weight: 700;
      letter-spacing: -0.5px;
      margin-bottom: 1rem;
    }

    /* STORY */
    .story-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3rem;
      align-items: center;
    }
    .story-text p { color: var(--text-muted); margin-bottom: 1rem; }
    .story-visual {
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 2rem;
      position: relative;
      overflow: hidden;
    }
    .story-visual::before {
      content: '';
      position: absolute;
      top: 0; right: 0;
      width: 200px; height: 200px;
      background: radial-gradient(circle, rgba(45,74,240,0.2) 0%, transparent 70%);
    }
    .stat-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.2rem;
    }
    .stat-item {
      background: var(--bg3);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1.2rem;
    }
    .stat-num {
      font-family: 'Space Mono', monospace;
      font-size: 1.8rem;
      font-weight: 700;
      color: var(--brand-light);
      line-height: 1;
      margin-bottom: 0.3rem;
    }
    .stat-label { font-size: 0.8rem; color: var(--text-muted); }

    /* MISSION */
    .mission-card {
      background: linear-gradient(135deg, rgba(45,74,240,0.15), rgba(0,229,160,0.05));
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 2.5rem;
      position: relative;
      overflow: hidden;
    }
    .mission-card::after {
      content: '"';
      position: absolute;
      top: -0.5rem; right: 1.5rem;
      font-size: 8rem;
      font-family: 'Space Mono', monospace;
      color: rgba(45,74,240,0.1);
      line-height: 1;
    }
    .mission-card p {
      font-size: 1.2rem;
      font-weight: 500;
      line-height: 1.6;
      color: var(--text);
      max-width: 720px;
    }

    /* TOOLS GRID */
    .tools-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 1rem;
      margin-top: 2rem;
    }
    .tool-card {
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem 1.2rem;
      text-align: center;
      transition: border-color 0.2s, transform 0.2s;
    }
    .tool-card:hover {
      border-color: var(--brand-light);
      transform: translateY(-3px);
    }
    .tool-icon { font-size: 1.8rem; margin-bottom: 0.6rem; }
    .tool-name { font-weight: 600; font-size: 0.95rem; margin-bottom: 0.3rem; }
    .tool-desc { font-size: 0.78rem; color: var(--text-muted); }

    /* VALUES */
    .values-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 1.2rem;
      margin-top: 2rem;
    }
    .value-card {
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.8rem 1.5rem;
    }
    .value-icon {
      width: 42px; height: 42px;
      background: rgba(45,74,240,0.15);
      border: 1px solid var(--border);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      margin-bottom: 1rem;
    }
    .value-card h3 { font-size: 1rem; font-weight: 600; margin-bottom: 0.4rem; }
    .value-card p { font-size: 0.83rem; color: var(--text-muted); line-height: 1.5; }

    /* DISCLAIMER */
    .disclaimer {
      background: rgba(255,180,0,0.06);
      border: 1px solid rgba(255,180,0,0.2);
      border-radius: 10px;
      padding: 1.2rem 1.5rem;
      margin-top: 2rem;
      font-size: 0.83rem;
      color: #c8a020;
      line-height: 1.6;
    }
    .disclaimer strong { color: #e8b820; }

    /* CTA */
    .cta-section {
      text-align: center;
      padding: 4rem 2rem;
      background: var(--bg2);
      border-top: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
    }
    .cta-section h2 { margin-bottom: 0.75rem; }
    .cta-section p { color: var(--text-muted); margin-bottom: 2rem; }
    .cta-buttons { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
    .btn-primary {
      background: var(--brand);
      color: #fff;
      padding: 0.75rem 1.8rem;
      border-radius: 8px;
      font-weight: 600;
      text-decoration: none;
      font-size: 0.95rem;
      transition: background 0.2s;
    }
    .btn-primary:hover { background: var(--brand-light); }
    .btn-secondary {
      background: transparent;
      color: var(--text);
      padding: 0.75rem 1.8rem;
      border-radius: 8px;
      font-weight: 600;
      text-decoration: none;
      font-size: 0.95rem;
      border: 1px solid var(--border);
      transition: border-color 0.2s;
    }
    .btn-secondary:hover { border-color: var(--brand-light); }

    /* FOOTER */
    footer {
      padding: 2rem;
      text-align: center;
      color: var(--text-muted);
      font-size: 0.82rem;
      border-top: 1px solid var(--border);
    }
    footer a { color: var(--brand-light); text-decoration: none; }
    .footer-links { display: flex; gap: 1.5rem; justify-content: center; margin-bottom: 0.75rem; flex-wrap: wrap; }

    @media (max-width: 640px) {
      .story-grid { grid-template-columns: 1fr; }
      .nav-links { display: none; }
    }
  </style>
</head>
<body>

  <nav>
    <a href="https://www.marketgreeks.com/" class="nav-brand">Market<span>Greeks</span></a>
    <ul class="nav-links">
      <li><a href="https://www.marketgreeks.com/">Home</a></li>
      <li><a href="https://www.marketgreeks.com/ipo">IPO</a></li>
      <li><a href="https://www.marketgreeks.com/screener">Screener</a></li>
      <li><a href="/about.html" class="active">About</a></li>
      <li><a href="/contact.html">Contact</a></li>
    </ul>
    <a href="https://t.me/marketgreeks" class="nav-cta">Get Alerts</a>
  </nav>

  <!-- HERO -->
  <div class="hero">
    <div class="hero-badge">🇮🇳 Made for Indian Markets</div>
    <h1>Empowering India's<br><span>Smart Traders</span></h1>
    <p>Free, powerful tools built for every Indian trader and investor — from the first-time buyer to the seasoned options strategist.</p>
  </div>

  <!-- OUR STORY -->
  <section>
    <div class="story-grid">
      <div class="story-text">
        <div class="section-label">Our Story</div>
        <h2>Built by traders,<br>for traders.</h2>
        <p>MarketGreeks was born out of frustration. Premium tools cost thousands. Free tools were either outdated or buried under ads. We decided to change that.</p>
        <p>We're a small team of passionate market enthusiasts and developers who believe that quality market intelligence shouldn't have a price tag. Every tool on this platform — IPO trackers, options screeners, virtual trading, tax calculators — is completely free.</p>
        <p>Our mission is simple: democratize access to Indian stock market data and tools for every retail investor across Bharat.</p>
      </div>
      <div class="story-visual">
        <div class="stat-grid">
          <div class="stat-item">
            <div class="stat-num">10+</div>
            <div class="stat-label">Free Tools</div>
          </div>
          <div class="stat-item">
            <div class="stat-num">NSE</div>
            <div class="stat-label">BSE Coverage</div>
          </div>
          <div class="stat-item">
            <div class="stat-num">0₹</div>
            <div class="stat-label">Always Free</div>
          </div>
          <div class="stat-item">
            <div class="stat-num">Live</div>
            <div class="stat-label">Market Data</div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- MISSION -->
  <section>
    <div class="section-label">Our Mission</div>
    <div class="mission-card">
      <p>To give every Indian retail investor — regardless of capital size or technical background — access to the same quality market tools, data, and insights that were once reserved for institutional players.</p>
    </div>
  </section>

  <!-- TOOLS -->
  <section>
    <div class="section-label">What We Offer</div>
    <h2>Your Complete Market Toolkit</h2>
    <div class="tools-grid">
      <div class="tool-card">
        <div class="tool-icon">📈</div>
        <div class="tool-name">IPO Tracker</div>
        <div class="tool-desc">Live GMP, dates & allotment status</div>
      </div>
      <div class="tool-card">
        <div class="tool-icon">🎯</div>
        <div class="tool-name">Options Screener</div>
        <div class="tool-desc">IV Rank & volatility analysis</div>
      </div>
      <div class="tool-card">
        <div class="tool-icon">🔬</div>
        <div class="tool-name">Strategy Backtest</div>
        <div class="tool-desc">Test ideas on historical data</div>
      </div>
      <div class="tool-card">
        <div class="tool-icon">💸</div>
        <div class="tool-name">Tax Calculator</div>
        <div class="tool-desc">STCG & LTCG in seconds</div>
      </div>
      <div class="tool-card">
        <div class="tool-icon">🏦</div>
        <div class="tool-name">Virtual Trading</div>
        <div class="tool-desc">Practice with ₹10L virtual money</div>
      </div>
      <div class="tool-card">
        <div class="tool-icon">📊</div>
        <div class="tool-name">MF Compare</div>
        <div class="tool-desc">Compare mutual fund returns</div>
      </div>
      <div class="tool-card">
        <div class="tool-icon">🏛️</div>
        <div class="tool-name">Savings Schemes</div>
        <div class="tool-desc">PPF, NPS, SSY & more</div>
      </div>
      <div class="tool-card">
        <div class="tool-icon">📉</div>
        <div class="tool-name">Market Pulse</div>
        <div class="tool-desc">Top gainers, losers & volume</div>
      </div>
    </div>
  </section>

  <!-- VALUES -->
  <section>
    <div class="section-label">Our Values</div>
    <h2>What We Stand For</h2>
    <div class="values-grid">
      <div class="value-card">
        <div class="value-icon">🔓</div>
        <h3>Always Free</h3>
        <p>Core tools will always remain free. No paywalls, no hidden subscriptions. Access to good financial tools is a right, not a privilege.</p>
      </div>
      <div class="value-card">
        <div class="value-icon">🎓</div>
        <h3>Education First</h3>
        <p>We believe informed investors make better decisions. Every tool is designed to educate, not just execute.</p>
      </div>
      <div class="value-card">
        <div class="value-icon">⚡</div>
        <h3>Accuracy & Speed</h3>
        <p>Market data that's stale is worthless. We prioritize real-time accuracy and performance across all our tools.</p>
      </div>
      <div class="value-card">
        <div class="value-icon">🔒</div>
        <h3>No Data Selling</h3>
        <p>We don't sell your data. We don't track you for ads. Your privacy matters as much as your portfolio.</p>
      </div>
    </div>
  </section>

  <!-- DISCLAIMER -->
  <section style="padding-top:0;">
    <div class="disclaimer">
      <strong>⚠️ Important Disclaimer:</strong> MarketGreeks is not registered with SEBI. All content, tools, and information provided on this platform are for <strong>educational and informational purposes only</strong>. Nothing on this website constitutes investment advice, financial advice, or a recommendation to buy or sell any security. Market data may be delayed by up to 15 minutes. Always consult a SEBI-registered investment advisor before making financial decisions.
    </div>
  </section>

  <!-- CTA -->
  <div class="cta-section">
    <h2>Start Exploring</h2>
    <p>Dive into our free tools or join our Telegram for daily market alerts.</p>
    <div class="cta-buttons">
      <a href="https://www.marketgreeks.com/" class="btn-primary">Explore Tools</a>
      <a href="https://t.me/marketgreeks" class="btn-secondary">Join Telegram →</a>
    </div>
  </div>

  <footer>
    <div class="footer-links">
      <a href="https://www.marketgreeks.com/">Home</a>
      <a href="/about.html">About Us</a>
      <a href="/contact.html">Contact Us</a>
      <a href="/terms.html">Terms & Conditions</a>
    </div>
    <p>© 2026 MarketGreeks. Not SEBI registered. For educational purposes only.</p>
  </footer>

</body>
</html>
