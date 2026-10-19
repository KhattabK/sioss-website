"""Build the TikTok ad (1080x1920) for the SIOSS25 launch offer.

Every scene has its own background that matches what it says: the promo
footage (videos/hero.mp4) for the coaching hook, and for each course a clip
or photo from that course (marketing/tiktok-ad/media, cut from the course
videos and slides). Each scene's Arabic text is an HTML overlay, screenshot
by headless Edge with a transparent background, then composited over the
background with the ffmpeg bundled in imageio-ffmpeg
(pip install imageio-ffmpeg).

    python marketing/tiktok-ad/build.py
Output: marketing/tiktok-ad.mp4
"""
import math, os, random, struct, subprocess, sys, tempfile, wave
from pathlib import Path

import imageio_ffmpeg

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
MEDIA = HERE / "media"
OUT = HERE.parent / "tiktok-ad.mp4"
FF = imageio_ffmpeg.get_ffmpeg_exe()
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
W, H, FPS = 1080, 1920, 30

HERO = ROOT / "videos/hero.mp4"


def clip(path, start, xc=0.5, keep=1.0):
    """Background from a video: start second, horizontal focus 0..1, and the
    top fraction of the picture to keep (cuts off burned-in subtitles)."""
    return {"path": path, "start": start, "xc": xc, "blur": 0, "keep": keep}


def still(path, xc=0.5, blur=0):
    return {"path": path, "start": None, "xc": xc, "blur": blur, "keep": 1.0}


# (icon, name, old price, new price, background, photo shown framed above the card)
COURSES = [
    ("❤️‍🩹", "الإسعافات الأولية والإنعاش", "99$", "74$", still(MEDIA / "cpr.jpg", blur=18), MEDIA / "cpr.jpg"),
    ("⚽", "مدرب اللياقة في كرة القدم", "149$", "112$", clip(MEDIA / "fitness.mp4", 0.0, 0.3, keep=0.84), None),
    ("🧠", "التكتيك في كرة القدم", "149$", "112$", clip(MEDIA / "tactics.mp4", 0.0, 0.5, keep=0.84), None),
    ("📈", "إعداد مدرب HRV", "199$", "149$", still(MEDIA / "hrv.jpg", blur=18), MEDIA / "hrv.jpg"),
    ("💪", "دبلوم المدرب الشخصي", "449$", "337$", clip(ROOT / "videos/video5.mp4", 6.0), None),
    ("🏫", "دبلوم معلمي التربية البدنية", "499$", "374$", still(ROOT / "images/pe-teacher.jpg", xc=0.3), None),
]

# (overlay body, background, duration)
SCENES = [
    ('<div class="shade top"></div><div class="mid">'
     '<h1 class="big">حلمك أن تصبح<br><span class="b">مدرباً محترفاً؟</span></h1></div>', clip(HERO, 4.0), 2.6),
    ('<div class="shade"></div><div class="mid">'
     '<img class="logo" src="{logo}"><div class="pill">منظمة سويدية منذ 2015</div>'
     '<h1>دورات أونلاين<br><span class="b">بشهادات من السويد</span></h1>'
     '<p class="sub">بالعربي · بالفيديو · بالسرعة التي تناسبك</p></div>',
     still(ROOT / "images/bahrain5.jpg", xc=0.45, blur=4), 2.8),
]
for i, (icon, name, old, new, bg, photo) in enumerate(COURSES):
    top = f'<img class="photo" src="{photo.as_uri()}">' if photo else f'<div class="ic">{icon}</div>'
    SCENES.append((
        '<div class="shade"></div><div class="mid">'
        f'<div class="count">الدورة {i + 1} من 6</div>{top if photo else ""}'
        f'<div class="card">{"" if photo else top}<div class="nm">{name}</div>'
        f'<div class="pr"><s>{old}</s> {new}</div><div class="tag">بكود SIOSS25</div></div></div>',
        bg, 1.8))
SCENES += [
    ('<div class="shade"></div><div class="mid">'
     '<img class="cert" src="{cert}"><h1>📜 شهادة صادرة<br><span class="b">من السويد</span></h1>'
     '<p class="sub">بعد الاختبار، باسمك ورقم تحقق</p></div>',
     still(ROOT / "images/bahrain7.jpg", blur=6), 3.0),
    ('<div class="shade"></div><div class="mid">'
     '<div class="pill">عرض الإطلاق</div><h1 class="huge">خصم <span class="g">25%</span></h1>'
     '<p class="sub">على كل الدورات</p><div class="code">SIOSS25</div>'
     '<p class="sub">ينتهي 2 نوفمبر</p></div>',
     still(ROOT / "images/bahrain6.jpg", xc=0.45, blur=6), 3.5),
    ('<div class="shade solid"></div><div class="mid">'
     '<img class="logo lg" src="{logo}"><h1>سجّل الآن</h1><div class="url">sioss.se</div>'
     '<p class="sub">اكتب الموقع في المتصفح أو في جوجل</p></div>', clip(HERO, 70.0), 3.5),
]

CSS = """
* { box-sizing:border-box; margin:0; }
html, body { width:1080px; height:1920px; overflow:hidden; background:transparent; }
body { font-family:'Cairo',sans-serif; color:#fff; position:relative; text-shadow:0 4px 18px rgba(0,0,0,.55); }
.shade { position:absolute; inset:0; background:linear-gradient(180deg,rgba(10,20,38,.15) 0%,rgba(10,20,38,.72) 38%,rgba(10,20,38,.72) 70%,rgba(10,20,38,.2) 100%); }
.shade.top { background:linear-gradient(180deg,rgba(10,20,38,.1) 0%,rgba(10,20,38,.65) 45%,rgba(10,20,38,.1) 75%); }
.shade.solid { background:rgba(10,20,38,.86); }
.mid { position:absolute; left:60px; right:160px; top:260px; bottom:420px; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; gap:22px; }
h1 { font-weight:900; font-size:96px; line-height:1.2; }
h1.big { font-size:112px; }
h1.huge { font-size:150px; line-height:1.1; }
.b { color:#4fc3f7; } .g { color:#f4b942; font-family:'Archivo',sans-serif; direction:ltr; unicode-bidi:isolate; }
.sub { font-size:44px; font-weight:700; color:#e6eefa; }
.pill { background:#f4b942; color:#0a1426; font-weight:800; font-size:42px; padding:8px 34px; border-radius:999px; text-shadow:none; }
.logo { height:110px; } .logo.lg { height:170px; margin-bottom:20px; }
.count { font-size:40px; font-weight:800; color:#f4b942; }
.card { width:100%; background:rgba(10,20,38,.78); border:4px solid #f4b942; border-radius:36px; padding:40px 30px; display:flex; flex-direction:column; align-items:center; gap:14px; }
.ic { font-size:130px; line-height:1.1; text-shadow:none; }
.photo { width:100%; height:560px; object-fit:cover; border-radius:30px; border:5px solid #fff; box-shadow:0 20px 60px rgba(0,0,0,.6); }
.nm { font-size:70px; font-weight:900; line-height:1.25; }
.pr { font-family:'Archivo',sans-serif; font-size:96px; color:#f4b942; direction:ltr; }
.pr s { color:#8ea3bf; font-size:62px; }
.tag { font-size:38px; font-weight:700; color:#cfe0f5; }
.cert { width:820px; border-radius:18px; border:6px solid #fff; box-shadow:0 20px 60px rgba(0,0,0,.6); transform:rotate(-3deg); margin-bottom:24px; }
.code { font-family:'Archivo',sans-serif; font-size:110px; color:#0a1426; background:#f4b942; letter-spacing:6px; padding:6px 44px 14px; border-radius:24px; border:5px dashed #0a1426; text-shadow:none; }
.url { font-family:'Archivo',sans-serif; font-size:130px; color:#4fc3f7; direction:ltr; }
"""

PAGE = """<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&family=Archivo:wght@800&display=swap" rel="stylesheet">
<style>{css}</style></head><body>{body}</body></html>"""


def run(args):
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode:
        sys.exit(r.stderr[-3000:])


def render_overlay(body, path, tmp):
    html = Path(tmp) / (path.stem + ".html")
    html.write_text(PAGE.format(css=CSS, body=body.format(
        logo=(ROOT / "images/logo-white-tight.png").as_uri(),
        cert=(ROOT / "images/cert-sample-ptd.jpg").as_uri())), encoding="utf-8")
    run([EDGE, "--headless", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
         f"--user-data-dir={Path(tmp) / 'edge'}", "--default-background-color=00000000",
         "--virtual-time-budget=6000", f"--window-size={W},{H}", f"--screenshot={path}", html.as_uri()])


def render_scene(overlay, bg, dur, path, intro=0.35):
    # Cover-crop the background to 9:16 around its focus point with a slow
    # push-in, then fade and slide the overlay up over the first `intro`
    # seconds (0 = shown at once).
    if bg["start"] is None:
        src = ["-loop", "1", "-t", str(dur), "-i", str(bg["path"])]
        head = f"[0:v]fps={FPS},"
    else:
        src = ["-i", str(bg["path"])]
        head = f"[0:v]trim=start={bg['start']}:duration={dur},setpts=PTS-STARTPTS,fps={FPS},"
    if bg["keep"] < 1:
        head += f"crop=iw:ih*{bg['keep']}:0:0,"
    blur = f"boxblur={bg['blur']}:2," if bg["blur"] else ""
    vf = (head + f"scale=w='if(gt(a,{W}/{H}),-2,{W})':h='if(gt(a,{W}/{H}),{H},-2)',"
          f"crop={W}:{H}:x='(iw-{W})*{bg['xc']}':y='(ih-{H})/2',{blur}"
          f"scale=w='{W}*(1+0.06*t/{dur})':h=-2:eval=frame,crop={W}:{H},setsar=1[bg];"
          + (f"[1:v]format=rgba,fade=t=in:st=0:d={intro}:alpha=1[ov];" if intro else "[1:v]format=rgba[ov];")
          + (f"[bg][ov]overlay=x=0:y='max(0,60-60*t/{intro})'" if intro else "[bg][ov]overlay=x=0:y=0")
          + ":shortest=1,format=yuv420p[v]")
    run([FF, "-y", "-v", "error", *src, "-loop", "1", "-t", str(dur),
         "-i", str(overlay), "-filter_complex", vf, "-map", "[v]", "-an", "-t", str(dur),
         "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-r", str(FPS), str(path)])


def beat(path, seconds, bpm=124, sr=44100):
    """A plain synthesized four-on-the-floor beat, so the video owns its music."""
    beat_len = 60 / bpm
    rnd = random.Random(7)
    frames = bytearray()
    for n in range(int(seconds * sr)):
        t = n / sr
        pos = t % beat_len
        s = 0.0
        if pos < 0.25:  # kick: falling sine
            s += 0.8 * math.sin(2 * math.pi * (50 + 90 * math.exp(-pos * 30)) * pos) * math.exp(-pos * 9)
        off = (t + beat_len / 2) % beat_len
        if off < 0.05:  # off-beat hat
            s += 0.18 * (rnd.random() * 2 - 1) * math.exp(-off * 90)
        bar = t % (beat_len * 2)
        if beat_len <= bar < beat_len + 0.15:  # clap on 2 and 4
            s += 0.3 * (rnd.random() * 2 - 1) * math.exp(-(bar - beat_len) * 25)
        bass = 0.22 * math.sin(2 * math.pi * [55, 55, 65.4, 49][int(t / (beat_len * 4)) % 4] * t)
        s += bass * min(1, pos * 40) * math.exp(-pos * 3)
        s *= min(1, t / 0.3, (seconds - t) / 1.0)
        v = max(-1, min(1, s * 0.7))
        frames += struct.pack("<hh", int(v * 32767), int(v * 32767))
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes(bytes(frames))


def main():
    with tempfile.TemporaryDirectory() as tmp:
        tmp_p = Path(tmp)
        parts = []
        for i, (body, bg, dur) in enumerate(SCENES):
            ov, part = tmp_p / f"ov{i:02}.png", tmp_p / f"s{i:02}.mp4"
            render_overlay(body, ov, tmp)
            if os.environ.get("KEEP_OVERLAYS"):
                (HERE / "frames").mkdir(exist_ok=True)
                (HERE / "frames" / ov.name).write_bytes(ov.read_bytes())
            # The first frame doubles as the feed preview, so the hook is there from frame 0.
            render_scene(ov, bg, dur, part, intro=0 if i == 0 else 0.35)
            parts.append(part)
            print(f"scene {i + 1}/{len(SCENES)}")
        total = sum(d for _, _, d in SCENES)
        (tmp_p / "list.txt").write_text("".join(f"file '{p.as_posix()}'\n" for p in parts))
        beat(tmp_p / "beat.wav", total)
        run([FF, "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(tmp_p / "list.txt"),
             "-i", str(tmp_p / "beat.wav"), "-c:v", "copy", "-c:a", "aac", "-b:a", "160k",
             "-shortest", "-movflags", "+faststart", str(OUT)])
    print(f"wrote {OUT} ({total:.1f}s)")


if __name__ == "__main__":
    main()
