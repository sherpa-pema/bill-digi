/**
 * Money utilities using integer paisa (1 NPR = 100 Paisa).
 * Eliminates floating point rounding errors in financial computations.
 */

/**
 * Converts a rupee amount to integer paisa.
 * e.g., 12.34 -> 1234
 */
export const toPaisa = (rupees: number): number => {
  if (typeof rupees !== 'number' || isNaN(rupees)) return 0;
  return Math.round(rupees * 100);
};

/**
 * Converts an integer paisa amount to rupees with 2 decimal places.
 * e.g., 1234 -> 12.34
 */
export const toRupees = (paisa: number): number => {
  if (typeof paisa !== 'number' || isNaN(paisa)) return 0;
  return Number((paisa / 100).toFixed(2));
};

/**
 * Rounds a rupee amount to exactly 2 decimals via integer paisa.
 */
export const roundRupees = (rupees: number): number => {
  if (typeof rupees !== 'number' || isNaN(rupees)) return 0;
  return toRupees(toPaisa(rupees));
};

/**
 * Formats rupees into a standard display string with 2 decimal places.
 */
export const formatRupees = (rupees: number): string => {
  return roundRupees(rupees).toFixed(2);
};

/**
 * Calculates line total in integer paisa given integer quantity and rupee unit price.
 */
export const calculateLineTotalPaisa = (qty: number, unitPriceRupees: number): number => {
  const safeQty = Math.round(Math.max(0, qty));
  const pricePaisa = toPaisa(unitPriceRupees);
  return safeQty * pricePaisa;
};

/**
 * Calculates discount amount in integer paisa from subtotal paisa and discount rate percentage.
 */
export const calculateDiscountPaisa = (subtotalPaisa: number, discountRatePercent: number): number => {
  if (subtotalPaisa <= 0 || discountRatePercent <= 0) return 0;
  return Math.round((subtotalPaisa * discountRatePercent) / 100);
};

/**
 * Calculates VAT in integer paisa.
 * - In VAT-inclusive pricing (Nepali retail standard / MRP):
 *     VAT = TaxableBase * (rate / (100 + rate))
 *     Total payable remains the gross taxable base.
 * - In VAT-exclusive pricing (Wholesale / B2B):
 *     VAT = TaxableBase * (rate / 100)
 *     Total payable is TaxableBase + VAT.
 */
export const calculateVatPaisa = (
  taxableBasePaisa: number,
  vatRatePercent: number,
  vatInclusive: boolean
): number => {
  if (taxableBasePaisa <= 0 || vatRatePercent <= 0) return 0;
  if (vatInclusive) {
    return Math.round((taxableBasePaisa * vatRatePercent) / (100.0 + vatRatePercent));
  }
  return Math.round((taxableBasePaisa * vatRatePercent) / 100.0);
};

export interface BillBreakdownResult {
  // Integer Paisa representations
  subtotalPaisa: number;
  discountPaisa: number;
  taxableBasePaisa: number;
  vatPaisa: number;
  totalPaisa: number;
  // Rupee representations (2 decimals)
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  vatAmount: number;
  totalAmount: number;
}

export interface ComputeBreakdownOptions {
  subtotalRupees: number;
  discountEnabled?: boolean;
  isDiscountApplied?: boolean;
  discountRate?: number;
  vatEnabled?: boolean;
  isVatApplied?: boolean;
  vatRate?: number;
  vatInclusive?: boolean;
}

/**
 * Computes authoritative bill breakdown in integer paisa.
 */
export const computeBillBreakdown = ({
  subtotalRupees,
  discountEnabled = false,
  isDiscountApplied = false,
  discountRate = 10,
  vatEnabled = false,
  isVatApplied = false,
  vatRate = 13,
  vatInclusive = false,
}: ComputeBreakdownOptions): BillBreakdownResult => {
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
    // In inclusive pricing, VAT is already inside the taxable base
    totalPaisa = taxableBasePaisa;
  } else {
    // In exclusive pricing, VAT is added on top
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
