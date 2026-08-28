import React from 'react';
import { X, Sparkles, CheckCircle2, Copy, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useShop } from '../../hooks/useShop';
import { useReceiptExport } from '../../hooks/useReceiptExport';
import sanoBillLogo from '../../assets/sano-bill-logo.png';

export const UpgradeModal: React.FC = () => {
  const { shop, showUpgradeModal, setShowUpgradeModal } = useShop();
  const { handleCopyAccount, copiedBankInfo } = useReceiptExport();

  if (!showUpgradeModal) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4 animate-slideUp"
      onClick={() => setShowUpgradeModal(false)}
    >
      <div 
        className="w-full max-w-[460px] bg-white dark:bg-zinc-900 rounded-[28px] max-h-[90vh] overflow-y-auto overscroll-y-contain p-5 sm:p-6 shadow-[0_20px_80px_rgba(0,0,0,0.3)] border border-transparent dark:border-zinc-800 flex flex-col text-zinc-900 dark:text-zinc-100 transition-colors"
        onClick={e => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[10px] overflow-hidden flex items-center justify-center shadow-sm shrink-0 bg-white dark:bg-zinc-800 p-0.5 border border-zinc-200/60 dark:border-zinc-700">
              <img 
                src={sanoBillLogo} 
                alt="Sano Bill" 
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h3 className="serif text-[22px] leading-none text-zinc-900 dark:text-zinc-100">Sano Bill Pro</h3>
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">Unlimited Bill Generation</span>
            </div>
          </div>
          <button 
            type="button" 
            onClick={() => setShowUpgradeModal(false)}
            className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 active:scale-95 transition cursor-pointer"
            title="Close"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Price Plan Card */}
        <div className="mt-4 rounded-[20px] bg-gradient-to-br from-zinc-900 via-zinc-800 to-black dark:from-zinc-800 dark:via-zinc-850 dark:to-zinc-900 text-white p-5 shadow-sm border border-transparent dark:border-zinc-700">
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">Pro Subscription</span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="serif text-[32px] sm:text-[36px] font-bold text-white leading-none">Rs 500</span>
                <span className="text-[13px] text-zinc-400 font-normal">/ month</span>
              </div>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-400 text-zinc-950 flex items-center gap-1 shadow-sm">
              <Sparkles className="w-3 h-3" /> Unlimited
            </span>
          </div>

          <div className="mt-4 pt-3.5 border-t border-white/10 space-y-2 text-[12.5px]">
            <div className="flex items-center gap-2 text-zinc-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span><strong className="text-white font-semibold">Unlimited bill generation</strong> (no daily / monthly cap)</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Real-time cloud database backup & sync</span>
            </div>
          </div>
        </div>

        {/* Bank Payment QR Card */}
        <div className="mt-4 rounded-[20px] bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700 p-4 text-center">
          <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/80 border border-amber-200/80 dark:border-amber-800 text-amber-950 dark:text-amber-300 text-[11.5px] font-bold mb-3">
            <span>Deposit Rs 500 in this Bank QR</span>
          </div>

          {/* QR Code Container */}
          <div className="flex flex-col items-center justify-center">
            <div className="bg-white p-3.5 rounded-[16px] shadow-sm border border-zinc-200 flex flex-col items-center justify-center mx-auto mb-3">
              <QRCodeSVG 
                value={`https://pay.digibill.app/deposit?amount=500&shop=${encodeURIComponent(shop?.shop_name || 'Sano Bill')}&pan=${shop?.pan_number || ''}`}
                size={160}
                level="H"
                includeMargin={false}
                className="mx-auto block"
              />
              <p className="mt-2 text-[10.5px] font-medium text-zinc-500 tracking-wide text-center max-w-[220px]">
                Scan with Mobile Banking / Fonepay / eSewa / Khalti
              </p>
            </div>
          </div>

          {/* Bank Account Details */}
          <div className="bg-white dark:bg-zinc-850 rounded-[14px] p-3 text-left border border-zinc-200/80 dark:border-zinc-700 text-[12px] space-y-1.5">
            <div className="flex justify-between items-center text-zinc-600 dark:text-zinc-400">
              <span>Bank Name:</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">Global IME Bank / Nabil Bank</span>
            </div>
            <div className="flex justify-between items-center text-zinc-600 dark:text-zinc-400">
              <span>Account Name:</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">Sano Bill POS Tech</span>
            </div>
            <div className="flex justify-between items-center text-zinc-600 dark:text-zinc-400">
              <span>Account Number:</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">0120100003456</span>
                <button 
                  type="button" 
                  onClick={() => handleCopyAccount('0120100003456')}
                  className="p-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition text-zinc-700 dark:text-zinc-300 active:scale-95 cursor-pointer"
                  title="Copy account number"
                >
                  {copiedBankInfo ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div className="flex justify-between items-center text-zinc-600 dark:text-zinc-400">
              <span>Deposit Amount:</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">Rs 500.00</span>
            </div>
            <div className="flex justify-between items-center text-zinc-600 dark:text-zinc-400">
              <span>Remarks:</span>
              <span className="font-mono text-[11px] text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                {shop?.shop_name ? shop.shop_name.slice(0, 10).replace(/\s+/g, '') : 'SanoBill'}-{shop?.pan_number || 'PRO'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={() => {
              const text = `Hi Sano Bill Team, I have deposited Rs 500 for the Pro subscription (Unlimited Bill Generation).\n\nShop: ${shop?.shop_name || 'N/A'}\nPAN: ${shop?.pan_number || 'N/A'}`;
              window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
            }}
            className="w-full min-h-[48px] h-12 rounded-[14px] bg-[#25D366] text-white font-semibold text-[13.5px] hover:bg-[#20ba59] active:scale-95 transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            <div className="w-5 h-5 rounded-full bg-white text-[#25D366] flex items-center justify-center text-[12px] font-bold">W</div>
            <span>Send Deposit Screenshot on WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={() => setShowUpgradeModal(false)}
            className="w-full min-h-[44px] h-11 rounded-[14px] bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium text-[13px] hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 transition flex items-center justify-center cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
