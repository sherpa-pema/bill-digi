import { useState, useCallback } from 'react';
import { toBlob } from 'html-to-image';
import type { Bill } from '../types';
import { useShop } from './useShop';
import { formatDateTime, getBillBreakdown } from '../lib/formatters';

export function useReceiptExport() {
  const { shop, setFeedbackMessage } = useShop();
  const [isDownloadingBill, setIsDownloadingBill] = useState(false);
  const [copiedBankInfo, setCopiedBankInfo] = useState(false);

  const generateBillText = useCallback(
    (bill: Bill | null) => {
      if (!bill || !shop) return '';
      const dateStr = formatDateTime(bill.created_at);
      const { subtotal, discountAmount, taxableAmount, vatAmount, regularItems } = getBillBreakdown(bill);

      let itemsStr = '';
      if (bill.bill_type === 'itemized') {
        itemsStr = regularItems.map((i) => `${i.name} x${i.qty} = Rs ${i.line_total}`).join('\n');
      } else {
        itemsStr = `Amount: Rs ${subtotal}`;
      }

      let adjustmentsStr = '';
      if (discountAmount > 0) {
        adjustmentsStr += `\nDiscount (-10%): -Rs ${discountAmount.toFixed(2)}`;
      }
      if (vatAmount > 0) {
        adjustmentsStr += `\nTaxable: Rs ${taxableAmount.toFixed(2)}\nVAT (+13%): +Rs ${vatAmount.toFixed(2)}`;
      }

      return `${shop.shop_name}\nPAN: ${shop.pan_number}\nBill No: ${bill.bill_number}\nDate: ${dateStr}\n${itemsStr}${adjustmentsStr}\nTotal: Rs ${bill.total_amount}\nThank you! Save for lottery at prize.ird.gov.np`;
    },
    [shop]
  );

  const handleDownloadBillImage = useCallback(
    async (bill: Bill | null, receiptElement: HTMLElement | null) => {
      if (!bill || !receiptElement || isDownloadingBill) return;

      setIsDownloadingBill(true);
      try {
        const blob = await toBlob(receiptElement, {
          pixelRatio: 3,
          backgroundColor: '#ffffff',
          cacheBust: true,
        });

        if (!blob) {
          throw new Error('Failed to generate image');
        }

        const safeShopName = shop?.shop_name
          ? shop.shop_name.replace(/[^a-zA-Z0-9_-]/g, '_')
          : 'DigiBill';
        const fileName = `Bill_${bill.bill_number}_${safeShopName}.png`;
        const file = new File([blob], fileName, { type: 'image/png' });

        // If mobile device supports Web Share API with files, invoke native share sheet (with direct "Save Image" to gallery)
        if (
          typeof navigator !== 'undefined' &&
          navigator.canShare &&
          navigator.canShare({ files: [file] })
        ) {
          try {
            await navigator.share({
              files: [file],
              title: `Bill #${bill.bill_number}`,
              text: `Receipt #${bill.bill_number} - ${shop?.shop_name || 'DigiBill'}`,
            });
            setFeedbackMessage('Receipt saved / shared successfully!');
            setTimeout(() => setFeedbackMessage(null), 3000);
            return;
          } catch (shareErr: any) {
            if (shareErr.name === 'AbortError') {
              return;
            }
            console.warn('Navigator share failed, falling back to direct download:', shareErr);
          }
        }

        // Fallback / Desktop direct file download
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);

        setFeedbackMessage('Receipt image downloaded!');
        setTimeout(() => setFeedbackMessage(null), 3000);
      } catch (err: any) {
        console.error('Error saving receipt image:', err);
        alert('Could not save bill image: ' + (err.message || 'Please try again.'));
      } finally {
        setIsDownloadingBill(false);
      }
    },
    [shop, isDownloadingBill, setFeedbackMessage]
  );

  const handleCopyAccount = useCallback((text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedBankInfo(true);
      setTimeout(() => setCopiedBankInfo(false), 2500);
    }
  }, []);

  return {
    isDownloadingBill,
    handleDownloadBillImage,
    generateBillText,
    handleCopyAccount,
    copiedBankInfo,
  };
}
