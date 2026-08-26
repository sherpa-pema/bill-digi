import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { Bill } from '../../types';
import { useReceiptExport } from '../../hooks/useReceiptExport';

interface ReceiptQrViewProps {
  bill: Bill;
  onBack: () => void;
  onDone: () => void;
}

export const ReceiptQrView: React.FC<ReceiptQrViewProps> = ({ bill, onBack, onDone }) => {
  const { generateBillText } = useReceiptExport();

  return (
    <div className="min-h-[calc(100vh-28px)] bg-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-[340px] bg-white rounded-[28px] border border-zinc-100 shadow-[0_16px_60px_rgba(0,0,0,0.08)] p-6 flex flex-col items-center">
        <div className="w-full aspect-square rounded-[20px] bg-zinc-50 flex items-center justify-center overflow-hidden border border-zinc-100">
          <QRCodeSVG value={generateBillText(bill)} size={240} className="p-2 w-full h-full object-contain" />
        </div>
        <p className="mt-5 serif text-[20px]">Bill #{bill.bill_number}</p>
        <p className="text-[12px] text-zinc-500 mt-1 text-center">Scan to get bill details for IRD lottery</p>
        <p className="mt-4 text-[11px] px-3 py-1.5 rounded-full bg-zinc-900 text-white font-medium">Rs {bill.total_amount}</p>
      </div>
      <button 
        onClick={onBack} 
        className="mt-8 min-h-[44px] h-12 px-6 rounded-full bg-zinc-900 text-white text-[14px] font-medium flex items-center gap-2 active:scale-95 transition"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Bill
      </button>
      <button 
        onClick={onDone} 
        className="mt-3 min-h-[44px] px-4 text-[13px] text-zinc-500 underline underline-offset-4 flex items-center"
      >
        Done — New Bill
      </button>
    </div>
  );
};
