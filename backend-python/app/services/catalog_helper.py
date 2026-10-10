"""
Catalog Helper Service
Provides Bengali name resolution and auto-healing for Syngenta products.
"""

from app.scripts.seed_syngenta_catalog import SYNGENTA_PRODUCTS, BN_BRAND_MAP

# Pre-indexed map for O(1) lookup
_CODE_TO_BN: dict[str, str] = {}
for p in SYNGENTA_PRODUCTS:
    code = p["agi_code"]
    brand = p["brand_name"]
    unit_s = p["unit_size"]
    bn_base = BN_BRAND_MAP.get(brand, brand)
    name_bn = bn_base if (unit_s.lower() in brand.lower() or "unit" in unit_s.lower()) else f"{bn_base} ({unit_s})"
    _CODE_TO_BN[code] = name_bn


def clean_product_name_bn(
    name_bn: str | None = None,
    name_en: str | None = None,
    product_code: str | None = None,
) -> str:
    """
    Returns pristine Bengali product name. If name_bn contains '?' or lacks Bengali characters,
    resolves it from official Syngenta catalog mappings.
    """
    if name_bn and "?" not in name_bn and any("\u0980" <= c <= "\u09ff" for c in name_bn):
        return name_bn.strip()

    if product_code and product_code in _CODE_TO_BN:
        return _CODE_TO_BN[product_code]

    if name_en:
        trimmed = name_en.strip()
        for brand, bn_base in BN_BRAND_MAP.items():
            if trimmed.lower().startswith(brand.lower()):
                # Check for unit size in parentheses e.g. "Actara 25 WG (5 gm)"
                import re
                m = re.search(r"\(([^)]+)\)", trimmed)
                if m:
                    unit = m.group(1).strip()
                    if "unit" in unit.lower() or unit.lower() in brand.lower():
                        return bn_base
                    return f"{bn_base} ({unit})"
                return bn_base

    if name_bn and "?" not in name_bn:
        return name_bn.strip()

    return name_en.strip() if name_en else ""
