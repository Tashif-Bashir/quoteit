// pricing.js — pure pricing engine functions for QuoteIt.
// Order matters (owner rulings, see SPEC.md "Pricing engine"):
//   1. Per radiator: base price; colour/smooth finish -> +20% on that radiator FIRST.
//   2. NHS discount = 10% off the RADIATORS subtotal (after colour uplift), radiators only.
//   3. Trust install: prices are final, no VAT added (energy-saving relief).
//   4. Supply-only (v1 includes it): per radiator price x 1.2 + GBP50 delivery;
//      VAT-inclusive by construction.
//   5. Payment today: 50% deposit (default) / 25% / No payment today - office follows up.
//
// Worked example from SPEC.md's Estimate mock (the acceptance test):
//   Living room: 2 x N2500 (1322 each) + 1 x N1600 (1172)
//   Kitchen: 1 x N2000 (1226)
//   Bedroom: 1 x NV2500 (1442)
//   -> radiators subtotal (no colour) = 2*1322 + 1172 + 1226 + 1442 = 6484
//   3 wireless thermostats @ 100 = 300
//   1 app hub = 150
//   Installation, 5 radiators = 250 + 3*100 = 550
//   Removal, 3 old heaters @ 75 = 225
//   NHS on -> discount = 6484 * 0.10 = 648.40
//   TOTAL = (6484 - 648.40) + 300 + 150 + 550 + 225 = 7060.60
//   Deposit 50% = 3530.30

const COLOUR_UPLIFT_RATE = 0.20;
const NHS_DISCOUNT_RATE = 0.10;
const SUPPLY_ONLY_MARKUP = 1.2;
const SUPPLY_ONLY_DELIVERY = 50;

/** Round to 2dp (cent-safe against float drift on money). */
export function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Price a single radiator selection.
 * Order (owner ruling): colour uplift applies to the base price FIRST, then
 * (if supply-only) the supply markup applies on top of the colour-adjusted price.
 * @param {number} basePrice - catalogue price for the model.
 * @param {number} qty - quantity of this model in this room.
 * @param {boolean} colour - RAL colour/smooth finish selected.
 * @param {boolean} [supplyOnly] - supply-only mode (price x1.2 + GBP50, VAT-inclusive).
 * @returns {{unitPrice: number, colourAdjusted: number, lineTotal: number}}
 */
export function priceRadiatorLine(basePrice, qty, colour, supplyOnly = false) {
  const colourAdjusted = colour ? round2(basePrice * (1 + COLOUR_UPLIFT_RATE)) : basePrice;
  const unitPrice = supplyOnly
    ? round2(colourAdjusted * SUPPLY_ONLY_MARKUP + SUPPLY_ONLY_DELIVERY)
    : colourAdjusted;
  return { unitPrice, colourAdjusted, lineTotal: round2(unitPrice * qty) };
}

/**
 * Sum radiator line totals into a subtotal (colour uplift already applied per line).
 * @param {Array<{lineTotal: number}>} lines
 */
export function radiatorsSubtotal(lines) {
  return round2(lines.reduce((sum, l) => sum + l.lineTotal, 0));
}

/**
 * NHS discount - 10% off the radiators subtotal only (after colour uplift).
 * @param {number} radiatorsSubtotalValue
 * @param {boolean} nhsOn
 */
export function nhsDiscount(radiatorsSubtotalValue, nhsOn) {
  if (!nhsOn) return 0;
  return round2(radiatorsSubtotalValue * NHS_DISCOUNT_RATE);
}

/**
 * Installation price: 250 for 1-2 radiators + 100 per extra radiator.
 * @param {number} radiatorCount - total radiator count across the whole quote.
 */
export function installationPrice(radiatorCount) {
  if (radiatorCount <= 0) return 0;
  const base = 250;
  const extra = Math.max(0, radiatorCount - 2);
  return base + extra * 100;
}

/**
 * Removal & collection price. 75/old heater, electric removal-only is 50.
 * @param {number} count
 * @param {boolean} electric
 */
export function removalPrice(count, electric) {
  const perUnit = electric ? 50 : 75;
  return round2(count * perUnit);
}

/**
 * Supply-only price for a single radiator (domain law step 4). VAT-inclusive by
 * construction. Kept as a standalone pure function for callers that only have a
 * base price to hand; priceRadiatorLine() is the one actually wired into the
 * Estimate/Signature/My-quotes screens via the supplyOnly flag.
 * @param {number} basePrice
 */
export function supplyOnlyPrice(basePrice) {
  return round2(basePrice * SUPPLY_ONLY_MARKUP + SUPPLY_ONLY_DELIVERY);
}

/**
 * Accessories subtotal from a list of {price, qty}.
 * @param {Array<{price: number, qty: number}>} items
 */
export function accessoriesSubtotal(items) {
  return round2(items.reduce((sum, i) => sum + i.price * i.qty, 0));
}

/**
 * Full quote total.
 * @param {object} args
 * @param {Array<{lineTotal: number}>} args.radiatorLines
 * @param {Array<{price: number, qty: number}>} args.accessoryItems
 * @param {number} args.radiatorCount - total radiator count (for installation tiering)
 * @param {number} args.removalCount
 * @param {boolean} args.removalElectric
 * @param {boolean} args.nhsOn
 */
export function calculateQuote({
  radiatorLines,
  accessoryItems,
  radiatorCount,
  removalCount,
  removalElectric,
  nhsOn,
}) {
  const radSubtotal = radiatorsSubtotal(radiatorLines);
  const discount = nhsDiscount(radSubtotal, nhsOn);
  const accTotal = accessoriesSubtotal(accessoryItems);
  const installTotal = installationPrice(radiatorCount);
  const removalTotal = removalPrice(removalCount, removalElectric);

  const total = round2(radSubtotal - discount + accTotal + installTotal + removalTotal);

  return {
    radiatorsSubtotal: radSubtotal,
    nhsDiscountAmount: discount,
    accessoriesTotal: accTotal,
    installTotal,
    removalTotal,
    total,
  };
}

/**
 * Deposit amount for a given payment-today rate (0.5 / 0.25 / 0).
 * @param {number} total
 * @param {number} rate
 */
export function depositAmount(total, rate) {
  return round2(total * rate);
}

/**
 * Balance remaining after a deposit.
 * @param {number} total
 * @param {number} deposit
 */
export function balanceRemaining(total, deposit) {
  return round2(total - deposit);
}
