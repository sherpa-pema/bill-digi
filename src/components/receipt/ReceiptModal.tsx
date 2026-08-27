import React, { useRef } from 'react';
import { X, Download, Database, Loader2 } from 'lucide-react';
import type { Bill } from '../../types';
import { useShop } from '../../hooks/useShop';
import { useBilling } from '../../hooks/useBilling';
import { useReceiptExport } from '../../hooks/useReceiptExport';
import { ReceiptCard } from './ReceiptCard';
import { ReceiptQrView } from './ReceiptQrView';

interface ReceiptModalProps {
  bill: Bill;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ bill }) => {
  const { shop } = useShop();
  const { setGeneratedBill, showQr, setShowQr, setActiveTab } = useBilling();
  const { isDownloadingBill, handleDownloadBillImage, generateBillText } = useReceiptExport();
  const receiptRef = useRef<HTMLDivElement>(null);

  const handleClose = () => {
    setGeneratedBill(null);
    setShowQr(false);
    setActiveTab('newBill');
  };

  if (showQr) {
    return <ReceiptQrView bill={bill} onBack={() => setShowQr(false)} onDone={handleClose} />;
  }

  return (
    <div className="min-h-[calc(100vh-28px)] bg-[#fcfcfc] flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 px-5 pt-5 pb-3 bg-white/95 backdrop-blur-md border-b border-zinc-100">
        <div className="flex items-center justify-between max-w-[420px] mx-auto w-full">
          <button 
            onClick={handleClose} 
            className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-zinc-100 flex items-center justify-center active:scale-95 hover:bg-zinc-200 transition"
            title="Close receipt"
          >
            <X className="w-4.5 h-4.5" />
          </button>
          <span className="text-[12px] font-semibold tracking-[0.12em] uppercase text-zinc-400">Bill Recorded</span>
          <div className="w-11"></div>
        </div>
      </div>
      
      {/* Receipt Body */}
      <div className="flex-1 p-4">
        <ReceiptCard ref={receiptRef} bill={bill} shop={shop} />

        {/* Action Buttons */}
        <div className="mt-5 grid grid-cols-3 gap-3 max-w-[380px] mx-auto">
          <button 
            type="button"
            disabled={isDownloadingBill}
            onClick={() => handleDownloadBillImage(bill, receiptRef.current)} 
            className="min-h-[64px] h-[72px] rounded-[18px] bg-white border border-zinc-100 shadow-sm flex flex-col items-center justify-center gap-1 active:scale-95 transition disabled:opacity-50"
            title="Download bill image to phone gallery"
          >
            {isDownloadingBill ? (
              <Loader2 className="w-5 h-5 animate-spin text-zinc-700" />
            ) : (
              <Download className="w-5 h-5 text-zinc-800" />
            )}
            <span className="text-[12px] font-medium text-zinc-800">
              {isDownloadingBill ? 'Saving...' : 'Download'}
            </span>
          </button>
          <button 
            onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(generateBillText(bill))}`, '_blank')} 
            className="min-h-[64px] h-[72px] rounded-[18px] bg-white border border-zinc-100 shadow-sm flex flex-col items-center justify-center gap-1 active:scale-95 transition"
          >
            <div className="w-5 h-5 rounded-full bg-[#25D366] text-white flex items-center justify-center text-[12px] font-bold">W</div>
            <span className="text-[12px] font-medium">WhatsApp</span>
          </button>
          <button 
            onClick={() => setShowQr(true)} 
            className="min-h-[64px] h-[72px] rounded-[18px] bg-black text-white flex flex-col items-center justify-center gap-1 active:scale-95 transition"
          >
            <Database className="w-5 h-5" />
            <span className="text-[12px] font-medium">Show QR</span>
          </button>
        </div>

        {/* IRD Info Card */}
        <div className="mt-4 rounded-[14px] bg-amber-50 border border-amber-100 p-3 flex gap-2.5 max-w-[380px] mx-auto">
          <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 font-bold text-xs">!</div>
          <p className="text-[11px] leading-[1.4] text-amber-900">
            Bill recorded directly on Supabase. Customer can download bill image, scan QR, or save bill for IRD lottery prize.ird.gov.np
          </p>
        </div>
      </div>

      {/* Done Button Footer */}
      <div className="p-4 pb-6 bg-white border-t border-zinc-100">
        <div className="max-w-[380px] mx-auto w-full">
          <button 
            onClick={handleClose} 
            className="w-full min-h-[52px] h-[54px] rounded-[16px] bg-zinc-100 text-zinc-900 font-semibold text-[14px] active:bg-zinc-200 transition flex items-center justify-center"
          >
            Done — New Bill
          </button>
          <p className="mt-3 text-center text-[11px] text-zinc-400">Bill No #{bill.bill_number} • Saved to Supabase Cloud • Live</p>
        </div>
      </div>
    </div>
  );
};
