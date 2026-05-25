<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="Contact MarketGreeks – reach out for support, feedback, or partnerships." />
  <title>Contact Us – MarketGreeks</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,400&display=swap" rel="stylesheet" />
  <style>
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

    /* ─── NAV ─── */
    nav {
      position: sticky; top: 0; z-index: 100;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 2rem;
      height: 62px;
      background: rgba(5,12,26,0.85);
      backdrop-filter: blur(14px);
      border-bottom: 1px solid var(--border);
    }
    .nav-logo {
      font-family: 'Syne', sans-serif;
      font-weight: 800; font-size: 1.25rem;
      color: var(--text); text-decoration: none;
      display: flex; align-items: center; gap: .5rem;
    }
    .nav-logo span { color: var(--brand-light); }
    .nav-links { display: flex; gap: 1.5rem; }
    .nav-links a {
      color: var(--muted); text-decoration: none;
      font-size: .9rem; font-weight: 500;
      transition: color .2s;
    }
    .nav-links a:hover { color: var(--text); }
    .nav-cta {
      background: var(--brand);
      color: #fff; text-decoration: none;
      padding: .45rem 1.1rem; border-radius: 8px;
      font-size: .85rem; font-weight: 600;
      transition: background .2s, transform .15s;
    }
    .nav-cta:hover { background: var(--brand-light); transform: translateY(-1px); }

    /* ─── HERO BAND ─── */
    .hero-band {
      position: relative;
      padding: 5rem 2rem 3.5rem;
      text-align: center;
      overflow: hidden;
    }
    .hero-band::before {
      content: '';
      position: absolute; inset: 0;
      background: radial-gradient(ellipse 70% 60% at 50% 0%, rgba(45,74,240,.22) 0%, transparent 70%);
      pointer-events: none;
    }
    .hero-band .eyebrow {
      display: inline-flex; align-items: center; gap: .5rem;
      background: var(--brand-dim);
      border: 1px solid rgba(45,74,240,.35);
      color: var(--brand-light);
      padding: .3rem .9rem; border-radius: 50px;
      font-size: .78rem; font-weight: 600; letter-spacing: .08em;
      text-transform: uppercase; margin-bottom: 1.2rem;
    }
    .hero-band h1 {
      font-family: 'Syne', sans-serif;
      font-size: clamp(2rem, 5vw, 3.2rem);
      font-weight: 800;
      line-height: 1.1;
      margin-bottom: .9rem;
    }
    .hero-band h1 em { font-style: normal; color: var(--brand-light); }
    .hero-band p {
      color: var(--muted); font-size: 1rem; max-width: 480px; margin: 0 auto;
      line-height: 1.7;
    }

    /* ─── LAYOUT ─── */
    .contact-wrapper {
      max-width: 1100px; margin: 0 auto;
      padding: 1rem 2rem 6rem;
      display: grid;
      grid-template-columns: 1fr 1.4fr;
      gap: 3rem;
      align-items: start;
    }

    /* ─── INFO CARDS ─── */
    .info-col { display: flex; flex-direction: column; gap: 1.2rem; }
    .info-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 1.6rem;
      transition: border-color .25s, transform .25s;
    }
    .info-card:hover {
      border-color: rgba(45,74,240,.4);
      transform: translateY(-2px);
    }
    .info-card .icon {
      width: 44px; height: 44px; border-radius: 12px;
      background: var(--brand-dim);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.3rem; margin-bottom: 1rem;
    }
    .info-card h3 {
      font-family: 'Syne', sans-serif;
      font-size: 1rem; font-weight: 700;
      margin-bottom: .4rem;
    }
    .info-card p {
      font-size: .88rem; color: var(--muted); line-height: 1.6;
    }
    .info-card a {
      color: var(--brand-light); text-decoration: none; font-weight: 500;
    }
    .info-card a:hover { text-decoration: underline; }

    .response-badge {
      display: inline-flex; align-items: center; gap: .4rem;
      background: rgba(34,211,151,.1);
      border: 1px solid rgba(34,211,151,.25);
      color: var(--success);
      padding: .25rem .75rem; border-radius: 50px;
      font-size: .75rem; font-weight: 600; margin-top: .8rem;
    }
    .response-badge::before {
      content: ''; width: 6px; height: 6px;
      border-radius: 50%; background: var(--success);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%,100% { opacity: 1; } 50% { opacity: .3; }
    }

    .disclaimer-card {
      background: rgba(240,160,32,.06);
      border: 1px solid rgba(240,160,32,.2);
      border-radius: 16px;
      padding: 1.4rem;
    }
    .disclaimer-card .icon { background: rgba(240,160,32,.12); }
    .disclaimer-card h3 { color: var(--accent); }

    /* ─── FORM ─── */
    .form-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 2.4rem;
    }
    .form-card h2 {
      font-family: 'Syne', sans-serif;
      font-size: 1.4rem; font-weight: 700;
      margin-bottom: .3rem;
    }
    .form-card .sub {
      color: var(--muted); font-size: .88rem; margin-bottom: 2rem;
    }

    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .field { display: flex; flex-direction: column; gap: .45rem; margin-bottom: 1.1rem; }
    .field label {
      font-size: .8rem; font-weight: 600;
      color: var(--muted); letter-spacing: .04em; text-transform: uppercase;
    }
    .field input,
    .field select,
    .field textarea {
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
    .field input::placeholder,
    .field textarea::placeholder { color: var(--muted); }
    .field input:focus,
    .field select:focus,
    .field textarea:focus {
      border-color: var(--brand);
      box-shadow: 0 0 0 3px rgba(45,74,240,.15);
    }
    .field select option { background: var(--surface2); }
    .field textarea { resize: vertical; min-height: 130px; }

    .submit-btn {
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
      position: relative;
      overflow: hidden;
    }
    .submit-btn:hover {
      background: var(--brand-light);
      transform: translateY(-1px);
      box-shadow: 0 8px 24px rgba(45,74,240,.35);
    }
    .submit-btn:active { transform: translateY(0); }

    /* success state */
    .success-msg {
      display: none;
      flex-direction: column; align-items: center;
      gap: .8rem; text-align: center;
      padding: 2.5rem 1rem;
    }
    .success-msg .check {
      width: 64px; height: 64px; border-radius: 50%;
      background: rgba(34,211,151,.12);
      display: flex; align-items: center; justify-content: center;
      font-size: 2rem;
    }
    .success-msg h3 {
      font-family: 'Syne', sans-serif; font-size: 1.3rem; font-weight: 700;
    }
    .success-msg p { color: var(--muted); font-size: .9rem; }

    /* ─── FOOTER ─── */
    footer {
      background: var(--surface);
      border-top: 1px solid var(--border);
      padding: 2rem;
      text-align: center;
      color: var(--muted); font-size: .82rem;
    }
    footer a { color: var(--brand-light); text-decoration: none; }
    footer a:hover { text-decoration: underline; }
    .footer-links { display: flex; justify-content: center; gap: 1.5rem; flex-wrap: wrap; margin-bottom: .8rem; }

    /* ─── RESPONSIVE ─── */
    @media (max-width: 768px) {
      .contact-wrapper { grid-template-columns: 1fr; gap: 2rem; }
      .field-row { grid-template-columns: 1fr; }
      .nav-links { display: none; }
      .form-card { padding: 1.6rem; }
    }
  </style>
</head>
<body>

<!-- NAV -->
<nav>
  <a href="https://www.marketgreeks.com/" class="nav-logo">Market<span>Greeks</span></a>
  <div class="nav-links">
    <a href="https://www.marketgreeks.com/options">Options</a>
    <a href="https://www.marketgreeks.com/screener">Screener</a>
    <a href="https://www.marketgreeks.com/ipo">IPO</a>
    <a href="https://www.marketgreeks.com/about">About</a>
  </div>
  <a href="https://t.me/marketgreeks" class="nav-cta">Join Telegram</a>
</nav>

<!-- HERO -->
<div class="hero-band">
  <div class="eyebrow">📬 Contact Us</div>
  <h1>We'd love to <em>hear from you</em></h1>
  <p>Questions, feedback, bug reports or partnership ideas — our team is here to help.</p>
</div>

<!-- MAIN CONTENT -->
<div class="contact-wrapper">

  <!-- LEFT: Info -->
  <div class="info-col">

    <div class="info-card">
      <div class="icon">✉️</div>
      <h3>Email Support</h3>
      <p>For all queries, write to us at<br><a href="mailto:support@marketgreeks.com">support@marketgreeks.com</a></p>
      <div class="response-badge">Typically replies within 24–48 hours</div>
    </div>

    <div class="info-card">
      <div class="icon">💬</div>
      <h3>Telegram Community</h3>
      <p>Join our active Telegram channel for live market alerts, IPO GMP updates, and quick answers from the community.</p>
      <p style="margin-top:.6rem"><a href="https://t.me/marketgreeks" target="_blank">@marketgreeks →</a></p>
    </div>

    <div class="info-card">
      <div class="icon">🤝</div>
      <h3>Partnerships & Collaboration</h3>
      <p>Interested in featuring your fintech product, data partnership, or content collaboration? Let's talk.</p>
      <p style="margin-top:.6rem"><a href="mailto:support@marketgreeks.com?subject=Partnership Inquiry">support@marketgreeks.com</a></p>
    </div>

    <div class="info-card disclaimer-card">
      <div class="icon">⚠️</div>
      <h3>Important Disclaimer</h3>
      <p>MarketGreeks is not a SEBI-registered investment advisor. All tools and content are for <strong>educational purposes only</strong>. Please consult a SEBI-registered advisor before making investment decisions. Market data may be delayed by up to 15 minutes.</p>
    </div>

  </div>

  <!-- RIGHT: Form -->
  <div class="form-card" id="contact-form-wrapper">
    <h2>Send us a message</h2>
    <p class="sub">Fill in the details below and we'll get back to you shortly.</p>

    <form id="contactForm" novalidate>
      <div class="field-row">
        <div class="field">
          <label for="fname">First Name</label>
          <input type="text" id="fname" placeholder="Arjun" required />
        </div>
        <div class="field">
          <label for="lname">Last Name</label>
          <input type="text" id="lname" placeholder="Sharma" />
        </div>
      </div>

      <div class="field">
        <label for="email">Email Address</label>
        <input type="email" id="email" placeholder="arjun@example.com" required />
      </div>

      <div class="field">
        <label for="subject">Subject</label>
        <select id="subject">
          <option value="" disabled selected>Select a topic</option>
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

      <div class="field">
        <label for="message">Message</label>
        <textarea id="message" placeholder="Describe your query in detail…" required></textarea>
      </div>

      <button type="submit" class="submit-btn" id="submitBtn">Send Message →</button>
    </form>

    <div class="success-msg" id="successMsg">
      <div class="check">✅</div>
      <h3>Message received!</h3>
      <p>Thanks for reaching out. We'll respond to <span id="confirmedEmail"></span> within 24–48 hours.</p>
    </div>
  </div>

</div>

<!-- FOOTER -->
<footer>
  <div class="footer-links">
    <a href="https://www.marketgreeks.com/">Home</a>
    <a href="https://www.marketgreeks.com/ipo">IPO</a>
    <a href="https://www.marketgreeks.com/screener">Screener</a>
    <a href="https://www.marketgreeks.com/about">About</a>
    <a href="/contact">Contact Us</a>
    <a href="/terms">Terms & Conditions</a>
  </div>
  <p>© 2026 MarketGreeks. Not SEBI registered. For educational purposes only.</p>
  <p style="margin-top:.4rem">Data delayed by 15 minutes. Not investment advice.</p>
</footer>

<script>
  document.getElementById('contactForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const name  = document.getElementById('fname').value.trim();
    const msg   = document.getElementById('message').value.trim();
    if (!email || !name || !msg) {
      alert('Please fill in all required fields.');
      return;
    }
    const btn = document.getElementById('submitBtn');
    btn.textContent = 'Sending…';
    btn.disabled = true;
    // Simulate submission (replace with your actual endpoint / EmailJS / Formspree)
    setTimeout(() => {
      document.getElementById('contactForm').style.display = 'none';
      const sm = document.getElementById('successMsg');
      sm.style.display = 'flex';
      document.getElementById('confirmedEmail').textContent = email;
    }, 1200);
  });
</script>
</body>
</html>
