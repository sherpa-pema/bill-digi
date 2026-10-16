import assert from 'node:assert';

// Integer paisa money functions under test
const toPaisa = (rupees) => {
  if (typeof rupees !== 'number' || isNaN(rupees)) return 0;
  return Math.round(rupees * 100);
};

const toRupees = (paisa) => {
  if (typeof paisa !== 'number' || isNaN(paisa)) return 0;
  return Number((paisa / 100).toFixed(2));
};

const roundRupees = (rupees) => {
  if (typeof rupees !== 'number' || isNaN(rupees)) return 0;
  return toRupees(toPaisa(rupees));
};

const formatRupees = (rupees) => {
  return roundRupees(rupees).toFixed(2);
};

const calculateLineTotalPaisa = (qty, unitPriceRupees) => {
  const safeQty = Math.round(Math.max(0, qty));
  const pricePaisa = toPaisa(unitPriceRupees);
  return safeQty * pricePaisa;
};

const calculateDiscountPaisa = (subtotalPaisa, discountRatePercent) => {
  if (subtotalPaisa <= 0 || discountRatePercent <= 0) return 0;
  return Math.round((subtotalPaisa * discountRatePercent) / 100);
};

const calculateVatPaisa = (taxableBasePaisa, vatRatePercent, vatInclusive) => {
  if (taxableBasePaisa <= 0 || vatRatePercent <= 0) return 0;
  if (vatInclusive) {
    return Math.round((taxableBasePaisa * vatRatePercent) / (100.0 + vatRatePercent));
  }
  return Math.round((taxableBasePaisa * vatRatePercent) / 100.0);
};

const computeBillBreakdown = ({
  subtotalRupees,
  discountEnabled = false,
  isDiscountApplied = false,
  discountRate = 10,
  vatEnabled = false,
  isVatApplied = false,
  vatRate = 13,
  vatInclusive = false,
}) => {
  const subtotalPaisa = Math.max(0, toPaisa(subtotalRupees));

  const discountPaisa =
    discountEnabled && isDiscountApplied
      ? calculateDiscountPaisa(subtotalPaisa, discountRate)
      : 0;

  const taxableBasePaisa = Math.max(0, subtotalPaisa - discountPaisa);

  const vatPaisa =
    vatEnabled && isVatApplied
      ? calculateVatPaisa(taxableBasePaisa, vatRate, vatInclusive)
      : 0;

  let totalPaisa = 0;
  if (vatEnabled && isVatApplied && vatInclusive) {
    totalPaisa = taxableBasePaisa;
  } else {
    totalPaisa = taxableBasePaisa + vatPaisa;
  }

  return {
    subtotalPaisa,
    discountPaisa,
    taxableBasePaisa,
    vatPaisa,
    totalPaisa,
    subtotal: toRupees(subtotalPaisa),
    discountAmount: toRupees(discountPaisa),
    taxableAmount: toRupees(taxableBasePaisa),
    vatAmount: toRupees(vatPaisa),
    totalAmount: toRupees(totalPaisa),
  };
};

console.log('Testing Money Logic & Integer Paisa Calculations...');

// 1. Basic conversions
assert.strictEqual(toPaisa(12.34), 1234);
assert.strictEqual(toPaisa(0.01), 1);
assert.strictEqual(toPaisa(0), 0);
assert.strictEqual(toPaisa(0.004), 0);
assert.strictEqual(toPaisa(0.005), 1);
assert.strictEqual(toRupees(1234), 12.34);
assert.strictEqual(toRupees(1), 0.01);
assert.strictEqual(roundRupees(12.3456), 12.35);
assert.strictEqual(formatRupees(12.3), '12.30');

// 2. Line totals
assert.strictEqual(calculateLineTotalPaisa(3, 10.50), 3150); // Rs 31.50
assert.strictEqual(calculateLineTotalPaisa(1, 100), 10000); // Rs 100.00
assert.strictEqual(calculateLineTotalPaisa(0, 50), 0);

// 3. Discount calculations
assert.strictEqual(calculateDiscountPaisa(10000, 10), 1000); // 10% on Rs 100 = Rs 10
assert.strictEqual(calculateDiscountPaisa(12345, 10), 1235); // 10% on Rs 123.45 = Rs 12.35
assert.strictEqual(calculateDiscountPaisa(20000, 5), 1000); // 5% on Rs 200 = Rs 10

// 4. VAT Exclusive (Added on top)
assert.strictEqual(calculateVatPaisa(10000, 13, false), 1300); // 13% on Rs 100 = Rs 13
assert.strictEqual(calculateVatPaisa(9000, 13, false), 1170); // 13% on Rs 90 = Rs 11.70

// 5. VAT Inclusive (MRP / Retail standard in Nepal)
assert.strictEqual(calculateVatPaisa(11300, 13, true), 1300); // 13% included in Rs 113 = Rs 13.00
assert.strictEqual(calculateVatPaisa(10000, 13, true), 1150); // 13% included in Rs 100 = Rs 11.50

// 6. Complete Bill Breakdown: Exclusive VAT mode
const b1 = computeBillBreakdown({
  subtotalRupees: 100,
  discountEnabled: true,
  isDiscountApplied: true,
  discountRate: 10,
  vatEnabled: true,
  isVatApplied: true,
  vatRate: 13,
  vatInclusive: false
});
assert.strictEqual(b1.subtotal, 100);
assert.strictEqual(b1.discountAmount, 10);
assert.strictEqual(b1.taxableAmount, 90);
assert.strictEqual(b1.vatAmount, 11.70);
assert.strictEqual(b1.totalAmount, 101.70);
assert.strictEqual(b1.totalPaisa, 10170);

// 7. Complete Bill Breakdown: Inclusive VAT mode (MRP)
const b2 = computeBillBreakdown({
  subtotalRupees: 113,
  discountEnabled: false,
  isDiscountApplied: false,
  vatEnabled: true,
  isVatApplied: true,
  vatRate: 13,
  vatInclusive: true
});
assert.strictEqual(b2.subtotal, 113);
assert.strictEqual(b2.discountAmount, 0);
assert.strictEqual(b2.taxableAmount, 113);
assert.strictEqual(b2.vatAmount, 13.00); // 113 * 13 / 113 = 13.00
assert.strictEqual(b2.totalAmount, 113.00); // Total remains gross amount
assert.strictEqual(b2.totalPaisa, 11300);

// 8. Custom rates (e.g. 5% discount, 13% VAT)
const b3 = computeBillBreakdown({
  subtotalRupees: 200,
  discountEnabled: true,
  isDiscountApplied: true,
  discountRate: 5,
  vatEnabled: true,
  isVatApplied: true,
  vatRate: 13,
  vatInclusive: false
});
assert.strictEqual(b3.subtotal, 200);
assert.strictEqual(b3.discountAmount, 10); // 5% of 200
assert.strictEqual(b3.taxableAmount, 190);
assert.strictEqual(b3.vatAmount, 24.70); // 13% of 190
assert.strictEqual(b3.totalAmount, 214.70);

// 9. Floating point rounding protection test:
// In float arithmetic, 0.1 + 0.2 = 0.30000000000000004
// In paisa: 10 + 20 = 30 paisa = 0.30 rupees.
assert.strictEqual(toRupees(toPaisa(0.1) + toPaisa(0.2)), 0.30);

console.log('✓ All 9 Money Logic test suites passed successfully!');
