from enum import Enum
from typing import Dict, Any, List

class StandardUnit(str, Enum):
    """
    Canonical discrete inventory units of measure (UoM) for retail inventory.
    In agricultural POS systems, inventory is tracked in countable physical containers
    (Bottles, Packets, Bags, Pieces, Cans), while continuous measures (ml, gm, L, Kg)
    are attributes of pack size (net content) rather than inventory units.
    """
    BOTTLE = "Bottle"
    PACKET = "Packet"
    PIECE = "Piece"
    BAG = "Bag"
    CAN = "Can"

UNIT_GROUPS: List[Dict[str, Any]] = [
    {
        "groupId": "container",
        "label": "Physical Containers (Inventory Units)",
        "units": [
            {"value": "Bottle", "label": "Bottle (বোতল) - Liquids, Suspensions", "isDiscrete": True, "category": "container"},
            {"value": "Packet", "label": "Packet (প্যাকেট) - Powders, Granules", "isDiscrete": True, "category": "container"},
            {"value": "Piece", "label": "Piece / Unit (পিস) - Sprayers, Equipment", "isDiscrete": True, "category": "container"},
            {"value": "Bag", "label": "Bag (ব্যাগ) - Bulk Seed, Fertilizer", "isDiscrete": True, "category": "container"},
            {"value": "Can", "label": "Can / Drum (ক্যান) - Bulk Containers", "isDiscrete": True, "category": "container"},
        ],
    },
    {
        "groupId": "liquid",
        "label": "Liquid Volume (Pack Size)",
        "units": [
            {"value": "Bottle", "label": "Bottle (for ml / L liquids)", "isDiscrete": True, "category": "liquid"},
        ],
    },
    {
        "groupId": "weight",
        "label": "Weight & Mass (Pack Size)",
        "units": [
            {"value": "Packet", "label": "Packet (for gm / Kg solids)", "isDiscrete": True, "category": "weight"},
        ],
    },
]

# Mapping of all accepted aliases (lowercased) to canonical StandardUnit
UNIT_ALIASES: Dict[str, str] = {
    # Liquid measure aliases -> normalize to Bottle container
    "ml": "Bottle",
    "mll": "Bottle",
    "milliliter": "Bottle",
    "millilitre": "Bottle",
    "milliliters": "Bottle",
    "liter": "Bottle",
    "litre": "Bottle",
    "liters": "Bottle",
    "litres": "Bottle",
    "l": "Bottle",
    "lt": "Bottle",
    "ltr": "Bottle",

    # Weight measure aliases -> normalize to Packet container
    "gm": "Packet",
    "g": "Packet",
    "gram": "Packet",
    "grams": "Packet",
    "kg": "Packet",
    "kgs": "Packet",
    "kilo": "Packet",
    "kilogram": "Packet",
    "kilograms": "Packet",

    # Containers
    "bottle": "Bottle",
    "bottles": "Bottle",
    "packet": "Packet",
    "packets": "Packet",
    "pack": "Packet",
    "packs": "Packet",
    "piece": "Piece",
    "pieces": "Piece",
    "pc": "Piece",
    "pcs": "Piece",
    "unit": "Piece",
    "units": "Piece",
    "bag": "Bag",
    "bags": "Bag",
    "can": "Can",
    "cans": "Can",
    "drum": "Can",
    "drums": "Can",
}

def normalize_unit(raw_unit: str | None) -> str:
    """
    Normalizes any raw unit string into its canonical StandardUnit representation.
    Accepts common aliases and casing (e.g. 'bottle', 'BOTTLE', 'PACK', 'ml').
    Raises ValueError if the unit is not recognized.
    """
    if not raw_unit:
        raise ValueError("base_unit cannot be empty")
    cleaned = raw_unit.strip().lower()
    if cleaned in UNIT_ALIASES:
        return UNIT_ALIASES[cleaned]

    allowed = ", ".join([u.value for u in StandardUnit])
    raise ValueError(f"Invalid unit '{raw_unit}'. Allowed units: {allowed}")

def extract_carton_multiplier(pack_size: str | None):
    """
    Extracts carton packaging multiplier from strings like
    '40 x 100 gm', '(200s)', '(48s)', '10 x 1 Kg', '20 * 50ml'.
    Returns Decimal multiplier or None if not detected or <= 1.
    """
    import re
    from decimal import Decimal

    if not pack_size:
        return None
    bracket_match = re.search(r"\((\d+)s?\)", pack_size, re.IGNORECASE)
    if bracket_match:
        val = int(bracket_match.group(1))
        if val > 1:
            return Decimal(val)
    multi_match = re.match(r"^(\d+)\s*[xX*]", pack_size)
    if multi_match:
        val = int(multi_match.group(1))
        if val > 1:
            return Decimal(val)
    return None
