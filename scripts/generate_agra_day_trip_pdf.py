#!/usr/bin/env python3
"""Generate the branded Surbhi & Kush Agra day-trip guest PDF."""

from pathlib import Path

from reportlab.lib.colors import Color, HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "guest-materials" / "assets"
FONTS = ASSETS / "fonts"
OUT = ROOT / "guest-materials" / "Agra_Day_Trip_19_Sep_2026_Surbhi_Kush.pdf"

GOLD = HexColor("#785820")
GOLD_SOFT = HexColor("#A8894A")
INK = HexColor("#2A2218")
INK_MUTED = HexColor("#5C5246")
RULE = HexColor("#D4C4A8")
PAPER = HexColor("#FBF8F2")
PAPER_ALT = HexColor("#F5EFE4")


def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont("Cinzel", str(FONTS / "Cinzel-Regular.ttf")))
    pdfmetrics.registerFont(TTFont("Cinzel-SemiBold", str(FONTS / "Cinzel-SemiBold.ttf")))
    pdfmetrics.registerFont(TTFont("Cormorant", str(FONTS / "CormorantGaramond-Regular.ttf")))
    pdfmetrics.registerFont(TTFont("Cormorant-Medium", str(FONTS / "CormorantGaramond-Medium.ttf")))
    pdfmetrics.registerFont(TTFont("Cormorant-SemiBold", str(FONTS / "CormorantGaramond-SemiBold.ttf")))
    pdfmetrics.registerFont(TTFont("Cormorant-Italic", str(FONTS / "CormorantGaramond-Italic.ttf")))
    pdfmetrics.registerFont(TTFont("SourceSans", str(FONTS / "SourceSans3-Regular.ttf")))
    pdfmetrics.registerFont(TTFont("SourceSans-Semi", str(FONTS / "SourceSans3-Semibold.ttf")))
    pdfmetrics.registerFont(TTFont("SourceSans-Light", str(FONTS / "SourceSans3-Light.ttf")))


def draw_page_backdrop(c: canvas.Canvas, width: float, height: float) -> None:
    c.setFillColor(PAPER)
    c.rect(0, 0, width, height, fill=1, stroke=0)

    # Soft corner washes
    c.setFillColor(Color(0.96, 0.93, 0.88, alpha=0.9))
    c.circle(-20 * mm, height + 10 * mm, 70 * mm, fill=1, stroke=0)
    c.circle(width + 25 * mm, -15 * mm, 80 * mm, fill=1, stroke=0)

    # Taj Mahal wireframe watermark
    wm = str(ASSETS / "taj_watermark.png")
    wm_size = 158 * mm
    c.drawImage(
        wm,
        (width - wm_size) / 2,
        (height - wm_size) / 2 - 4 * mm,
        width=wm_size,
        height=wm_size,
        mask="auto",
        preserveAspectRatio=True,
        anchor="c",
    )

    # Outer frame
    c.setStrokeColor(RULE)
    c.setLineWidth(0.6)
    margin = 12 * mm
    c.rect(margin, margin, width - 2 * margin, height - 2 * margin, fill=0, stroke=1)
    c.setStrokeColor(GOLD_SOFT)
    c.setLineWidth(0.35)
    inset = 13.5 * mm
    c.rect(inset, inset, width - 2 * inset, height - 2 * inset, fill=0, stroke=1)


def draw_header(c: canvas.Canvas, width: float, height: float, subtitle: str) -> float:
    logo = str(ASSETS / "sk_logo.png")
    logo_w = 28 * mm
    logo_h = 29 * mm
    c.drawImage(
        logo,
        (width - logo_w) / 2,
        height - 42 * mm,
        width=logo_w,
        height=logo_h,
        mask="auto",
        preserveAspectRatio=True,
    )

    y = height - 48 * mm
    c.setFillColor(GOLD)
    c.setFont("Cinzel", 9)
    c.drawCentredString(width / 2, y, "SURBHI  &  KUSH")

    y -= 4.2 * mm
    c.setStrokeColor(GOLD_SOFT)
    c.setLineWidth(0.5)
    c.line(width / 2 - 28 * mm, y, width / 2 + 28 * mm, y)
    c.circle(width / 2, y, 1.1, fill=1, stroke=0)

    y -= 9 * mm
    c.setFillColor(GOLD)
    c.setFont("Cinzel-SemiBold", 17)
    c.drawCentredString(width / 2, y, subtitle)

    y -= 6 * mm
    c.setFillColor(INK_MUTED)
    c.setFont("Cormorant-Italic", 12)
    c.drawCentredString(width / 2, y, "Saturday, 19 September 2026")
    return y - 6 * mm


def draw_section_label(c: canvas.Canvas, x: float, y: float, text: str) -> float:
    c.setFillColor(GOLD)
    c.setFont("Cinzel", 8.5)
    c.drawString(x, y, text.upper())
    c.setStrokeColor(RULE)
    c.setLineWidth(0.5)
    c.line(x, y - 2.2 * mm, x + 55 * mm, y - 2.2 * mm)
    return y - 7 * mm


def wrap_text(
    c: canvas.Canvas,
    text: str,
    font: str,
    size: float,
    max_width: float,
) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        trial = f"{current} {word}".strip()
        if c.stringWidth(trial, font, size) <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_paragraph(
    c: canvas.Canvas,
    text: str,
    x: float,
    y: float,
    max_width: float,
    font: str = "SourceSans",
    size: float = 9.2,
    leading: float = 13,
    color: Color = INK,
) -> float:
    c.setFillColor(color)
    c.setFont(font, size)
    for line in wrap_text(c, text, font, size, max_width):
        c.drawString(x, y, line)
        y -= leading
    return y


def draw_guests(c: canvas.Canvas, x: float, y: float, width: float) -> float:
    guests = [
        "Violeta Jevtovic",
        "Nikola Jevtovic",
        "Rheina Rutherford",
        "Doug Rutherford",
        "Alicia Rutherford",
        "Caitlin Rutherford",
    ]
    y = draw_section_label(c, x, y, "Guests")
    col_w = width / 2
    c.setFillColor(INK)
    c.setFont("Cormorant-Medium", 11.5)
    for i, name in enumerate(guests):
        col = i % 2
        row = i // 2
        c.drawString(x + col * col_w, y - row * 5.2 * mm, name)
    return y - ((len(guests) + 1) // 2) * 5.2 * mm - 3 * mm


def draw_schedule(c: canvas.Canvas, x: float, y: float, content_w: float) -> float:
    items = [
        ("6:15 am", "Car & driver arrive at JW Marriott Aerocity"),
        ("6:30 am", "Depart Delhi"),
        ("~9:30–10:00 am", "Arrive in Agra and meet your private guide"),
        ("10:00 am–12:00 pm", "Guided visit of the Taj Mahal"),
        ("12:00–12:15 pm", "Meet driver and transfer to lunch"),
        ("12:15–1:15 pm", "Lunch in Agra — guest’s choice"),
        ("1:15 pm", "Depart Agra for Delhi"),
        ("~3:30–3:45 pm", "Expected arrival at JW Marriott Aerocity"),
        ("4:00 pm", "Latest planned return to Delhi"),
    ]
    y = draw_section_label(c, x, y, "Suggested Day Flow")
    time_w = 42 * mm
    for time_label, detail in items:
        c.setFillColor(GOLD)
        c.setFont("SourceSans-Semi", 8.8)
        c.drawString(x, y, time_label)
        c.setFillColor(INK)
        c.setFont("SourceSans", 9.1)
        detail_lines = wrap_text(c, detail, "SourceSans", 9.1, content_w - time_w - 2 * mm)
        for i, line in enumerate(detail_lines):
            c.drawString(x + time_w, y - i * 11.5, line)
        y -= max(len(detail_lines), 1) * 11.5 + 2.8
    return y - 2 * mm


def draw_lunch_options(c: canvas.Canvas, x: float, y: float, content_w: float) -> float:
    options = [
        (
            "Pinch of Spice",
            "Local favourite • North Indian & multi-cuisine",
            "A well-loved Agra restaurant with generous portions and a lively local feel — a strong non-hotel pick near the Taj circuit.",
        ),
        (
            "Dasaprakash",
            "Local • South Indian vegetarian",
            "Classic dosas, thalis and filter coffee in a simple, reliable setting. Ideal if the group wants something lighter and distinctly Indian.",
        ),
        (
            "Shankara Vegetarian Restaurant",
            "Local • Pure vegetarian",
            "Straightforward, well-reviewed vegetarian stop close to the tourist belt — easy, unfussy, and popular with day visitors.",
        ),
        (
            "Heart of Taj Café & Kitchen",
            "Casual • Indian & café-style",
            "Relaxed and convenient option close to the Taj. Good for a quick, easy lunch.",
        ),
        (
            "MoMo Café — Courtyard by Marriott Agra",
            "Hotel dining • International & multi-cuisine",
            "Comfortable international hotel setting with global and Indian dishes. A familiar, easy option.",
        ),
        (
            "Palato — Taj Hotel & Convention Centre",
            "Five-star • International & multi-cuisine",
            "Polished five-star option with European, Asian and Indian dishes in a contemporary setting.",
        ),
        (
            "ITC Mughal",
            "Luxury hotel • Indian & international",
            "Elegant five-star hotel dining with a more elevated atmosphere and several restaurant options.",
        ),
        (
            "Bellevue — The Oberoi Amarvilas",
            "Luxury hotel • Italian, Pan-Asian & Indian",
            "The most indulgent option, with an elegant five-star setting and broad international choices.",
        ),
    ]

    y = draw_section_label(c, x, y, "Lunch Suggestions")
    c.setFillColor(INK_MUTED)
    c.setFont("Cormorant-Italic", 10.5)
    intro = "A mix of local Agra favourites and hotel dining — choose whatever feels right for the group."
    for line in wrap_text(c, intro, "Cormorant-Italic", 10.5, content_w):
        c.drawString(x, y, line)
        y -= 13

    y -= 1.5 * mm
    for idx, (name, style, blurb) in enumerate(options, start=1):
        c.setFillColor(GOLD)
        c.setFont("SourceSans-Semi", 9)
        c.drawString(x, y, f"{idx}.")
        c.setFillColor(INK)
        c.setFont("Cormorant-SemiBold", 11)
        c.drawString(x + 6 * mm, y - 0.4, name)
        y -= 4.2 * mm
        c.setFillColor(GOLD_SOFT)
        c.setFont("SourceSans-Light", 8.2)
        c.drawString(x + 6 * mm, y, style)
        y -= 3.8 * mm
        y = draw_paragraph(
            c,
            blurb,
            x + 6 * mm,
            y,
            content_w - 6 * mm,
            font="SourceSans",
            size=8.6,
            leading=11.5,
            color=INK_MUTED,
        )
        y -= 2.8 * mm
    return y


def draw_footer(c: canvas.Canvas, width: float, page_no: int, total: int) -> None:
    c.setFillColor(GOLD)
    c.setFont("Cinzel", 7)
    c.drawCentredString(width / 2, 17 * mm, "SURBHI & KUSH  ·  WEDDING WEEKEND")
    c.setFillColor(INK_MUTED)
    c.setFont("SourceSans-Light", 7.5)
    c.drawCentredString(width / 2, 13 * mm, f"{page_no} / {total}")


def build_pdf() -> Path:
    register_fonts()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    width, height = A4
    c = canvas.Canvas(str(OUT), pagesize=A4)
    left = 22 * mm
    content_w = width - 2 * left
    total_pages = 2

    # ---- Page 1: Day trip ----
    draw_page_backdrop(c, width, height)
    y = draw_header(c, width, height, "AGRA DAY TRIP")
    y = draw_guests(c, left, y, content_w)

    y = draw_section_label(c, left, y, "Before You Go")
    y = draw_paragraph(
        c,
        "Included & sponsored: Private transportation, tour guide and Taj Mahal entry tickets are already arranged and covered.",
        left,
        y,
        content_w,
        font="SourceSans",
        size=9.1,
        leading=12.5,
    )
    y -= 1.5 * mm
    y = draw_paragraph(
        c,
        "Timings are flexible and can be adjusted to the guests’ convenience. The driver’s phone number will be shared closer to the day for direct communication. Guests are welcome to add or remove stops based on their liking — simply convey this directly to the driver.",
        left,
        y,
        content_w,
        font="SourceSans",
        size=9.1,
        leading=12.5,
    )
    y -= 1.5 * mm
    y = draw_paragraph(
        c,
        "Lunch is at each guest’s preference. Suggested restaurants are listed on the following page; the driver can take you wherever the group would like to eat.",
        left,
        y,
        content_w,
        font="SourceSans",
        size=9.1,
        leading=12.5,
    )
    y -= 3 * mm
    y = draw_schedule(c, left, y, content_w)

    y = draw_section_label(c, left, y + 1 * mm, "A Note on Timing")
    draw_paragraph(
        c,
        "The 1:15 pm departure from Agra is a helpful guide so there is a comfortable buffer for the return journey. Actual travel times may vary with road and traffic conditions, and the day can flex around what the group enjoys most.",
        left,
        y,
        content_w,
        font="SourceSans",
        size=8.8,
        leading=12,
        color=INK_MUTED,
    )
    draw_footer(c, width, 1, total_pages)
    c.showPage()

    # ---- Page 2: Lunch ----
    draw_page_backdrop(c, width, height)
    y = draw_header(c, width, height, "AGRA LUNCH OPTIONS")
    y = draw_lunch_options(c, left, y, content_w)

    y -= 1 * mm
    y = draw_section_label(c, left, y, "Prefer Something Else?")
    y = draw_paragraph(
        c,
        "If none of these feel quite right, simply search “food near Taj Mahal” on Google and pick a place that suits the group. The driver will be glad to take you to wherever you’d like to eat.",
        left,
        y,
        content_w,
        font="SourceSans",
        size=9.1,
        leading=12.5,
    )
    y -= 2 * mm
    draw_paragraph(
        c,
        "Suggested lunch window: 12:15–1:15 pm, so the group can comfortably leave Agra around 1:15 pm. For five-star hotel restaurants, a quick advance reservation is recommended.",
        left,
        y,
        content_w,
        font="Cormorant-Italic",
        size=10,
        leading=13,
        color=INK_MUTED,
    )
    draw_footer(c, width, 2, total_pages)
    c.save()
    return OUT


if __name__ == "__main__":
    path = build_pdf()
    print(f"Wrote {path}")
