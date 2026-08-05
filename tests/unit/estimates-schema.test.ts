import { describe, expect, it } from "vitest";

import { computeTotals, signedUnitPrice, unitPriceForEditing } from "@/features/estimates/model";
import {
  MAX_LINE_ITEMS,
  parseEstimateForm,
  parseLineAmount,
  parseTaxRatePercent,
} from "@/features/estimates/schema";

describe("line amounts", () => {
  it("accepts the ways money gets typed", () => {
    expect(parseLineAmount("280")).toBe(280);
    expect(parseLineAmount("$1,280.50")).toBe(1280.5);
    expect(parseLineAmount("1.280,50")).toBe(1280.5);
    expect(parseLineAmount(" 90 ")).toBe(90);
  });

  it("tells blank apart from wrong", () => {
    expect(parseLineAmount("")).toBeNull();
    expect(parseLineAmount(undefined)).toBeNull();
    expect(parseLineAmount("about a hundred")).toBeUndefined();
    expect(parseLineAmount("-")).toBeUndefined();
  });

  // Unlike the job form's parser: a discount is a real negative line.
  it("accepts a negative, which the job parser does not", () => {
    expect(parseLineAmount("-50")).toBe(-50);
  });
});

describe("tax rate", () => {
  it("reads a percentage and stores a fraction", () => {
    expect(parseTaxRatePercent("8.25")).toBe(0.0825);
    expect(parseTaxRatePercent("8,25")).toBe(0.0825);
    expect(parseTaxRatePercent("8.25%")).toBe(0.0825);
    expect(parseTaxRatePercent("10")).toBe(0.1);
  });

  it("treats blank as no tax", () => {
    expect(parseTaxRatePercent("")).toBe(0);
    expect(parseTaxRatePercent(undefined)).toBe(0);
  });

  // 825 is what someone types who thought the field wanted a fraction. Applying
  // it would multiply an invoice by eight.
  it("refuses a rate that cannot be one", () => {
    expect(parseTaxRatePercent("825")).toBeUndefined();
    expect(parseTaxRatePercent("60")).toBeUndefined();
    expect(parseTaxRatePercent("-5")).toBeUndefined();
    expect(parseTaxRatePercent("eight")).toBeUndefined();
  });

  it("allows the top of the range", () => {
    expect(parseTaxRatePercent("50")).toBe(0.5);
  });
});

describe("the sign of a discount", () => {
  it("takes the amount off however it was typed", () => {
    expect(signedUnitPrice("discount", 50)).toBe(-50);
    expect(signedUnitPrice("discount", -50)).toBe(-50);
  });

  it("leaves ordinary lines alone", () => {
    expect(signedUnitPrice("labor", 90)).toBe(90);
    expect(signedUnitPrice("material", 120.5)).toBe(120.5);
  });

  it("round-trips through the editor without flipping", () => {
    const stored = signedUnitPrice("discount", 50);
    const shown = unitPriceForEditing("discount", stored);
    expect(shown).toBe(50);
    expect(signedUnitPrice("discount", shown)).toBe(stored);
  });
});

describe("the estimate form", () => {
  const base = {
    title: "Faucet replacement",
    tax_rate: "8.25",
    items: [
      { item_type: "labor", description: "2 hours", quantity: "2", unit_price: "90" },
      { item_type: "material", description: "Faucet", quantity: "1", unit_price: "120.50" },
    ],
  };

  it("parses a filled-in estimate", () => {
    const result = parseEstimateForm(base);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.taxRate).toBe(0.0825);
    expect(result.value.items).toHaveLength(2);
    expect(computeTotals(result.value.items, result.value.taxRate).total).toBe(325.29);
  });

  // The editor always shows a spare row. Making the user clear it before
  // saving would be a rule invented by the form.
  it("drops the spare blank rows", () => {
    const result = parseEstimateForm({
      ...base,
      items: [
        ...base.items,
        { item_type: "labor", description: "", quantity: "1", unit_price: "" },
        { item_type: "labor", description: "", quantity: "", unit_price: "" },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.items).toHaveLength(2);
  });

  // A row with a price but no description is not a spare row — it is a line
  // someone half-wrote, and dropping it would quietly lower the total.
  it("refuses a priced row with nothing written on it", () => {
    const result = parseEstimateForm({
      ...base,
      items: [...base.items, { item_type: "labor", description: "", quantity: "1", unit_price: "400" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.items).toBe("required");
  });

  it("defaults an omitted quantity to one", () => {
    const result = parseEstimateForm({
      ...base,
      items: [{ item_type: "fee", description: "Trip charge", quantity: "", unit_price: "45" }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.items[0].quantity).toBe(1);
  });

  it("stores a discount as a negative line", () => {
    const result = parseEstimateForm({
      ...base,
      tax_rate: "",
      items: [
        { item_type: "labor", description: "Work", quantity: "1", unit_price: "200" },
        { item_type: "discount", description: "Repeat customer", quantity: "1", unit_price: "50" },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items[1].unitPrice).toBe(-50);
    expect(computeTotals(result.value.items).total).toBe(150);
  });

  it("requires a title", () => {
    const result = parseEstimateForm({ ...base, title: "   " });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.title).toBe("required");
  });

  it("reports a bad tax rate against its own field", () => {
    const result = parseEstimateForm({ ...base, tax_rate: "825" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.tax_rate).toBe("invalid_rate");
  });

  it("refuses an unknown item type rather than defaulting it", () => {
    const result = parseEstimateForm({
      ...base,
      items: [{ item_type: "surcharge", description: "Something", quantity: "1", unit_price: "10" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.items).toBe("invalid_choice");
  });

  it("caps the number of lines", () => {
    const rows = Array.from({ length: MAX_LINE_ITEMS + 1 }, (_, index) => ({
      item_type: "labor",
      description: `Line ${index}`,
      quantity: "1",
      unit_price: "10",
    }));
    const result = parseEstimateForm({ ...base, items: rows });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.items).toBe("too_many_items");
  });

  it("accepts an estimate with no lines yet — that is a draft, not an error", () => {
    const result = parseEstimateForm({ title: "Draft", tax_rate: "", items: [] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.items).toEqual([]);
  });
});
