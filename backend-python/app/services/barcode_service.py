import io
from PIL import Image, ImageDraw, ImageFont

# Code 128 B character patterns (11 modules per character, 3 bars and 3 spaces)
# Standard patterns for ASCII 32 (' ') to 127 (DEL)
PATTERNS = [
    "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312",
    "132212", "221213", "221312", "231212", "112232", "122132", "122231", "113222",
    "123122", "123221", "223211", "221132", "221231", "213212", "223112", "312131",
    "311222", "321122", "321221", "312212", "322112", "322211", "212123", "212321",
    "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
    "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121",
    "313121", "211331", "231131", "213113", "213311", "213131", "311123", "311321",
    "331121", "312113", "312311", "332111", "314111", "221411", "431111", "111224",
    "111422", "121124", "121421", "141122", "141221", "112214", "112412", "122114",
    "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
    "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112",
    "421211", "212141", "214121", "412121", "111143", "111341", "131141", "114113",
    "114311", "411113", "411311", "113141", "114131", "311141", "411131", "211412",
    "211214", "211232", "2331112"
]
START_B = 104  # Pattern index 104
STOP = 106     # Pattern index 106

def generate_code128_png(text: str, width: int = 300, height: int = 100) -> bytes:
    # 1. Try python-barcode if installed
    try:
        import barcode
        from barcode.writer import ImageWriter

        code128 = barcode.get_barcode_class("code128")
        bc = code128(text, writer=ImageWriter())
        buffer = io.BytesIO()
        bc.write(buffer, options={"write_text": True, "module_height": 15.0})
        return buffer.getvalue()
    except Exception:
        pass

    # 2. Pure Pillow vector-raster fallback implementation of Code 128
    codes = [START_B]
    checksum = START_B
    for idx, char in enumerate(text, start=1):
        val = ord(char) - 32
        if 0 <= val <= 95:
            codes.append(val)
            checksum += idx * val
        else:
            codes.append(0)  # fallback space
    codes.append(checksum % 103)
    codes.append(STOP)

    # Convert codes to bar pattern string (alternating bar / space widths)
    pattern_str = ""
    for c in codes:
        pattern_str += PATTERNS[c]

    total_modules = sum(int(digit) for digit in pattern_str)
    quiet_zone = 10
    total_width = total_modules + (quiet_zone * 2)

    scale_x = max(1, width // total_width)
    img_width = max(width, total_width * scale_x)
    img_height = max(height, 80)

    img = Image.new("RGB", (img_width, img_height), color="white")
    draw = ImageDraw.Draw(img)

    curr_x = quiet_zone * scale_x
    bar_height = img_height - 25

    for idx, digit in enumerate(pattern_str):
        w = int(digit) * scale_x
        is_bar = (idx % 2 == 0)
        if is_bar:
            draw.rectangle([curr_x, 10, curr_x + w - 1, bar_height], fill="black")
        curr_x += w

    # Draw human-readable text at bottom
    text_y = bar_height + 4
    draw.text((img_width // 2, text_y), text, fill="black", anchor="mm")

    out_buf = io.BytesIO()
    img.save(out_buf, format="PNG")
    return out_buf.getvalue()
