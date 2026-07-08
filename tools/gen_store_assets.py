#!/usr/bin/env python3
"""Generate Chrome Web Store marketing assets (screenshots + promo tiles) by
rendering branded HTML mockups with headless Chrome. Output is 24-bit PNG with
no alpha — exactly what the CWS dashboard requires.

Usage: python3 tools/gen_store_assets.py
Output: dist/store-assets/*.png
"""
import base64
import os
import subprocess
import tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "dist", "store-assets")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

with open(os.path.join(ROOT, "icons", "icon128.png"), "rb") as f:
    ICON = "data:image/png;base64," + base64.b64encode(f.read()).decode()

FONT = "system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif"

BASE_CSS = f"""
* {{ box-sizing: border-box; }}
html, body {{ margin: 0; padding: 0; overflow: hidden; font-family: {FONT}; }}
.stage {{ display: flex; align-items: center; }}
.copy {{ padding: 0 64px; }}
.eyebrow {{ display:inline-flex; align-items:center; gap:8px; font-size:15px; font-weight:600;
  color:#2563eb; background:#eff6ff; padding:6px 12px; border-radius:999px; margin-bottom:22px; }}
.headline {{ font-size: 50px; line-height: 1.08; font-weight: 800; color: #0f172a; margin: 0 0 18px; letter-spacing: -0.02em; }}
.sub {{ font-size: 21px; line-height: 1.5; color: #475569; margin: 0; max-width: 520px; }}
.brandline {{ margin-top: 28px; font-size: 15px; color: #64748b; }}
.brandline a {{ color:#2563eb; text-decoration:none; font-weight:600; }}

/* Popup mock */
.popup {{ width: 400px; background:#fff; border:1px solid #e5e7eb; border-radius:16px;
  box-shadow: 0 30px 70px rgba(15,23,42,.18); overflow:hidden; font-size:14.5px; color:#1f2937; }}
.p-header {{ display:flex; align-items:center; gap:9px; padding:13px 15px; border-bottom:1px solid #eef2f7; }}
.p-header img {{ width:26px; height:26px; border-radius:7px; }}
.p-title {{ font-weight:600; font-size:15.5px; flex:1; }}
.p-info {{ color:#94a3b8; font-size:16px; }}
.p-content {{ padding:15px; }}
.badge {{ display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:500;
  padding:4px 9px; border-radius:999px; margin-bottom:13px; background:#eff6ff; color:#2563eb; }}
.card {{ border:1px solid #e5e7eb; border-radius:11px; padding:13px 15px; }}
.card.soft {{ background:#eff6ff; }}
.card h2 {{ margin:0 0 9px; font-size:12px; font-weight:700; letter-spacing:.04em; color:#64748b; text-transform:uppercase; }}
.card h3 {{ margin:0 0 4px; font-size:13.5px; font-weight:600; }}
.stat {{ font-size:12px; color:#64748b; margin-bottom:9px; }}
.card ul {{ margin:0; padding-left:18px; }}
.card li {{ margin:6px 0; }}
.actions {{ display:flex; gap:8px; margin-top:13px; }}
.btn {{ flex:1; text-align:center; border:1px solid #e5e7eb; border-radius:8px; padding:9px 10px;
  font-size:12.5px; font-weight:500; color:#1f2937; background:#fff; }}
.note {{ font-size:11px; color:#64748b; margin-top:10px; }}
.source {{ font-size:11.5px; color:#94a3b8; margin-top:10px; }}
.p-footer {{ display:flex; justify-content:space-between; gap:8px; padding:9px 15px; border-top:1px solid #eef2f7;
  font-size:11px; color:#94a3b8; }}
.p-footer a {{ color:#94a3b8; text-decoration:none; }}
.about-list {{ list-style:none; margin:0 0 12px; padding:0; }}
.about-list li {{ display:flex; gap:10px; margin:10px 0; font-size:13px; align-items:flex-start; }}
.about-ico {{ width:20px; text-align:center; color:#2563eb; font-weight:600; flex-shrink:0; }}
"""

POPUP_HEADER = f"""
<div class="p-header">
  <img src="{ICON}" alt="">
  <div class="p-title">Return Policy Peek</div>
  <div class="p-info">ⓘ</div>
</div>"""

POPUP_FOOTER = """
<div class="p-footer">
  <span>Summarized on your device.</span>
  <a href="#">Made by Rumbo Labs</a>
</div>"""


def popup(inner):
    return f'<div class="popup">{POPUP_HEADER}<div class="p-content">{inner}</div>{POPUP_FOOTER}</div>'


SUMMARY = popup("""
  <div class="badge">🛍️ Store detected</div>
  <div class="card">
    <h2>Return policy</h2>
    <ul>
      <li><strong>Return window:</strong> 14 days from delivery to start a return.</li>
      <li><strong>Condition:</strong> unworn, with the original box and tags.</li>
      <li><strong>Refunds:</strong> to your original payment method within a few days of arrival.</li>
      <li><strong>Return shipping:</strong> free in-store; prepaid label for postal returns.</li>
      <li><strong>Exclusions:</strong> socks, underwear and swimwear can't be returned.</li>
    </ul>
  </div>
  <div class="actions"><span class="btn">↗ View full policy</span><span class="btn">🔎 Check reviews</span></div>
  <div class="source">Source: sivasdescalzo.com</div>
""")

REVIEWS = popup("""
  <div class="badge">🛍️ Store detected</div>
  <div class="card soft">
    <h3>What shoppers say about returns</h3>
    <div class="stat">Based on 9 Trustpilot reviews mentioning returns · ★2</div>
    <ul>
      <li><strong>Sizing returns are common</strong> — many buyers returned items over fit.</li>
      <li><strong>Refund delays</strong> — some report refunds taking weeks to arrive.</li>
      <li><strong>Return shipping</strong> — a few paid postage to send items back.</li>
      <li><strong>On the plus side</strong> — others had smooth, hassle-free refunds.</li>
    </ul>
    <div class="actions"><span class="btn">↗ View on Trustpilot</span></div>
    <div class="note">Reads the store's public Trustpilot page — only when you tap this.</div>
  </div>
""")

ABOUT = popup("""
  <h2 style="margin:0 0 4px;font-size:15px;font-weight:600;">About</h2>
  <p style="margin:0 0 12px;color:#64748b;font-size:13px;">See any store's return policy in one click.</p>
  <ul class="about-list">
    <li><span class="about-ico">🔒</span><span>Privacy-first: policies are summarized on your device by Chrome's built-in AI. Nothing you browse leaves your browser.</span></li>
    <li><span class="about-ico">🚫</span><span>No backend, no accounts, no tracking — no servers or analytics.</span></li>
    <li><span class="about-ico">🌐</span><span>Works in English, Spanish, and French.</span></li>
    <li><span class="about-ico">&lt;/&gt;</span><span>Open source, so anyone can inspect exactly what it does.</span></li>
  </ul>
  <p style="margin:0;font-size:13px;">Made by <span style="color:#2563eb;font-weight:600;">Rumbo Labs</span> · Version 0.2.4</p>
""")


def screenshot_html(eyebrow, headline, sub, popup_html, bg):
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>{BASE_CSS}
    body {{ width:1280px; height:800px; background:{bg}; }}
    .stage {{ width:1280px; height:800px; }}
    .copy {{ flex:1; }}
    .right {{ width:520px; display:flex; align-items:center; justify-content:center; }}
    </style></head><body>
    <div class="stage">
      <div class="copy">
        <div class="eyebrow">{eyebrow}</div>
        <h1 class="headline">{headline}</h1>
        <p class="sub">{sub}</p>
        <div class="brandline">On-device AI · No backend · EN / ES / FR · <a href="#">rumbolabs.net</a></div>
      </div>
      <div class="right">{popup_html}</div>
    </div></body></html>"""


def promo_html(w, h, icon_px, title_px, layout):
    if layout == "row":
        inner = f"""
        <div style="display:flex;align-items:center;gap:40px;">
          <img src="{ICON}" style="width:{icon_px}px;height:{icon_px}px;border-radius:{int(icon_px*0.22)}px;box-shadow:0 16px 40px rgba(0,0,0,.28);">
          <div>
            <div style="font-size:{title_px}px;font-weight:800;color:#fff;letter-spacing:-0.02em;">Return Policy Peek</div>
            <div style="font-size:{int(title_px*0.5)}px;color:#dbe6ff;margin-top:12px;">Any store's return policy, in one click — private, on-device.</div>
            <div style="font-size:{int(title_px*0.4)}px;color:#a9c2ff;margin-top:14px;">Made by Rumbo Labs</div>
          </div>
        </div>"""
    else:
        inner = f"""
        <div style="text-align:center;">
          <img src="{ICON}" style="width:{icon_px}px;height:{icon_px}px;border-radius:{int(icon_px*0.22)}px;box-shadow:0 14px 34px rgba(0,0,0,.3);">
          <div style="font-size:{title_px}px;font-weight:800;color:#fff;margin-top:20px;letter-spacing:-0.01em;">Return Policy Peek</div>
          <div style="font-size:{int(title_px*0.62)}px;color:#dbe6ff;margin-top:8px;">Return policies, in one click.</div>
        </div>"""
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>{BASE_CSS}
    body {{ width:{w}px; height:{h}px;
      background:linear-gradient(135deg,#2563eb 0%,#1e40af 100%);
      display:flex; align-items:center; justify-content:center; }}
    </style></head><body>{inner}</body></html>"""


ASSETS = [
    ("screenshot-1-summary.png", 1280, 800, screenshot_html(
        "🛍️ One click", "Any return policy,<br>in one click.",
        "Return Policy Peek finds the store's return policy and summarizes what actually matters — window, refunds, who pays shipping — privately on your device.",
        SUMMARY, "#f6f8fc")),
    ("screenshot-2-reviews.png", 1280, 800, screenshot_html(
        "🔎 Reviews on returns", "See how returns<br>really go.",
        "Optional, opt-in: summarize what real customers say about a store's returns and refunds, straight from its public Trustpilot page — on-device.",
        REVIEWS, "#f2f6fd")),
    ("screenshot-3-privacy.png", 1280, 800, screenshot_html(
        "🔒 Private by design", "On-device.<br>No backend.",
        "The policy text never leaves your browser. No accounts, no tracking, no servers — and fully open source, so anyone can verify it.",
        ABOUT, "#f6f8fc")),
    ("promo-small-440x280.png", 440, 280, promo_html(440, 280, 96, 30, "col")),
    ("promo-marquee-1400x560.png", 1400, 560, promo_html(1400, 560, 190, 74, "row")),
]


def render(name, w, h, html):
    os.makedirs(OUT, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False) as f:
        f.write(html)
        src = f.name
    dst = os.path.join(OUT, name)
    subprocess.run([
        CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
        "--force-device-scale-factor=1", f"--window-size={w},{h}",
        "--virtual-time-budget=1500", f"--screenshot={dst}", f"file://{src}",
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    os.unlink(src)
    return dst


def main():
    for name, w, h, html in ASSETS:
        dst = render(name, w, h, html)
        print(f"  {name}  ({w}x{h})")
    print(f"\nStore assets written to {os.path.relpath(OUT, ROOT)}/")


if __name__ == "__main__":
    main()
