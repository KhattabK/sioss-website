"""One 15-second vertical ad per course, for TikTok, Reels, Snapchat and Stories.

Each course gets two versions:
    marketing/ads/<id>-offer.mp4    launch offer with the SIOSS25 code (until 2 November)
    marketing/ads/<id>.mp4          regular price, for after the offer ends

    python marketing/tiktok-ad/course_ads.py             # all courses, both versions
    python marketing/tiktok-ad/course_ads.py cpr ptd     # only these courses
    python marketing/tiktok-ad/course_ads.py --offer     # only the offer versions

Scenes: hook question, what you learn, certificate, price, call to action.
Uses the engine in build.py (Edge for the Arabic text, bundled ffmpeg).
"""
import sys
from pathlib import Path

from build import HERE, MEDIA, ROOT, assemble, clip, still

OUT_DIR = HERE.parent / "ads"
OFFER_END = "2 نوفمبر"
VIDEOS = ROOT / "videos"
IMAGES = ROOT / "images"

# Wraps Latin names so they keep their order inside Arabic text.
L = lambda s: f'<bdi dir="ltr">{s}</bdi>'

COURSES = {
    "cpr": dict(
        name="الإسعافات الأولية والإنعاش", price=99, offer=74, cert="cert-sample-cpr.jpg",
        hook='لو سقط شخص أمامك الآن…<br><span class="b">هل تعرف ماذا تفعل؟</span>',
        points=["توقف القلب والإنعاش خطوة بخطوة", f"استخدام جهاز الصدمات {L('AED')}",
                "الاختناق وإسعاف الأطفال", "خطة الطوارئ في النادي والصالة"],
        bgs=[still(MEDIA / "cpr.jpg"), still(MEDIA / "cpr.jpg", blur=14), still(MEDIA / "cpr.jpg", blur=22),
             still(MEDIA / "cpr.jpg", xc=0.7, blur=6), still(MEDIA / "cpr.jpg", blur=22)]),
    "ffc": dict(
        name="مدرب اللياقة في كرة القدم", price=149, offer=112, cert="cert-sample-ffc.jpg",
        hook='لاعبوك يتعبون<br><span class="b">في الشوط الثاني؟</span>',
        points=[f"21 وحدة مع المدرب السويدي {L('Fredrik Björs')}", "9 فيديوهات تطبيقية من الملعب",
                "اختبارات اللياقة وتخطيط الموسم", "شرح عربي كامل"],
        bgs=[clip(MEDIA / "fitness-long.mp4", 0.0, 0.35, keep=0.84), clip(MEDIA / "fitness-long.mp4", 16.0, 0.3, keep=0.84),
             clip(MEDIA / "fitness-long.mp4", 8.0, 0.5, keep=0.84), clip(MEDIA / "fitness-long.mp4", 19.5, 0.35, keep=0.84),
             clip(MEDIA / "fitness-long.mp4", 4.0, 0.5, keep=0.84)]),
    "tac": dict(
        name="التكتيك في كرة القدم", price=149, offer=112, cert="cert-sample-tac.jpg",
        hook='الفريق الذي يفوز ليس الأقوى…<br><span class="b">بل الأذكى تكتيكياً</span>',
        points=[f"11 وحدة مع المدرب السويدي {L('Alexander Axén')}", "الضغط والبناء والتحولات",
                "رسوم توضيحية للخطط والتحركات", "شرح عربي كامل واختبارات"],
        bgs=[clip(MEDIA / "tactics-long.mp4", 0.0, 0.55, keep=0.84), clip(MEDIA / "tactics-long.mp4", 6.0, 0.55, keep=0.84),
             clip(MEDIA / "tactics-long.mp4", 12.0, 0.5, keep=0.84), clip(MEDIA / "tactics-long.mp4", 15.5, 0.55, keep=0.84),
             clip(MEDIA / "tactics-long.mp4", 2.0, 0.5, keep=0.84)]),
    "hrv": dict(
        name=f"إعداد مدرب {L('HRV')}", price=199, offer=149, cert="cert-sample-hrv.jpg",
        hook='هل لاعبك جاهز للتمرين اليوم؟<br><span class="b">قلبه يعرف الجواب</span>',
        points=[f"{L('HRV')} ببساطة مع د. عبد العظيم الأوسي", f"القياس بجهاز {L('emWave Pro Plus')}",
                "التنفس الرنيني والتحكم بالتوتر", "مراقبة الجاهزية والتعافي"],
        bgs=[still(MEDIA / "hrv-dr.jpg", xc=0.45), still(MEDIA / "hrv-s12.jpg", blur=10), still(MEDIA / "hrv.jpg", blur=14),
             still(MEDIA / "hrv-s17.jpg", xc=0.5, blur=12), still(MEDIA / "hrv-dr.jpg", blur=18)]),
    "ptd": dict(
        name="دبلوم المدرب الشخصي", price=449, offer=337, cert="cert-sample-ptd.jpg",
        hook='تريد أن تعمل<br><span class="b">مدرباً شخصياً محترفاً؟</span>',
        points=[f"26 وحدة مع {L('Fredrik Björs')} والكابتن حيدر صباح", "تقنية التمارين وبناء البرامج",
                "التغذية والفئات الخاصة", "شرح عربي كامل وفيديوهات عملية"],
        bgs=[clip(VIDEOS / "video9.mp4", 12.0), clip(VIDEOS / "video5.mp4", 6.0), still(IMAGES / "bahrain2.jpg", blur=8),
             clip(VIDEOS / "video9.mp4", 26.0), clip(VIDEOS / "video8.mp4", 20.0)]),
    "pe": dict(
        name="دبلوم معلمي التربية البدنية", price=499, offer=374, cert="cert-sample-pe.jpg",
        hook='معلم أو معلمة تربية بدنية؟<br><span class="b">هذا الدبلوم لك</span>',
        points=["ثمانية محاور تغطي المهنة كاملة", "أكثر من 200 فيديو تطبيقي",
                "ملخصات علمية جاهزة للحصة", "بالعربي، وأونلاين بالكامل"],
        bgs=[still(IMAGES / "pe-teacher.jpg", xc=0.3), still(IMAGES / "bahrain5.jpg", xc=0.45, blur=6),
             still(IMAGES / "bahrain4.jpg", blur=8), still(IMAGES / "pe-teacher.jpg", xc=0.15, blur=4),
             still(IMAGES / "bahrain4.jpg", blur=12)]),
}

# Braces are doubled: overlay bodies go through str.format in build.render_overlay.
STYLE = """<style>
.list {{ list-style:none; padding:0; margin:0; width:100%; display:grid; gap:18px; }}
.list li {{ background:rgba(10,20,38,.8); border:3px solid rgba(255,255,255,.18); border-radius:26px;
           padding:18px 26px; font-size:46px; font-weight:800; line-height:1.4; text-align:right; }}
.list li::before {{ content:"✓"; color:#f4b942; font-weight:900; margin-left:16px; }}
.head {{ font-size:56px; font-weight:900; color:#f4b942; }}
.course {{ font-size:60px; font-weight:900; line-height:1.3; }}
.cert2 {{ width:860px; border-radius:18px; border:6px solid #fff; box-shadow:0 20px 60px rgba(0,0,0,.6); transform:rotate(-3deg); margin-bottom:20px; }}
.price {{ font-family:'Archivo',sans-serif; font-size:170px; line-height:1; color:#f4b942; direction:ltr; }}
.mid.low {{ justify-content:flex-end; }}
.shade.low {{ background:linear-gradient(180deg,rgba(10,20,38,0) 35%,rgba(10,20,38,.8) 62%,rgba(10,20,38,.6) 100%); }}
.price s {{ color:#8ea3bf; font-size:96px; margin-right:24px; }}
</style>"""


def scenes(c, offer):
    bg = c["bgs"]
    price = (f'<div class="pill">عرض الإطلاق · حتى {OFFER_END}</div><p class="course">{c["name"]}</p>'
             f'<div class="price"><s>{c["price"]}$</s>{c["offer"]}$</div>'
             '<p class="sub">بكود</p><div class="code">SIOSS25</div>') if offer else (
             f'<p class="course">{c["name"]}</p><div class="price">{c["price"]}$</div>'
             '<p class="sub">دفعة واحدة · تبدأ فوراً · بدون مواعيد</p>')
    return [
        (f'{STYLE}<div class="shade low"></div><div class="mid low"><h1 class="big">{c["hook"]}</h1></div>', bg[0], 2.8),
        (f'{STYLE}<div class="shade"></div><div class="mid"><div class="head">في دورة {c["name"]}</div>'
         f'<ul class="list">{"".join(f"<li>{p}</li>" for p in c["points"])}</ul></div>', bg[1], 3.8),
        (f'{STYLE}<div class="shade"></div><div class="mid"><img class="cert2" src="{(IMAGES / c["cert"]).as_uri()}">'
         '<h1>📜 شهادة صادرة<br><span class="b">من السويد</span></h1>'
         '<p class="sub">أونلاين · بالعربي · بالسرعة التي تناسبك</p></div>', bg[2], 2.8),
        (f'{STYLE}<div class="shade"></div><div class="mid">{price}</div>', bg[3], 3.2),
        (f'{STYLE}<div class="shade solid"></div><div class="mid">'
         '<img class="logo lg" src="{logo}"><h1>سجّل الآن</h1><div class="url">sioss.se</div>'
         '<p class="sub">اكتب الموقع في المتصفح أو في جوجل</p></div>', bg[4], 3.0),
    ]


def main(argv):
    ids = [a for a in argv if not a.startswith("--")] or list(COURSES)
    versions = [True] if "--offer" in argv else [False] if "--regular" in argv else [True, False]
    for cid in ids:
        for offer in versions:
            print(f"{cid} ({'offer' if offer else 'regular'})")
            assemble(scenes(COURSES[cid], offer), OUT_DIR / f"{cid}{'-offer' if offer else ''}.mp4")


if __name__ == "__main__":
    main(sys.argv[1:])
