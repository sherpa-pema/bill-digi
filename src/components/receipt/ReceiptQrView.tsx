import React, { useState } from 'react';
import { ArrowLeft, Copy, ExternalLink, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { Bill } from '../../types';
import { useShop } from '../../hooks/useShop';
import { generateBillShareUrl } from '../../lib/billShare';

interface ReceiptQrViewProps {
  bill: Bill;
  onBack: () => void;
  onDone: () => void;
}

export const ReceiptQrView: React.FC<ReceiptQrViewProps> = ({ bill, onBack, onDone }) => {
  const { shop } = useShop();
  const [copied, setCopied] = useState(false);
  const shareUrl = generateBillShareUrl(bill, shop);

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard && shareUrl) {
      void navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenLink = () => {
    if (shareUrl) {
      window.open(shareUrl, '_blank');
    }
  };

  return (
    <div className="min-h-[calc(100vh-28px)] bg-[#fcfcfc] dark:bg-zinc-950 flex flex-col items-center justify-center p-6 text-zinc-900 dark:text-zinc-100 transition-colors">
      <div className="w-full max-w-[340px] bg-white dark:bg-zinc-900 rounded-[28px] border border-zinc-100 dark:border-zinc-800 shadow-[0_16px_60px_rgba(0,0,0,0.08)] dark:shadow-none p-6 flex flex-col items-center">
        <div className="w-full aspect-square rounded-[20px] bg-white p-2 flex items-center justify-center overflow-hidden border border-zinc-100 dark:border-zinc-700 shadow-sm">
          <QRCodeSVG value={shareUrl} size={240} className="p-2 w-full h-full object-contain" />
        </div>
        <p className="mt-5 serif text-[20px] text-zinc-900 dark:text-zinc-100">Bill #{bill.bill_number}</p>
        <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1 text-center">Scan with any camera to view digital bill</p>
        <p className="mt-3 text-[11px] px-3 py-1 rounded-full bg-zinc-900 dark:bg-zinc-800 text-white font-medium">Rs {bill.total_amount}</p>

        {/* Share Link Actions */}
        <div className="mt-5 w-full grid grid-cols-2 gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={handleCopyLink}
            className="min-h-[40px] h-10 rounded-[12px] bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-[12px] font-medium flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
            title="Copy digital bill link"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-600 font-semibold">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                <span>Copy Link</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleOpenLink}
            className="min-h-[40px] h-10 rounded-[12px] bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-[12px] font-medium flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
            title="Open digital bill in new tab"
          >
            <ExternalLink className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
            <span>Open Link</span>
          </button>
        </div>
      </div>

      <button 
        onClick={onBack} 
        className="mt-6 min-h-[44px] h-12 px-6 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 text-[14px] font-medium flex items-center gap-2 active:scale-95 transition cursor-pointer hover:bg-zinc-800 dark:hover:bg-zinc-100"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Bill
      </button>
      <button 
        onClick={onDone} 
        className="mt-2 min-h-[44px] px-4 text-[13px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 underline underline-offset-4 flex items-center cursor-pointer"
      >
        Done — New Bill
      </button>
    </div>
  );
};
