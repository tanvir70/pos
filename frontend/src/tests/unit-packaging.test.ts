import assert from "node:assert/strict"
import {
  parsePackSize,
  isDiscreteUnit,
  formatQuantityByUnit,
  extractCartonMultiplier,
  getEffectiveMultiplier,
  pluralizeUnit,
  formatUnitQuantity,
  getPackagingUnit,
} from "../utils/unit"

console.log("Running Packaging & Unit Net Volume/Weight Verification Suite...")

// 1. User Scenario: 50 ml pack size with 10 packs per carton
{
  console.log("  [1/6] Verifying user scenario: 50 ml pack with 10 packs/carton...")
  const parsed = parsePackSize("50 ml")
  assert.ok(parsed, "parsePackSize('50 ml') should succeed")
  assert.equal(parsed.amount, 50)
  assert.equal(parsed.unit, "ml")
  assert.equal(parsed.type, "volume")

  // 1 carton (10 bottles)
  const cartonNet = parsed.formatTotal(10)
  assert.equal(cartonNet.totalUnits, 500)
  assert.equal(cartonNet.primaryText, "500 ml")
  assert.equal(cartonNet.secondaryText, "0.5 L")
  assert.equal(cartonNet.combinedText, "500 ml (0.5 L)")

  // 11 cartons (110 bottles)
  const stockNet = parsed.formatTotal(110)
  assert.equal(stockNet.totalUnits, 5500)
  assert.equal(stockNet.primaryText, "5.5 L")
  assert.equal(stockNet.shortText, "5.5 L")
  assert.equal(stockNet.combinedText, "5.5 L (5,500 ml)")
  console.log("  - User scenario (50 ml * 10 = 500 ml / 0.5 L, 110 = 5.5 L) verified.")
}

// 2. Syntax Variations (no spaces, capitalization, etc.)
{
  console.log("  [2/6] Verifying syntax variations ('50ml', '500ML', '1L', '1.5 Liter')...")
  const p1 = parsePackSize("50ml")
  assert.ok(p1 && p1.amount === 50 && p1.unit === "ml")

  const p2 = parsePackSize("500ML")
  assert.ok(p2 && p2.amount === 500 && p2.unit === "ml")

  const p3 = parsePackSize("1L")
  assert.ok(p3 && p3.amount === 1 && p3.unit === "L")
  assert.equal(p3.formatTotal(10).combinedText, "10 L")

  const p4 = parsePackSize("1.5 Liter")
  assert.ok(p4 && p4.amount === 1.5 && p4.unit === "L")
  assert.equal(p4.formatTotal(10).combinedText, "15 L")
  console.log("  - Syntax variations verified.")
}

// 3. Multi-Pack breakdown strings (Syngenta catalog format)
{
  console.log("  [3/6] Verifying Syngenta multi-pack strings ('20 x 50 ml', '4 x 10 x 10 gm')...")
  const p1 = parsePackSize("20 x 50 ml")
  assert.ok(p1, "Should parse '20 x 50 ml'")
  assert.equal(p1.amount, 50)
  assert.equal(p1.unit, "ml")

  const p2 = parsePackSize("4 x 10 x 10 gm")
  assert.ok(p2, "Should parse '4 x 10 x 10 gm'")
  assert.equal(p2.amount, 10)
  assert.equal(p2.unit, "gm")
  assert.equal(p2.type, "weight")

  const p3 = parsePackSize("10 gm (48s)")
  assert.ok(p3, "Should parse bracketed notes '10 gm (48s)'")
  assert.equal(p3.amount, 10)
  assert.equal(p3.unit, "gm")
  console.log("  - Multi-pack strings verified.")
}

// 4. Weight Calculations (gm / Kg)
{
  console.log("  [4/6] Verifying solid weight calculations (10 gm, 100 gm, 1 Kg)...")
  const p1 = parsePackSize("10 gm")
  assert.ok(p1)
  assert.equal(p1.formatTotal(10).combinedText, "100 gm (0.1 Kg)")
  assert.equal(p1.formatTotal(240).combinedText, "2.4 Kg (2,400 gm)")

  const p2 = parsePackSize("100 gm")
  assert.ok(p2)
  assert.equal(p2.formatTotal(10).combinedText, "1 Kg")

  const p3 = parsePackSize("1 Kg")
  assert.ok(p3)
  assert.equal(p3.formatTotal(20).combinedText, "20 Kg")
  console.log("  - Weight calculations verified.")
}

// 5. Graceful degradation on non-standard input
{
  console.log("  [5/6] Verifying non-standard input graceful fallback...")
  assert.equal(parsePackSize(null), null)
  assert.equal(parsePackSize(""), null)
  assert.equal(parsePackSize("   "), null)
  assert.equal(parsePackSize("Custom Pack"), null)
  assert.equal(parsePackSize("0 ml"), null)
  assert.equal(parsePackSize("-50 ml"), null)

  // Fallback unit support (e.g. user typed "50" and selected unit "ml")
  const pFallback = parsePackSize("50", "ml")
  assert.ok(pFallback && pFallback.amount === 50 && pFallback.unit === "ml")
  const pFallbackL = parsePackSize("1", "Liter")
  assert.ok(pFallbackL && pFallbackL.amount === 1 && pFallbackL.unit === "L")
  console.log("  - Graceful fallbacks and fallback units verified.")
}

// 6. Discrete Unit Invariants
{
  console.log("  [6/6] Verifying container discrete unit invariants...")
  assert.equal(isDiscreteUnit("Bottle"), true)
  assert.equal(isDiscreteUnit("Packet"), true)
  assert.equal(isDiscreteUnit("Bag"), true)
  assert.equal(isDiscreteUnit("Piece"), true)
  assert.equal(isDiscreteUnit("Can"), true)
  assert.equal(isDiscreteUnit("Drum"), true)
  assert.equal(isDiscreteUnit("Liter"), false)
  assert.equal(isDiscreteUnit("Kg"), false)

  assert.equal(formatQuantityByUnit(110, "Bottle"), "110")
  assert.equal(formatQuantityByUnit(110.5, "Bottle"), "111")
  assert.equal(formatQuantityByUnit(5.5, "Liter"), "5.5")
  console.log("  - Discrete unit invariants verified.")
}

// 7. Carton Multiplier Extraction
{
  console.log("  [7/10] Verifying extractCartonMultiplier and getEffectiveMultiplier...")
  assert.equal(extractCartonMultiplier("(200s)"), 200)
  assert.equal(extractCartonMultiplier("(48s)"), 48)
  assert.equal(extractCartonMultiplier("20 x 50 ml"), 20)
  assert.equal(extractCartonMultiplier("4 * 10 * 10 gm"), 4)
  assert.equal(extractCartonMultiplier("100 gm"), null)
  assert.equal(extractCartonMultiplier(null), null)

  assert.equal(getEffectiveMultiplier(40, "40 x 100 gm"), 40)
  assert.equal(getEffectiveMultiplier(1, "(200s)"), 200)
  assert.equal(getEffectiveMultiplier(null, "20 x 50 ml"), 20)
  assert.equal(getEffectiveMultiplier(undefined, "100 gm"), 1)
  console.log("  - Carton multiplier extraction verified.")
}

// 8. Unit Pluralization
{
  console.log("  [8/10] Verifying pluralizeUnit & formatUnitQuantity...")
  assert.equal(pluralizeUnit("Bottle", 1), "Bottle")
  assert.equal(pluralizeUnit("Bottle", 2), "Bottles")
  assert.equal(pluralizeUnit("Packet", 5), "Packets")
  assert.equal(pluralizeUnit("Box", 2), "Boxes")
  assert.equal(pluralizeUnit("Carton", 1), "Carton")
  assert.equal(pluralizeUnit("Carton", 3), "Cartons")
  assert.equal(pluralizeUnit("ml", 50), "ml")
  assert.equal(pluralizeUnit("gm", 100), "gm")

  assert.equal(formatUnitQuantity(1, "Bottle"), "1 Bottle")
  assert.equal(formatUnitQuantity(5, "Bottle"), "5 Bottles")
  console.log("  - Unit pluralization verified.")
}

// 9. Packaging Unit Determination
{
  console.log("  [9/10] Verifying getPackagingUnit...")
  assert.deepEqual(getPackagingUnit("Bottle"), { singular: "Bottle", plural: "Bottles" })
  assert.deepEqual(getPackagingUnit("Packet"), { singular: "Packet", plural: "Packets" })
  assert.deepEqual(getPackagingUnit("ml", "50 ml"), { singular: "Bottle", plural: "Bottles" })
  assert.deepEqual(getPackagingUnit("gm", "100 gm"), { singular: "Packet", plural: "Packets" })
  console.log("  - getPackagingUnit verified.")
}

console.log("All Packaging & Unit Net Volume/Weight tests passed successfully!")
