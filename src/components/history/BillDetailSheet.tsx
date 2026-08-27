import React, { useRef } from 'react';
import { X, Download, Database, Loader2 } from 'lucide-react';
import type { Bill } from '../../types';
import { useShop } from '../../hooks/useShop';
import { useBilling } from '../../hooks/useBilling';
import { useReceiptExport } from '../../hooks/useReceiptExport';
import { ReceiptCard } from '../receipt/ReceiptCard';

interface BillDetailSheetProps {
  bill: Bill;
  onClose: () => void;
}

export const BillDetailSheet: React.FC<BillDetailSheetProps> = ({ bill, onClose }) => {
  const { shop } = useShop();
  const { setGeneratedBill, setShowQr } = useBilling();
  const { isDownloadingBill, handleDownloadBillImage, generateBillText } = useReceiptExport();
  const historyReceiptRef = useRef<HTMLDivElement>(null);

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4 animate-slideUp"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-[460px] bg-[#fcfcfc] rounded-[28px] max-h-[90vh] overflow-hidden flex flex-col shadow-[0_20px_80px_rgba(0,0,0,0.25)]"
        onClick={e => e.stopPropagation()}
      >
        {/* Sheet Header */}
        <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-zinc-100/80">
          <h3 className="serif text-[20px] text-zinc-900">Bill #{bill.bill_number}</h3>
          <button 
            onClick={onClose} 
            className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-zinc-100 flex items-center justify-center active:scale-95 hover:bg-zinc-200 transition text-zinc-600"
            title="Close"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Sheet Content */}
        <div className="flex-1 overflow-y-auto overscroll-y-contain px-5 py-4">
          <ReceiptCard ref={historyReceiptRef} bill={bill} shop={shop} />

          {/* Action Buttons */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <button 
              type="button"
              disabled={isDownloadingBill}
              onClick={() => handleDownloadBillImage(bill, historyReceiptRef.current)} 
              className="min-h-[56px] h-[64px] rounded-[16px] bg-white border border-zinc-100 shadow-sm flex flex-col items-center justify-center gap-1 active:scale-95 transition disabled:opacity-50"
              title="Download bill image to phone gallery"
            >
              {isDownloadingBill ? (
                <Loader2 className="w-4 h-4 animate-spin text-zinc-700" />
              ) : (
                <Download className="w-4 h-4 text-zinc-800" />
              )}
              <span className="text-[11px] font-medium text-zinc-800">
                {isDownloadingBill ? 'Saving...' : 'Download'}
              </span>
            </button>

            <button 
              onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(generateBillText(bill))}`, '_blank')} 
              className="min-h-[56px] h-[64px] rounded-[16px] bg-white border border-zinc-100 shadow-sm flex flex-col items-center justify-center gap-1 active:scale-95 transition"
            >
              <div className="w-4 h-4 rounded-full bg-[#25D366] text-white flex items-center justify-center text-[10px] font-bold">W</div>
              <span className="text-[11px] font-medium">WhatsApp</span>
            </button>

            <button 
              onClick={() => { 
                setGeneratedBill(bill); 
                onClose(); 
                setShowQr(true); 
              }} 
              className="min-h-[56px] h-[64px] rounded-[16px] bg-black text-white flex flex-col items-center justify-center gap-1 active:scale-95 transition"
            >
              <Database className="w-4 h-4" />
              <span className="text-[11px] font-medium">QR</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
