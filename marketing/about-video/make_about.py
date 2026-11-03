"""The SIOSS «من نحن» video: a presenter (new face, not used on EIAST) introduces the organisation, and each
sentence cuts to its own picture from the site: the director's photo, the journal cover, the course covers,
certificates and course photos. The presenter stays on screen in a round bubble during those shots.

    python marketing/about-video/make_about.py           # narrate + render presenter + compose
    python marketing/about-video/make_about.py compose   # compose again from the files in work/
Writes marketing/about-video/sioss-about-16x9.mp4 (site, «من نحن») and sioss-about-9x16.mp4 (TikTok/Reels).

Voice: ElevenLabs «Abdullah» with character timings, so every picture appears on its own words.
Presenter: HeyGen Onat_Suit_Front_public on a green background, keyed out here and set on the SIOSS backdrop.
Keys are read from the EIAST project (elevenlabs-key.txt, heygen-key.txt, both git-ignored there).
Text layers are drawn by headless Edge (Tajawal), so the Arabic is shaped correctly; ffmpeg from imageio-ffmpeg.
"""
import base64, json, math, os, re, subprocess, sys, time, urllib.request, uuid, wave
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
IMG = ROOT / "images"
WORK = HERE / "work"
KEYS = Path(r"C:\Users\D.M.F\Desktop\EIAST-Academy")
FF = imageio_ffmpeg.get_ffmpeg_exe()
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
VOICE = "pCKbQ4EPGE06zpEPGNvS"  # Abdullah, Arabic news & corporate; not used by any EIAST course
AVATAR = "Onat_Suit_Front_public"
GREEN = "#00B140"
FPS = 30

# Spoken sentences (diacritics only where a voice may misread); SUBS are the same sentences as shown on screen.
LINES = [
    "مرحباً بكم في المنظمة السُّوَيْدية الدولية للعلوم الرياضية، سِيوس.",
    "تأسست منظمتنا في السُّوَيْد عام ألفين وخمسة عشر، ومَقَرُّها مدينة لِينشوبينغ.",
    "وهي مؤسسة تعليمية متخصصة في تدريب المدربين الرياضيين وتطويرهم، في مختلف التخصصات.",
    "يقود المنظمة الدكتور عبد العظيم أحمد الأَوْسي: خبير القيادة الاستراتيجية والأداء العالي، "
    "مدير المنظمة السُّوَيْدية الدولية للعلوم الرياضية سِيوس، وأستاذ مادة الرياضة والصحة في السُّوَيْد، "
    "ومدرب إتش آر في، والباحث في علوم الرياضة.",
    "مهمتنا نقل علوم الرياضة الحديثة وتقنياتها إلى المنطقة العربية وما وراءها، وفق المعايير الدولية.",
    "ونُصدر مجلة علمية مُحَكَّمة، هي مجلة سِيوس لعلوم الرياضة.",
    "ونقدّم دوراتنا حضورياً وعبر الإنترنت: دبلوم المدرب الشخصي، والإسعافات الأولية والإنعاش، "
    "ومدرب اللياقة في كرة القدم، والتكتيك في كرة القدم، وإعداد مدرب إتش آر في، ودبلوم معلمي التربية البدنية.",
    "وكل دورة تنتهي بشهادة من سِيوس.",
    "سِيوس، حيث يلتقي العلم بالرياضة. ابدأ رحلتك معنا اليوم.",
]
TEXT = " ".join(LINES)
plain = lambda s: re.sub(r"[\u064B-\u0652]", "", s).replace("إتش آر في", "HRV").replace("سيوس", "SIOSS")

# Course names as spoken in LINES[6], each with its cover; the cover changes on the first letter of its name.
COURSES = [("دبلوم المدرب الشخصي", "og-ptd.jpg"), ("الإسعافات الأولية والإنعاش", "og-cpr-v2.jpg"),
           ("مدرب اللياقة في كرة القدم", "og-ffc.jpg"), ("التكتيك في كرة القدم", "og-tac.jpg"),
           ("إعداد مدرب إتش آر في", "og-hrv.jpg"), ("دبلوم معلمي التربية البدنية", "og-pe.jpg")]


# ---------- ElevenLabs + HeyGen ----------
def key(name):
    return (KEYS / name).read_text(encoding="utf-8-sig").strip()


def call(url, headers, data=None):
    with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=headers), timeout=300) as r:
        return r.read()


def narrate(mp3, align_json):
    body = json.dumps({"text": TEXT, "model_id": "eleven_multilingual_v2",
                       "voice_settings": {"stability": 0.55, "similarity_boost": 0.75}}).encode()
    r = json.loads(call(f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}/with-timestamps?output_format=mp3_44100_128",
                        {"xi-api-key": key("elevenlabs-key.txt"), "Content-Type": "application/json"}, body))
    mp3.write_bytes(base64.b64decode(r["audio_base64"]))
    align_json.write_text(json.dumps(r["alignment"], ensure_ascii=False), encoding="utf-8")


def upload(path):
    b = uuid.uuid4().hex
    body = (f"--{b}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{path.name}\"\r\n"
            "Content-Type: audio/mpeg\r\n\r\n").encode() + path.read_bytes() + f"\r\n--{b}--\r\n".encode()
    r = call("https://api.heygen.com/v3/assets", {"X-Api-Key": key("heygen-key.txt"),
                                                    "Content-Type": f"multipart/form-data; boundary={b}"}, body)
    return json.loads(r)["data"]["asset_id"]


def render(asset_id):
    body = json.dumps({"type": "avatar", "avatar_id": AVATAR, "audio_asset_id": asset_id, "title": "SIOSS about 16:9",
                       "resolution": "1080p", "aspect_ratio": "16:9", "engine": {"type": "avatar_iii"},  # Onat has no Avatar IV
                       "background": {"type": "color", "value": GREEN}}).encode()
    try:
        r = call("https://api.heygen.com/v3/videos", {"X-Api-Key": key("heygen-key.txt"), "Content-Type": "application/json"}, body)
    except urllib.error.HTTPError as e:
        sys.exit(f"HeyGen refused: {e.code} {e.read()[:600]}")
    return json.loads(r)["data"]["video_id"]


def wait(video_id):
    while True:
        d = json.loads(call(f"https://api.heygen.com/v3/videos/{video_id}", {"X-Api-Key": key("heygen-key.txt")}))
        d = d.get("data", d)
        if d.get("status") == "completed":
            return d["video_url"]
        if d.get("status") == "failed":
            sys.exit(f"HeyGen failed {video_id}: {d.get('failure_message') or d}")
        time.sleep(20)


# ---------- timings ----------
def char_times():
    a = json.loads((WORK / "alignment.json").read_text(encoding="utf-8"))
    return a["character_start_times_seconds"], a["character_end_times_seconds"]


def at(phrase, line):
    """Second at which `phrase` (inside LINES[line]) starts being spoken."""
    starts, _ = char_times()
    return starts[TEXT.index(LINES[line]) + LINES[line].index(phrase)]


def line_times():
    starts, ends = char_times()
    out = []
    for line in LINES:
        i = TEXT.index(line)
        out.append((starts[i], ends[i + len(line) - 1]))
    return out


def subtitle_chunks():
    """Each line cut at its commas/colon into chunks of at most ~48 letters, with their spoken times."""
    starts, ends = char_times()
    out = []
    for line in LINES:
        base = TEXT.index(line)
        parts = re.split(r"(?<=[،:.])\s+", line)
        merged = []
        for p in parts:
            if merged and len(plain(merged[-1])) + len(plain(p)) < 60:
                merged[-1] += " " + p
            else:
                merged.append(p)
        pos = 0
        for p in merged:
            i = line.index(p, pos); j = i + len(p) - 1; pos = j + 1
            out.append((plain(p).rstrip("،:."), starts[base + i], ends[base + j]))
    return out


# ---------- shots: (start second, kind, picture, title) ----------
def shots():
    t = line_times()
    s = [(0.0, "presenter", None, "open"),
         (t[1][0], "card", None, "sweden"),
         (t[2][0], "photo", "bahrain1.jpg", None),
         (at("وتطويرهم", 2), "photo", "iraq1.jpg", None),
         (t[3][0], "director", "team_khalil.jpg", None),
         (t[4][0], "photo", "bahrain_group.jpg", None),
         (at("إلى المنطقة", 4), "photo", "iraq12.jpg", None),
         (t[5][0], "journal", str(ROOT / "marketing" / "sjss-cover.png"), None),
         (t[6][0], "photo", "iraq9.jpg", "حضورياً وعبر الإنترنت")]
    s += [(at(name, 6), "photo", cover, plain(name)) for name, cover in COURSES]
    s += [(t[7][0], "photo", "iraq6.jpg", None),
          (at("بشهادة", 7), "photo", str(sample_certificate()), "شهادة SIOSS"),
          (t[8][0], "presenter", None, "close")]
    return s


def sample_certificate():
    """The current diploma template (pt/certificate.html, name line Al-Awsi) filled with a sample name and stamped
    «نموذج · SAMPLE»; images/cert-sample-ptd.jpg is older and still carries the previous name."""
    png = WORK / "cert-sample.png"
    if png.exists():
        return png
    s = (ROOT / "pt" / "certificate.html").read_text(encoding="utf-8")
    s = s.replace("<head>", '<head><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@800&display=swap" rel="stylesheet">'
                  f'<base href="{(ROOT / "pt").as_uri()}/">', 1)
    s = re.sub(r'<div class="tools">.*?</div>', "", s, flags=re.S)
    s = re.sub(r"<script.*?</script>", "", s, flags=re.S)
    s = re.sub(r'<img class="sig-img"[^>]*>', "", s)  # course/signature.png is still the handwritten «Khalil»
    for i, v in {"cName": "Ahmed Ali Hassan", "cTitle": "Personal Trainer", "cCourse": "Personal Trainer",
                 "cDate": "1 November 2026", "cNo": "SIOSS-PTD-SAMPLE"}.items():
        s = s.replace(f'id="{i}"></', f'id="{i}">{v}</')
    s = s.replace("@media screen { body { padding:10mm 0; }", "@media screen { body { padding:0; }")
    s = s.replace("</body>", '<div style="position:absolute;left:50%;top:52%;transform:translate(-50%,-50%) rotate(-14deg);'
                  'font:800 54pt Cairo,Archivo,sans-serif;color:rgba(196,40,40,.16);border:6px solid rgba(196,40,40,.16);'
                  'padding:4px 40px;border-radius:14px;z-index:9">نموذج · SAMPLE</div></body>')
    html = WORK / "cert-sample.html"
    html.write_text(s, encoding="utf-8")
    subprocess.run([EDGE, "--headless", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2",
                    f"--user-data-dir={os.environ['TEMP']}\\edge-sioss-{uuid.uuid4().hex[:6]}",
                    "--window-size=1123,794", "--virtual-time-budget=8000", f"--screenshot={png}", html.as_uri()],
                   capture_output=True, timeout=120)
    assert png.exists(), png
    return png


# ---------- drawing ----------
CSS = """@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@500;700;800;900&display=swap');
html,body{margin:0;padding:0;background:transparent;font-family:Cairo,sans-serif;direction:rtl;color:#fff;overflow:hidden}
.e{position:absolute}
.neon{background:linear-gradient(100deg,#22e1ff 0%,#5cf2b8 50%,#b8ff3c 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.gold{color:#facc15}.dim{color:rgba(232,237,244,.82)}
.glass{background:rgba(10,18,32,.62);border:1px solid rgba(255,255,255,.16);border-radius:26px;
       box-shadow:0 20px 60px -10px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.18)}
.pill{background:rgba(5,8,15,.72);border:1.5px solid rgba(34,225,255,.55);border-radius:999px;font-weight:800;
      box-shadow:0 0 28px rgba(34,225,255,.25)}
.bar{height:5px;border-radius:3px;background:linear-gradient(90deg,#22e1ff,#b8ff3c)}
"""
LOGO = (IMG / "logo-white.png").as_uri()


def edge_png(name, body, WH):
    d = WORK / f"{WH[0]}x{WH[1]}"; d.mkdir(parents=True, exist_ok=True)
    hp, png = d / f"{name}.html", d / f"{name}.png"
    hp.write_text(f'<!doctype html><html lang="ar"><head><meta charset="utf-8"><style>{CSS}</style></head>'
                  f'<body style="width:{WH[0]}px;height:{WH[1]}px;position:relative">{body}</body></html>', encoding="utf-8")
    if not png.exists() or os.environ.get("REDO"):
        png.unlink(missing_ok=True)
        subprocess.run([EDGE, "--headless", "--disable-gpu", "--hide-scrollbars", "--default-background-color=00000000",
                        f"--user-data-dir={os.environ['TEMP']}\\edge-sioss-{uuid.uuid4().hex[:6]}", "--force-device-scale-factor=1",
                        f"--window-size={WH[0]},{WH[1]}", "--virtual-time-budget=8000", f"--screenshot={png}", hp.as_uri()],
                       capture_output=True, timeout=120)
    assert png.exists(), png
    return png


def backdrop(WH):
    """Night background with the cyan and lime glows of glass.css."""
    W, H = WH
    return edge_png("backdrop", f'''<div class="e" style="inset:0;background:#05080f"></div>
<div class="e" style="width:{W}px;height:{H}px;left:0;top:0;background:
 radial-gradient(ellipse 60% 55% at 85% 15%,rgba(34,225,255,.30),transparent 70%),
 radial-gradient(ellipse 55% 50% at 10% 90%,rgba(184,255,60,.20),transparent 70%),
 radial-gradient(ellipse 45% 40% at 50% 55%,rgba(26,111,196,.28),transparent 75%)"></div>
<div class="e" style="inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),
 linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:80px 80px"></div>''', WH)


def cards(kind, title, WH):
    """Text layers of a shot: list of (png, appear second)."""
    W, H = WH
    V = H > W
    L = []
    def add(name, html, t0):
        L.append((edge_png(name, html, WH), t0))
    if kind == "presenter" and title == "open":
        r, top = (70, 150) if V else (110, 250)
        add("open1", f'<img class="e" src="{LOGO}" style="right:{r}px;top:{top}px;height:{150 if V else 190}px">', 0.2)
        add("open2", f'<div class="e" style="right:{r}px;top:{top + (175 if V else 220)}px;font-size:{50 if V else 54}px;font-weight:900;line-height:1.35;width:{W - 2 * r if V else 780}px">'
                     'المنظمة السويدية الدولية<br><span class="neon">للعلوم الرياضية</span></div>', 0.7)
        add("open3", f'<div class="e bar" style="right:{r}px;top:{top + (345 if V else 400)}px;width:200px"></div>'
                     f'<div class="e dim" style="right:{r}px;top:{top + (365 if V else 425)}px;font-size:{34 if V else 36}px;font-weight:700;direction:ltr">'
                     'Swedish International Organization of Sport Science</div>', 1.3)
    elif kind == "presenter":
        r, top = (70, 150) if V else (110, 280)
        add("close1", f'<img class="e" src="{LOGO}" style="right:{r}px;top:{top}px;height:{150 if V else 190}px">', 0.2)
        add("close2", f'<div class="e" style="right:{r}px;top:{top + (180 if V else 225)}px;font-size:{56 if V else 60}px;font-weight:900">'
                      'حيث يلتقي <span class="neon">العلم</span> بالرياضة</div>', 0.8)
        add("close3", f'<div class="e pill" style="right:{r}px;top:{top + (290 if V else 345)}px;font-size:{40 if V else 42}px;padding:10px 34px;direction:ltr">www.sioss.se</div>', 2.0)
    elif kind == "card":  # founded in Sweden, 2015, Linköping
        flag = ('<div style="width:{w}px;height:{h}px;background:#006aa7;position:relative;border-radius:10px;overflow:hidden;'
                'box-shadow:0 10px 40px rgba(0,0,0,.5)"><div style="position:absolute;left:{x}px;top:0;bottom:0;width:{b}px;background:#fecc00"></div>'
                '<div style="position:absolute;top:{y}px;left:0;right:0;height:{b}px;background:#fecc00"></div></div>')
        fw = 360 if V else 400
        add("sw1", f'<div class="e" style="left:50%;top:{420 if V else 170}px;transform:translateX(-50%)">'
                   + flag.format(w=fw, h=fw * 5 // 8, x=fw * 5 // 16, y=fw * 5 // 16 - fw // 16, b=fw // 8) + '</div>', 0.1)
        add("sw2", f'<div class="e" style="left:0;right:0;top:{700 if V else 450}px;text-align:center;font-size:{150 if V else 170}px;font-weight:900;line-height:1" class="neon"><span class="neon">2015</span></div>', 0.5)
        add("sw3", f'<div class="e" style="left:0;right:0;top:{900 if V else 650}px;text-align:center;font-size:{56 if V else 58}px;font-weight:800">'
                   'تأسست في <span class="gold">السويد</span></div>'
                   f'<div class="e dim" style="left:0;right:0;top:{990 if V else 740}px;text-align:center;font-size:40px;font-weight:700;direction:ltr">Linköping · Sweden</div>', 1.0)
    elif kind == "director":  # each title appears as it is spoken
        rows = [("د. عبد العظيم أحمد الأوسي", "", 0.4),
                ("خبير القيادة الاستراتيجية والأداء العالي", "neon", at("خبير", 3) - line_times()[3][0]),
                ("مدير المنظمة السويدية الدولية للعلوم الرياضية", "", at("مدير", 3) - line_times()[3][0]),
                ("أستاذ مادة الرياضة والصحة في السويد", "dim", at("وأستاذ", 3) - line_times()[3][0]),
                ("مدرب HRV وعالم رياضة", "dim", at("ومدرب", 3) - line_times()[3][0])]
        if V:
            add("dir-bg", '<div class="e glass" style="left:60px;right:60px;top:1110px;height:330px"></div>', 0.2)
            tops, sizes, r = [1130, 1210, 1265, 1315, 1365], [50, 34, 31, 30, 30], 96
        else:
            add("dir-bg", '<div class="e bar" style="right:110px;top:250px;width:200px"></div>', 0.2)
            tops, sizes, r = [300, 410, 480, 540, 595], [66, 44, 38, 34, 34], 110
        for n, ((text, cls, t), top, fs) in enumerate(zip(rows, tops, sizes)):
            add(f"dir{n}", f'<div class="e {cls}" style="right:{r}px;top:{top}px;font-size:{fs}px;font-weight:{900 if n == 0 else 800};white-space:nowrap">{text}</div>', t)
    elif kind == "journal":
        if V:
            add("jr", '<div class="e glass" style="left:70px;right:70px;top:1150px;padding:28px 40px">'
                      '<div class="neon" style="font-size:36px;font-weight:800">مجلة علمية محكّمة</div>'
                      '<div style="font-size:50px;font-weight:900">مجلة SIOSS لعلوم الرياضة</div>'
                      '<div class="dim" style="font-size:30px;font-weight:700;direction:ltr;text-align:right">ISSN 2519-6634 · since 2017</div></div>', 0.4)
        else:
            add("jr", '<div class="e" style="right:110px;top:330px;width:900px">'
                      '<div class="bar" style="width:200px;margin-bottom:26px"></div>'
                      '<div class="neon" style="font-size:44px;font-weight:800">مجلة علمية محكّمة</div>'
                      '<div style="font-size:66px;font-weight:900;line-height:1.3">مجلة SIOSS لعلوم الرياضة</div>'
                      '<div class="dim" style="font-size:36px;font-weight:700;direction:ltr;text-align:right;margin-top:8px">ISSN 2519-6634 · since 2017</div></div>', 0.4)
    elif title:  # photo with a label
        n = "lbl-" + uuid.uuid5(uuid.NAMESPACE_URL, title).hex[:8]
        add(n, f'<div class="e pill" style="right:{60 if V else 90}px;top:{V and 190 or 60}px;font-size:{46 if V else 44}px;padding:10px 36px">{title}</div>', 0.15)
    return L


def photo_still(path, WH, kind):
    """2x frame: blurred dark copy of the photo behind it, the photo itself contained with rounded corners."""
    W, H = WH[0] * 2, WH[1] * 2
    V = H > W
    im = Image.open(path)
    im = im.convert("RGBA")
    flat = Image.new("RGB", im.size, (5, 8, 15)); flat.paste(im, mask=im.split()[3])
    bg = Image.open(backdrop(WH)).convert("RGB").resize((W, H))
    if kind not in ("director", "journal"):
        b = flat.copy(); s = max(W / b.width, H / b.height)
        b = b.resize((math.ceil(b.width * s), math.ceil(b.height * s)))
        b = b.crop(((b.width - W) // 2, (b.height - H) // 2, (b.width - W) // 2 + W, (b.height - H) // 2 + H))
        bg = ImageEnhance.Brightness(b.filter(ImageFilter.GaussianBlur(70))).enhance(0.38)
    if V:
        box = (W - 160, int(H * (0.42 if kind in ("director", "journal") else 0.5)))
        cx, cy = W // 2, (int(H * 0.08) + box[1] // 2 + 120) if kind in ("director", "journal") else int(H * 0.43)
    elif kind in ("director", "journal"):
        box, cx, cy = (int(W * 0.36), int(H * 0.8)), int(W * 0.27), H // 2
    else:
        box, cx, cy = (int(W * 0.66), int(H * 0.72)), W // 2, int(H * 0.44)
    s = min(box[0] / flat.width, box[1] / flat.height)
    fg = flat.resize((round(flat.width * s), round(flat.height * s)), Image.LANCZOS)
    x, y = cx - fg.width // 2, cy - fg.height // 2
    mask = Image.new("L", fg.size, 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, fg.width - 1, fg.height - 1), 36, fill=255)
    sh = Image.new("RGBA", (fg.width + 200, fg.height + 200), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((100, 120, 100 + fg.width, 120 + fg.height), 36, fill=(0, 0, 0, 170))
    sh = sh.filter(ImageFilter.GaussianBlur(36))
    bg = bg.convert("RGBA"); bg.alpha_composite(sh, (x - 100, y - 100))
    edge = Image.new("RGBA", (fg.width + 8, fg.height + 8), (0, 0, 0, 0))
    ImageDraw.Draw(edge).rounded_rectangle((0, 0, fg.width + 7, fg.height + 7), 40, fill=(255, 255, 255, 60))
    bg.alpha_composite(edge, (x - 4, y - 4))
    bg.paste(fg, (x, y), mask)
    return bg.convert("RGB")


# Presenter in the raw HeyGen frame (1920x1080): face centre and the square cut used for the bubble.
FACE = (975, 300, 520)
BUBBLE = {(1920, 1080): (300, 46, 1080 - 300 - 46), (1080, 1920): (320, 50, 1180)}


def bubble_parts(WH):
    size = BUBBLE[WH][0]
    d = WORK / f"{WH[0]}x{WH[1]}"; d.mkdir(parents=True, exist_ok=True)
    m, ring, disc = d / "bmask.png", d / "bring.png", d / "bdisc.png"
    k = 4
    im = Image.new("L", (size * k, size * k), 0); ImageDraw.Draw(im).ellipse((0, 0, size * k - 1, size * k - 1), fill=255)
    im.resize((size, size), Image.LANCZOS).save(m)
    g = Image.new("RGBA", (size * k, size * k), (0, 0, 0, 0)); dr = ImageDraw.Draw(g)  # cyan ring, thin lime inner line
    dr.ellipse((0, 0, size * k - 1, size * k - 1), outline=(34, 225, 255, 255), width=6 * k)
    dr.ellipse((6 * k, 6 * k, size * k - 1 - 6 * k, size * k - 1 - 6 * k), outline=(184, 255, 60, 160), width=2 * k)
    g.resize((size, size), Image.LANCZOS).save(ring)
    Image.open(backdrop(WH)).convert("RGB").crop((0, 0, size, size)).save(disc)
    return m, ring, disc


def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if p.returncode:
        print(p.stderr[-3000:]); raise SystemExit(f"ffmpeg failed")


KEY = f"chromakey=0x{GREEN[1:]}:0.13:0.06,despill=type=green"


def shot(i, t0, dur, kind, pic, title, WH):
    W, H = WH
    V = H > W
    out = WORK / f"{W}x{H}" / f"shot{i:02d}.mp4"
    if out.exists() and not os.environ.get("REDO"):
        return out
    raw = WORK / "presenter-raw.mp4"
    inputs = ["-ss", f"{t0:.3f}", "-t", f"{dur:.3f}", "-i", str(raw)]
    ch = []
    if kind == "presenter":
        inputs += ["-loop", "1", "-framerate", str(FPS), "-t", f"{dur:.3f}", "-i", str(backdrop(WH))]
        if V:
            ch.append(f"[0:v]{KEY},crop=900:1080:510:0,scale=1080:1296[p]")
            ch.append(f"[1:v]scale={W}:{H},setsar=1[bg];[bg][p]overlay=0:{H - 1296}[base]")
        else:
            ch.append(f"[0:v]{KEY}[p];[1:v]scale={W}:{H},setsar=1[bg];[bg][p]overlay=-430:0[base]")
    else:  # a picture, with the presenter in a round bubble (not beside the director's photo or the journal cover)
        if kind == "card":
            bp = backdrop(WH)
        else:
            bp = WORK / f"{W}x{H}" / f"still{i:02d}.png"
            photo_still(pic if os.path.isabs(pic) else IMG / pic, WH, kind).save(bp)
        n = max(1, int(dur * FPS))
        inputs += ["-loop", "1", "-framerate", str(FPS), "-t", f"{dur:.3f}", "-i", str(bp)]
        z = "1+0.05*on/{n}".format(n=n) if kind != "card" else "1"
        ch.append(f"[1:v]scale={2 * W}:{2 * H},zoompan=z='{z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS},setsar=1[bg]")
        size, bx, by = BUBBLE[WH]
        if kind in ("director", "journal"):
            bx = -9999
        m, ring, disc = bubble_parts(WH)
        j = 2
        inputs += ["-i", str(disc), "-i", str(m), "-i", str(ring)]
        fx, fy, fs = FACE
        ch.append(f"[0:v]{KEY},crop={fs}:{fs}:{fx - fs // 2}:{fy - fs // 2 + 60},scale={size}:{size}[pc]")
        ch.append(f"[{j}:v]loop=-1:1,fps={FPS},scale={size}:{size}[dsc];[dsc][pc]overlay=0:0:shortest=1,format=rgb24[pb]")
        ch.append(f"[{j + 1}:v]loop=-1:1,fps={FPS},format=gray[mk];[pb][mk]alphamerge[pbm]")
        ch.append(f"[bg][pbm]overlay={bx}:{by}:shortest=1[b1];[b1][{j + 2}:v]overlay={bx}:{by}[base]")
    last = "base"
    for k, (png, a0) in enumerate(cards(kind, title, WH)):
        idx = inputs.count("-i")
        inputs += ["-loop", "1", "-framerate", str(FPS), "-t", f"{dur:.3f}", "-i", str(png)]
        ease = f"(1-pow(1-min(max((t-{a0})/0.8,0),1),3))"
        ch.append(f"[{idx}:v]format=rgba,fade=in:st={a0}:d=0.6:alpha=1[t{k}]")
        ch.append(f"[{last}][t{k}]overlay=x=0:y='26*(1-{ease})':eval=frame[o{k}]")
        last = f"o{k}"
    ch.append(f"[{last}]format=yuv420p[v]")
    run([FF, "-v", "error", "-y", *inputs, "-filter_complex", ";".join(ch), "-map", "[v]", "-an",
         "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-r", str(FPS), "-t", f"{dur:.3f}", str(out)])
    return out


def end_card(WH):
    W, H = WH
    V = H > W
    png = edge_png("endcard", f'''<img class="e" src="{LOGO}" style="left:50%;top:{560 if V else 220}px;transform:translateX(-50%);height:{300 if V else 300}px">
<div class="e" style="left:0;right:0;top:{920 if V else 560}px;text-align:center;font-size:{50 if V else 54}px;font-weight:900">حيث يلتقي <span class="neon">العلم</span> بالرياضة</div>
<div class="e" style="left:0;right:0;top:{1040 if V else 680}px;text-align:center"><span class="pill" style="display:inline-block;font-size:44px;padding:10px 40px;direction:ltr">www.sioss.se</span></div>''', WH)
    out = WORK / f"{W}x{H}" / "end.mp4"
    run([FF, "-v", "error", "-y", "-loop", "1", "-framerate", str(FPS), "-t", "3.5", "-i", str(backdrop(WH)),
         "-loop", "1", "-framerate", str(FPS), "-t", "3.5", "-i", str(png), "-filter_complex",
         f"[0:v]scale={W}:{H},setsar=1[b];[1:v]format=rgba,fade=in:st=0:d=0.6:alpha=1[t];[b][t]overlay,format=yuv420p[v]",
         "-map", "[v]", "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-r", str(FPS), str(out)])
    return out


def subtitle(n, text, WH):
    W, H = WH
    V = H > W
    width, bottom = (int(W * 0.86), 240) if V else (1160, 52)
    return edge_png(f"sub{n:02d}", f'''<div class="e" style="left:50%;bottom:{bottom}px;transform:translateX(-50%);width:{width}px;text-align:center">
<span style="display:inline;background:rgba(5,8,15,.82);color:#fff;font-size:{46 if V else 42}px;font-weight:800;line-height:1.8;padding:6px 20px;
border-radius:12px;-webkit-box-decoration-break:clone;box-decoration-break:clone">{text}</span></div>''', WH)


def music(total, path):
    """Calm synthesized pad + soft plucks, quiet under the voice."""
    sr = 44100; n = int((total + 1) * sr); t = np.arange(n) / sr
    hz = lambda m: 440 * 2 ** ((m - 69) / 12)
    chords = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 60], [55, 59, 62, 67]]
    bar = 60 / 76 * 4
    out = np.zeros(n)
    for b in range(int(total / bar) + 2):
        ch = chords[b % 4]; st = b * bar; L = bar + 1.2
        i0, i1 = int(st * sr), min(n, int((st + L) * sr))
        if i0 >= n: break
        x = t[i0:i1] - st; e = np.clip(x / 1.5, 0, 1) * np.clip((L - x) / 1.5, 0, 1)
        for m in ch:
            f = hz(m); out[i0:i1] += 0.035 * e * (np.sin(2 * np.pi * f * x) + 0.4 * np.sin(2 * np.pi * f * 1.003 * x))
        out[i0:i1] += 0.06 * e * np.sin(2 * np.pi * hz(ch[0] - 12) * x)
        for k, m in enumerate([ch[0] + 12, ch[2] + 12, ch[1] + 12, ch[3] + 12]):
            ps = st + k * bar / 4; j0 = int(ps * sr); j1 = min(n, j0 + int(2 * sr))
            if j0 >= n: continue
            x2 = t[j0:j1] - ps
            out[j0:j1] += 0.04 * np.exp(-x2 * 2.8) * np.clip(x2 / 0.01, 0, 1) * np.sin(2 * np.pi * hz(m) * x2)
    fade = np.clip(t / 1.5, 0, 1) * np.clip((total - t) / 2.5, 0, 1)
    mix = out * fade; mix = mix / (np.abs(mix).max() + 1e-9) * 0.5
    st = np.stack([mix, np.roll(mix, int(0.012 * sr))], 1)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr); w.writeframes((st * 32767).astype("<i2").tobytes())


def compose(fmt):
    WH = (1920, 1080) if fmt == "16x9" else (1080, 1920)
    W, H = WH
    speech_end = line_times()[-1][1] + 0.6
    sh = shots()
    files = []
    for i, (t0, kind, pic, title) in enumerate(sh):
        t1 = sh[i + 1][0] if i + 1 < len(sh) else speech_end
        # cuts land on frame boundaries so the picture never drifts from the voice
        a, b = round(t0 * FPS) / FPS, round(t1 * FPS) / FPS
        files.append(shot(i, a, b - a, kind, pic, title, WH))
        print(fmt, "shot", i, kind, f"{a:.2f}-{b:.2f}", flush=True)
    files.append(end_card(WH))
    lst = WORK / f"{W}x{H}" / "list.txt"
    lst.write_text("".join(f"file '{f.as_posix()}'\n" for f in files), encoding="utf-8")
    joined = WORK / f"{W}x{H}" / "joined.mp4"
    run([FF, "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(joined)])
    total = round(speech_end * FPS) / FPS + 3.5
    wav = WORK / "music.wav"
    if not wav.exists():
        music(total, wav)
    subs = subtitle_chunks()
    inputs = ["-i", str(joined), "-i", str(WORK / "narration.mp3"), "-i", str(wav)]
    ch, last = [], "0:v"
    for n, (text, s0, s1) in enumerate(subs):
        inputs += ["-i", str(subtitle(n, text, WH))]
        ch.append(f"[{last}][{n + 3}:v]overlay=0:0:enable='between(t,{s0:.2f},{s1 + 0.2:.2f})'[s{n}]")
        last = f"s{n}"
    ch.append(f"[{last}]fade=in:st=0:d=0.5,fade=out:st={total - 0.8:.2f}:d=0.8,format=yuv420p[v]")
    ch.append(f"[1:a]aresample=48000,aformat=channel_layouts=stereo,apad[vo];[2:a]aresample=48000,volume=0.22[mu];[vo][mu]amix=inputs=2:duration=shortest:normalize=0[a]")
    out = HERE / f"sioss-about-{fmt}.mp4"
    run([FF, "-v", "error", "-y", *inputs, "-filter_complex", ";".join(ch), "-map", "[v]", "-map", "[a]",
         "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-profile:v", "high", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-t", f"{total:.3f}", str(out)])
    print("wrote", out, round(total, 1), "s", flush=True)


if __name__ == "__main__":
    WORK.mkdir(parents=True, exist_ok=True)
    if sys.argv[1:2] != ["compose"]:
        mp3, align = WORK / "narration.mp3", WORK / "alignment.json"
        if not mp3.exists():  # a narration from an earlier run is reused, so ElevenLabs is not charged twice
            narrate(mp3, align)
            print("narrated", flush=True)
        vid = render(upload(mp3))
        print("sent to HeyGen", vid, flush=True)
        (WORK / "presenter-raw.mp4").write_bytes(call(wait(vid), {"User-Agent": "sioss"}))
        print("presenter downloaded", flush=True)
    for fmt in [a for a in sys.argv[1:] if a in ("16x9", "9x16")] or ["16x9", "9x16"]:
        compose(fmt)
