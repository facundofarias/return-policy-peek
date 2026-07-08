#!/usr/bin/env python3
"""Generate Chrome Web Store marketing assets (screenshots + promo tiles) by
rendering branded HTML mockups with headless Chrome. Output is 24-bit PNG with
no alpha — exactly what the CWS dashboard requires.

Screenshots are produced for EN (global/default), ES, and FR. The mock popup
reuses the real extension's UI strings from _locales/*/messages.json so the
screenshots match what users actually see.

Usage:  python3 tools/gen_store_assets.py
Output: dist/store-assets/*.png
"""
import base64
import json
import os
import subprocess
import tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "dist", "store-assets")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
LOCALES = ["en", "es", "fr"]

with open(os.path.join(ROOT, "icons", "icon128.png"), "rb") as f:
    ICON = "data:image/png;base64," + base64.b64encode(f.read()).decode()


def load_msgs(loc):
    with open(os.path.join(ROOT, "_locales", loc, "messages.json"), encoding="utf-8") as f:
        return {k: v["message"] for k, v in json.load(f).items()}


MSG = {loc: load_msgs(loc) for loc in LOCALES}

FONT = "system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif"

# --- Marketing copy + example content per locale ------------------------------
MARKET = {
    "en": {
        "s1_eyebrow": "🛍️ One click",
        "s1_head": "Any return policy,<br>in one click.",
        "s1_sub": "Return Policy Peek finds the store's return policy and summarizes what actually matters — window, refunds, who pays shipping — privately on your device.",
        "s2_eyebrow": "🔎 Reviews on returns",
        "s2_head": "See how returns<br>really go.",
        "s2_sub": "Optional and opt-in: summarize what real customers say about a store's returns and refunds, straight from its public Trustpilot page — on-device.",
        "s3_eyebrow": "🔒 Private by design",
        "s3_head": "On-device.<br>No backend.",
        "s3_sub": "The policy text never leaves your browser. No accounts, no tracking, no servers — and fully open source, so anyone can verify it.",
        "brandline": "On-device AI · No backend · EN / ES / FR · rumbolabs.net",
        "sum": [
            "<strong>Return window:</strong> 14 days from delivery to start a return.",
            "<strong>Condition:</strong> unworn, with the original box and tags.",
            "<strong>Refunds:</strong> to your original payment method within a few days.",
            "<strong>Return shipping:</strong> free in-store; prepaid label by post.",
            "<strong>Exclusions:</strong> socks, underwear and swimwear can't be returned.",
        ],
        "rev": [
            "<strong>Sizing returns are common</strong> — many buyers returned items over fit.",
            "<strong>Refund delays</strong> — some report refunds taking weeks to arrive.",
            "<strong>Return shipping</strong> — a few paid postage to send items back.",
            "<strong>On the plus side</strong> — others had smooth, hassle-free refunds.",
        ],
        "source": "Source: sivasdescalzo.com",
        "version": "Version 1.1.0",
    },
    "es": {
        "s1_eyebrow": "🛍️ Un clic",
        "s1_head": "Cualquier política<br>de devoluciones, en un clic.",
        "s1_sub": "Vistazo a Devoluciones encuentra la política de la tienda y resume lo que de verdad importa —plazo, reembolsos, quién paga el envío— en tu dispositivo.",
        "s2_eyebrow": "🔎 Opiniones sobre devoluciones",
        "s2_head": "Cómo van<br>las devoluciones.",
        "s2_sub": "Opcional: resume lo que dicen los clientes reales sobre las devoluciones y reembolsos de una tienda, desde su página pública de Trustpilot, en tu dispositivo.",
        "s3_eyebrow": "🔒 Privada por diseño",
        "s3_head": "En tu dispositivo.<br>Sin backend.",
        "s3_sub": "El texto de la política nunca sale de tu navegador. Sin cuentas, sin seguimiento, sin servidores, y de código abierto para que cualquiera lo verifique.",
        "brandline": "IA en el dispositivo · Sin backend · EN / ES / FR · rumbolabs.net",
        "sum": [
            "<strong>Plazo de devolución:</strong> 14 días desde la entrega para iniciarla.",
            "<strong>Estado:</strong> sin usar, con la caja y las etiquetas originales.",
            "<strong>Reembolsos:</strong> a tu método de pago original en pocos días.",
            "<strong>Envío de devolución:</strong> gratis en tienda; etiqueta prepagada por correo.",
            "<strong>Exclusiones:</strong> calcetines, ropa interior y bañadores no se devuelven.",
        ],
        "rev": [
            "<strong>Devoluciones por talla frecuentes</strong>: muchos devolvieron por el ajuste.",
            "<strong>Reembolsos lentos</strong>: algunos tardan semanas en llegar.",
            "<strong>Gastos de envío</strong>: unos pocos pagaron el envío de vuelta.",
            "<strong>Lo positivo</strong>: otros tuvieron reembolsos rápidos y sin problemas.",
        ],
        "source": "Fuente: sivasdescalzo.com",
        "version": "Versión 1.1.0",
    },
    "fr": {
        "s1_eyebrow": "🛍️ Un clic",
        "s1_head": "Toute politique<br>de retour, en un clic.",
        "s1_sub": "Aperçu des Retours trouve la politique de la boutique et résume l'essentiel —délai, remboursements, frais de retour— sur votre appareil.",
        "s2_eyebrow": "🔎 Avis sur les retours",
        "s2_head": "Comment se passent<br>les retours.",
        "s2_sub": "Facultatif : résume ce que disent de vrais clients sur les retours et remboursements d'une boutique, depuis sa page publique Trustpilot, sur votre appareil.",
        "s3_eyebrow": "🔒 Confidentiel par conception",
        "s3_head": "Sur l'appareil.<br>Sans backend.",
        "s3_sub": "Le texte de la politique ne quitte jamais votre navigateur. Sans compte, sans suivi, sans serveur, et open source pour que chacun puisse le vérifier.",
        "brandline": "IA sur l'appareil · Sans backend · EN / ES / FR · rumbolabs.net",
        "sum": [
            "<strong>Délai de retour :</strong> 14 jours après la livraison pour le lancer.",
            "<strong>État :</strong> non porté, avec la boîte et les étiquettes d'origine.",
            "<strong>Remboursements :</strong> sur votre moyen de paiement d'origine sous quelques jours.",
            "<strong>Frais de retour :</strong> gratuit en boutique ; étiquette prépayée par la poste.",
            "<strong>Exclusions :</strong> chaussettes, sous-vêtements et maillots non retournables.",
        ],
        "rev": [
            "<strong>Retours de taille fréquents</strong> : beaucoup ont renvoyé pour la taille.",
            "<strong>Remboursements lents</strong> : certains attendent des semaines.",
            "<strong>Frais de retour</strong> : quelques-uns ont payé le renvoi.",
            "<strong>Côté positif</strong> : d'autres ont été remboursés sans souci.",
        ],
        "source": "Source : sivasdescalzo.com",
        "version": "Version 1.1.0",
    },
}

BASE_CSS = f"""
* {{ box-sizing: border-box; }}
html, body {{ margin: 0; padding: 0; overflow: hidden; font-family: {FONT}; }}
.stage {{ display: flex; align-items: center; }}
.copy {{ padding: 0 64px; flex: 1; }}
.eyebrow {{ display:inline-flex; align-items:center; gap:8px; font-size:15px; font-weight:600;
  color:#2563eb; background:#eff6ff; padding:6px 12px; border-radius:999px; margin-bottom:22px; }}
.headline {{ font-size: 50px; line-height: 1.08; font-weight: 800; color: #0f172a; margin: 0 0 18px; letter-spacing: -0.02em; }}
.sub {{ font-size: 21px; line-height: 1.5; color: #475569; margin: 0; max-width: 520px; }}
.brandline {{ margin-top: 28px; font-size: 15px; color: #64748b; }}
.right {{ width: 520px; display: flex; align-items: center; justify-content: center; }}

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
.about-list {{ list-style:none; margin:0 0 12px; padding:0; }}
.about-list li {{ display:flex; gap:10px; margin:10px 0; font-size:13px; align-items:flex-start; }}
.about-ico {{ width:20px; text-align:center; color:#2563eb; font-weight:600; flex-shrink:0; }}
"""


def header(loc):
    return (
        f'<div class="p-header"><img src="{ICON}" alt="">'
        f'<div class="p-title">{MSG[loc]["extName"]}</div><div class="p-info">ⓘ</div></div>'
    )


def footer(loc):
    return (
        f'<div class="p-footer"><span>{MSG[loc]["privacyNote"].split(".")[0]}.</span>'
        f'<span>{MSG[loc]["madeBy"]} Rumbo Labs</span></div>'
    )


def popup(loc, inner):
    return f'<div class="popup">{header(loc)}<div class="p-content">{inner}</div>{footer(loc)}</div>'


def summary_popup(loc):
    m, k = MSG[loc], MARKET[loc]
    bullets = "".join(f"<li>{b}</li>" for b in k["sum"])
    pill = (f'<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;'
            f'font-weight:600;padding:3px 8px;border-radius:999px;background:#ecfdf5;'
            f'color:#059669;white-space:nowrap;">🟢 {m["rating_good"]}</span>')
    return popup(loc, f"""
      <div class="badge">🛍️ {m["storeDetected"]}</div>
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px;">
          <h2 style="margin:0;">{m["returnPolicyHeading"]}</h2>{pill}
        </div>
        <ul>{bullets}</ul>
      </div>
      <div class="actions"><span class="btn">↗ {m["viewFullPolicy"]}</span><span class="btn">🔎 {m["checkReviews"]}</span></div>
      <div class="source">{k["source"]}</div>
    """)


def reviews_popup(loc):
    m, k = MSG[loc], MARKET[loc]
    stat = m["reviewsCount"].replace("$count$", "9") + " · ★2"
    bullets = "".join(f"<li>{b}</li>" for b in k["rev"])
    return popup(loc, f"""
      <div class="badge">🛍️ {m["storeDetected"]}</div>
      <div class="card soft">
        <h3>{m["reviewsHeading"]}</h3>
        <div class="stat">{stat}</div>
        <ul>{bullets}</ul>
        <div class="actions"><span class="btn">↗ {m["reviewsViewSource"]}</span></div>
        <div class="note">{m["reviewsPrivacyNote"]}</div>
      </div>
    """)


def about_popup(loc):
    m, k = MSG[loc], MARKET[loc]
    items = [
        ("🔒", m["aboutPrivacy"]),
        ("🚫", m["aboutNoBackend"]),
        ("🌐", m["aboutLanguages"]),
        ("&lt;/&gt;", m["aboutOpenSource"]),
    ]
    lis = "".join(f'<li><span class="about-ico">{ic}</span><span>{tx}</span></li>' for ic, tx in items)
    return popup(loc, f"""
      <h2 style="margin:0 0 4px;font-size:15px;font-weight:600;">{m["aboutTitle"]}</h2>
      <p style="margin:0 0 12px;color:#64748b;font-size:13px;">{m["aboutTagline"]}</p>
      <ul class="about-list">{lis}</ul>
      <p style="margin:0;font-size:13px;">{m["madeBy"]} <span style="color:#2563eb;font-weight:600;">Rumbo Labs</span> · {k["version"]}</p>
    """)


def screenshot_html(loc, num, popup_html, bg):
    k = MARKET[loc]
    return f"""<!doctype html><html lang="{loc}"><head><meta charset="utf-8"><style>{BASE_CSS}
    body {{ width:1280px; height:800px; background:{bg}; }}
    .stage {{ width:1280px; height:800px; }}
    </style></head><body>
    <div class="stage">
      <div class="copy">
        <div class="eyebrow">{k[f"s{num}_eyebrow"]}</div>
        <h1 class="headline">{k[f"s{num}_head"]}</h1>
        <p class="sub">{k[f"s{num}_sub"]}</p>
        <div class="brandline">{k["brandline"]}</div>
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


def render(name, w, h, html):
    os.makedirs(OUT, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as f:
        f.write(html)
        src = f.name
    dst = os.path.join(OUT, name)
    subprocess.run([
        CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
        "--force-device-scale-factor=1", f"--window-size={w},{h}",
        "--virtual-time-budget=1500", f"--screenshot={dst}", f"file://{src}",
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    os.unlink(src)
    print(f"  {name}  ({w}x{h})")


def main():
    bgs = ["#f6f8fc", "#f2f6fd", "#f6f8fc"]
    builders = [summary_popup, reviews_popup, about_popup]
    names = ["summary", "reviews", "privacy"]
    for loc in LOCALES:
        suffix = "" if loc == "en" else f"-{loc}"
        for i, (name, build, bg) in enumerate(zip(names, builders, bgs), start=1):
            html = screenshot_html(loc, i, build(loc), bg)
            render(f"screenshot-{i}-{name}{suffix}.png", 1280, 800, html)
    render("promo-small-440x280.png", 440, 280, promo_html(440, 280, 96, 30, "col"))
    render("promo-marquee-1400x560.png", 1400, 560, promo_html(1400, 560, 190, 74, "row"))
    print(f"\nStore assets written to {os.path.relpath(OUT, ROOT)}/")


if __name__ == "__main__":
    main()
