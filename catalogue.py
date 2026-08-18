"""Rate card for the QuoteIt v1 prototype.

All prices are ex-VAT "Trust install" prices, exactly as specified in SPEC.md's
Rate card table. This module is the single source of truth for the catalogue
served at /api/catalogue.
"""

RADIATORS = [
    # Neos Standard (65cm)
    {"code": "N800", "family": "Standard", "height_cm": 65, "kw": 0.8, "width_cm": 44, "price": 1082},
    {"code": "N1000", "family": "Standard", "height_cm": 65, "kw": 1.0, "width_cm": 71, "price": 1142},
    {"code": "N1600", "family": "Standard", "height_cm": 65, "kw": 1.6, "width_cm": 71, "price": 1172},
    {"code": "N2000", "family": "Standard", "height_cm": 65, "kw": 2.0, "width_cm": 101, "price": 1226},
    {"code": "N2500", "family": "Standard", "height_cm": 65, "kw": 2.5, "width_cm": 136, "price": 1322},
    # Vertical (124cm)
    {"code": "NV1600", "family": "Vertical", "height_cm": 124, "kw": 1.6, "width_cm": 44, "price": 1226},
    {"code": "NV2000", "family": "Vertical", "height_cm": 124, "kw": 2.0, "width_cm": 71, "price": 1322},
    {"code": "NV2500", "family": "Vertical", "height_cm": 124, "kw": 2.5, "width_cm": 71, "price": 1442},
    # Junior (40cm)
    {"code": "NJ1600", "family": "Junior", "height_cm": 40, "kw": 1.6, "width_cm": 136, "price": 1226},
    {"code": "NJ2000", "family": "Junior", "height_cm": 40, "kw": 2.0, "width_cm": 136, "price": 1322},
    {"code": "NJ2500", "family": "Junior", "height_cm": 40, "kw": 2.5, "width_cm": 165, "price": 1442},
]

FAMILIES = [
    {"key": "Standard", "label": "Standard 65cm"},
    {"key": "Vertical", "label": "Vertical 124cm"},
    {"key": "Junior", "label": "Junior 40cm"},
]

# Accessories/extras — per-unit prices; "unit" documents what the price is per.
ACCESSORIES = [
    {"key": "protostat", "label": "Protostat", "price": 0, "unit": "radiator", "included": True},
    {"key": "rf_relay", "label": "RF Relay", "price": 50, "unit": "radiator", "included": False},
    {"key": "wireless_thermostat", "label": "Wireless thermostat", "price": 100, "unit": "room", "included": False},
    {"key": "app_hub", "label": "App Hub", "price": 150, "unit": "house", "included": False},
    {"key": "timer", "label": "Timer", "price": 100, "unit": "house", "included": False},
    {"key": "fuse_spur", "label": "Fuse spur", "price": 30, "unit": "house", "included": False},
    {"key": "towel_rail_large", "label": "Towel rail large 600W", "price": 350, "unit": "house", "included": False},
    {"key": "towel_rail_small", "label": "Towel rail small 400W", "price": 250, "unit": "house", "included": False},
]

# Work items — installation is tiered, removal is per old heater.
WORK_ITEMS = {
    "installation": {
        "base_radiators": 2,
        "base_price": 250,
        "extra_radiator_price": 100,
    },
    "removal": {
        "price_per_heater": 75,
        "price_per_heater_electric": 50,
    },
}

INSULATION_FACTORS = [
    {"value": 5, "label": "Standard", "sub": "normal well-insulated"},
    {"value": 6, "label": "Draughty", "sub": "older/poor insulation"},
    {"value": 7, "label": "Exposed", "sub": "conservatory/very leaky"},
]

NHS_DISCOUNT_RATE = 0.10
COLOUR_UPLIFT_RATE = 0.20
SUPPLY_ONLY_MARKUP = 1.2
SUPPLY_ONLY_DELIVERY = 50
DEPOSIT_OPTIONS = [0.5, 0.25, 0]


def get_catalogue() -> dict:
    """Return the full catalogue payload served at /api/catalogue."""
    return {
        "radiators": RADIATORS,
        "families": FAMILIES,
        "accessories": ACCESSORIES,
        "work_items": WORK_ITEMS,
        "insulation_factors": INSULATION_FACTORS,
        "nhs_discount_rate": NHS_DISCOUNT_RATE,
        "colour_uplift_rate": COLOUR_UPLIFT_RATE,
        "supply_only_markup": SUPPLY_ONLY_MARKUP,
        "supply_only_delivery": SUPPLY_ONLY_DELIVERY,
        "deposit_options": DEPOSIT_OPTIONS,
    }
