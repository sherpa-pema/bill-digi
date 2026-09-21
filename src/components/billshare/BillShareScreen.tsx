import React, { useState, useEffect, useRef } from 'react';
import { Download, Loader2, AlertCircle, Share2, Check } from 'lucide-react';
import { toBlob } from 'html-to-image';
import type { Bill, Shop } from '../../types';
import { getBillShareParams } from '../../lib/navigation';
import { decodeBillData } from '../../lib/billShare';
import { fetchBillById } from '../../lib/dbService';
import { ReceiptCard } from '../receipt/ReceiptCard';
import { LumaSpin } from '../ui/luma-spin';
import sanoBillLogo from '../../assets/sano-bill-logo.png';

export const BillShareScreen: React.FC = () => {
  const [bill, setBill] = useState<Bill | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    const loadBill = async () => {
      const { data, id } = getBillShareParams();

      // 1. Instant load from self-contained URL payload
      if (data) {
        const decoded = decodeBillData(data);
        if (decoded && isMounted) {
          setBill(decoded.bill);
          setShop(decoded.shop);
          setIsLoading(false);
          return;
        }
      }

      // 2. Database lookup by ID if payload is missing or invalid
      if (id) {
        try {
          const result = await fetchBillById(id);
          if (result && result.bill && isMounted) {
            setBill(result.bill);
            setShop(result.shop);
            setIsLoading(false);
            return;
          }
        } catch (err) {
          console.warn('Failed to load bill from database:', err);
        }
      }

      // 3. Fallback error state
      if (isMounted) {
        setIsLoading(false);
        setErrorMessage('Could not load bill receipt. The link may be incomplete or invalid.');
      }
    };

    void loadBill();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleDownloadImage = async () => {
    if (!bill || !receiptRef.current || isDownloading) return;

    setIsDownloading(true);
    try {
      const blob = await toBlob(receiptRef.current, {
        pixelRatio: 3,
        backgroundColor: '#ffffff',
        cacheBust: true,
      });

      if (!blob) {
        throw new Error('Failed to create receipt image');
      }

      const safeShopName = shop?.shop_name
        ? shop.shop_name.replace(/[^a-zA-Z0-9_-]/g, '_')
        : 'SanoBill';
      const fileName = `Bill_${bill.bill_number}_${safeShopName}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      // If mobile browser supports Web Share API with files, trigger native save/share
      if (
        typeof navigator !== 'undefined' &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        try {
          await navigator.share({
            files: [file],
            title: `Bill #${bill.bill_number}`,
            text: `Receipt #${bill.bill_number} - ${shop?.shop_name || 'Sano Bill'}`,
          });
          return;
        } catch (shareErr: any) {
          if (shareErr.name === 'AbortError') return;
        }
      }

      // Desktop / Standard fallback download
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err: any) {
      console.error('Error downloading receipt image:', err);
      alert('Could not save bill image: ' + (err.message || 'Please try again.'));
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(window.location.href);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  // Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f2f2f2] dark:bg-zinc-950 flex items-center justify-center font-[Inter,system-ui,sans-serif] p-4">
        <div className="w-full max-w-[380px] bg-white dark:bg-zinc-900 rounded-[28px] p-8 flex flex-col items-center justify-center text-center shadow-sm border border-zinc-100 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
          <div className="mb-6">
            <LumaSpin />
          </div>
          <h3 className="serif text-[20px] font-medium mb-1">Loading Bill...</h3>
          <p className="text-[12px] text-zinc-400 dark:text-zinc-500">
            Retrieving verified digital receipt
          </p>
        </div>
      </div>
    );
  }

  // Error State
  if (errorMessage || !bill) {
    return (
      <div className="min-h-screen bg-[#f2f2f2] dark:bg-zinc-950 flex items-center justify-center font-[Inter,system-ui,sans-serif] p-4">
        <div className="w-full max-w-[380px] bg-white dark:bg-zinc-900 rounded-[28px] p-8 flex flex-col items-center justify-center text-center shadow-sm border border-zinc-100 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
          <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/50 flex items-center justify-center text-red-500 mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="serif text-[20px] font-medium mb-2">Receipt Not Found</h3>
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mb-6 leading-relaxed">
            {errorMessage || 'This bill could not be found. Please check your QR link or scan again.'}
          </p>
          <a
            href="/"
            className="px-5 py-2.5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[13px] font-medium active:scale-95 transition"
          >
            Go to Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2f2f2] dark:bg-zinc-950 flex flex-col items-center font-[Inter,system-ui,sans-serif] text-zinc-900 dark:text-zinc-100 transition-colors py-6 px-4">
      {/* Container matching mobile & tablet POS aesthetics */}
      <div className="w-full max-w-[420px] flex flex-col items-center">
        
        {/* Verification Pill Header */}
        <div className="mb-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Verified Digital Receipt • Live Copy</span>
        </div>

        {/* Bill Receipt Card - Exact same format as generated bill */}
        <ReceiptCard ref={receiptRef} bill={bill} shop={shop} />

        {/* Action Buttons for Customer */}
        <div className="mt-5 w-full max-w-[380px] grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={isDownloading}
            onClick={handleDownloadImage}
            className="min-h-[48px] h-12 rounded-[16px] bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-semibold text-[13px] flex items-center justify-center gap-2 shadow-xs active:scale-95 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition cursor-pointer disabled:opacity-50"
            title="Save receipt image to your phone"
          >
            {isDownloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>{isDownloading ? 'Saving...' : 'Download Bill'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            className="min-h-[48px] h-12 rounded-[16px] bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 font-semibold text-[13px] flex items-center justify-center gap-2 shadow-xs active:scale-95 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 transition cursor-pointer"
            title="Copy link to this receipt"
          >
            {isCopied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-600">Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4 text-zinc-500" />
                <span>Share Link</span>
              </>
            )}
          </button>
        </div>

        {/* Sano Bill Branding Text Below Receipt */}
        <div className="mt-8 mb-4 flex flex-col items-center justify-center gap-1 text-center">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-[7px] overflow-hidden flex items-center justify-center bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700 shadow-xs">
              <img 
                src={sanoBillLogo} 
                alt="Sano Bill" 
                className="w-full h-full object-contain" 
              />
            </div>
            <span className="serif text-[24px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Sano Bill
            </span>
          </div>
          <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
            Smart Cloud Billing & Digital Receipts
          </p>
        </div>

      </div>
    </div>
  );
};
