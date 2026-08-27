import { useState, useEffect, useMemo } from 'react';
import { Crown, Sparkles, LogOut, Loader2, X } from 'lucide-react';
import { useShop } from '../../hooks/useShop';
import { useBilling } from '../../hooks/useBilling';
import { checkIsOnline } from '../../lib/dbService';
import { isUserAdmin } from '../../lib/authService';
import sanoBillLogo from '../../assets/sano-bill-logo.png';

export const ShopSettingsModal: React.FC = () => {
  const {
    shop,
    authUser,
    isSetupMode,
    setIsSetupMode,
    isEditingShop,
    setIsEditingShop,
    subscriptionInfo,
    setShowUpgradeModal,
    setIsAdminView,
    saveShopSettings,
    signOut
  } = useShop();

  const {
    isVatEnabled,
    isDiscountEnabled,
    handleToggleVatSetting,
    handleToggleDiscountSetting,
    setActiveTab
  } = useBilling();

  const [setupShopName, setSetupShopName] = useState(shop?.shop_name || '');
  const [setupPanNumber, setSetupPanNumber] = useState(shop?.pan_number || '');
  const [setupStartingBill, setSetupStartingBill] = useState(() => {
    return isEditingShop ? String(shop?.next_bill_number || 1) : String(shop?.starting_bill_number || 1);
  });
  const [setupVatEnabled, setSetupVatEnabled] = useState(isVatEnabled);
  const [setupDiscountEnabled, setSetupDiscountEnabled] = useState(isDiscountEnabled);
  const [isSavingSetup, setIsSavingSetup] = useState(false);

  useEffect(() => {
    if (shop) {
      setSetupShopName(shop.shop_name);
      setSetupPanNumber(shop.pan_number);
      setSetupStartingBill(isEditingShop ? String(shop.next_bill_number || 1) : String(shop.starting_bill_number || 1));
    }
    setSetupVatEnabled(isVatEnabled);
    setSetupDiscountEnabled(isDiscountEnabled);
  }, [shop, isVatEnabled, isDiscountEnabled, isSetupMode, isEditingShop]);

  const minBillNumber = isEditingShop ? (Number(shop?.next_bill_number) || 1) : 1;
  const enteredBillNumber = Number(setupStartingBill);
  const isBillNumberValid = !isNaN(enteredBillNumber) && enteredBillNumber >= minBillNumber;

  const isValidSetup = useMemo(() => {
    return (
      setupShopName.trim().length > 0 &&
      /^\d{9}$/.test(setupPanNumber) &&
      isBillNumberValid
    );
  }, [setupShopName, setupPanNumber, isBillNumberValid]);

  const handleSaveSetup = async () => {
    if (!isValidSetup || !shop) return;
    if (!checkIsOnline()) {
      alert('Internet connection required to update shop details in Supabase.');
      return;
    }

    setIsSavingSetup(true);
    try {
      handleToggleVatSetting(setupVatEnabled);
      handleToggleDiscountSetting(setupDiscountEnabled);

      let newStartingBill = shop.starting_bill_number;
      let newNextBill = shop.next_bill_number;

      if (isEditingShop) {
        if (enteredBillNumber > shop.next_bill_number) {
          newNextBill = enteredBillNumber;
        }
      } else {
        newStartingBill = enteredBillNumber || 1;
        newNextBill = enteredBillNumber || 1;
      }

      await saveShopSettings({
        shop_name: setupShopName.trim(),
        pan_number: setupPanNumber,
        starting_bill_number: newStartingBill,
        next_bill_number: newNextBill,
      });

      setIsSetupMode(false);
      setIsEditingShop(false);
      setActiveTab('newBill');
    } catch (err: any) {
      console.error('Failed to update shop:', err);
      alert('Error updating shop in Supabase: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSavingSetup(false);
    }
  };

  if (!isSetupMode) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#fcfcfc] overflow-y-auto overscroll-y-contain">
      <div className="min-h-full flex flex-col justify-start p-5 pb-28 sm:pb-32">
        <div className="w-full max-w-[440px] mx-auto relative">
          {/* Close Button when editing */}
          {isEditingShop && (
            <button 
              type="button"
              onClick={() => { setIsSetupMode(false); setIsEditingShop(false); }} 
              className="absolute -top-1 right-0 min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-500 hover:text-zinc-900 active:scale-95 transition cursor-pointer z-10"
              title="Close Settings"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {/* Logo & Heading */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto rounded-[18px] overflow-hidden flex items-center justify-center shadow-sm">
              <img 
                src={sanoBillLogo} 
                alt="Sano Bill" 
                className="w-full h-full object-contain"
              />
            </div>
            <h1 className="serif text-[32px] mt-3.5 tracking-tight text-zinc-900 leading-tight">Sano Bill</h1>
            <p className="text-[13px] text-zinc-500 mt-1">
              {isEditingShop ? 'Edit shop & cloud settings' : 'Set up your shop to start billing'}
            </p>
          </div>
          
          {/* Shop Details Card */}
          <div className="rounded-[24px] bg-white border border-zinc-100 shadow-[0_12px_40px_rgba(0,0,0,0.06)] p-6 mb-4">
            <h3 className="text-[14px] font-semibold mb-4 text-zinc-800">Shop Details (Supabase)</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-500">Shop Name *</label>
                <input 
                  value={setupShopName} 
                  onChange={e => setSetupShopName(e.target.value)} 
                  placeholder="e.g. Shrestha Kirana Pasal" 
                  className="mt-2 w-full h-12 rounded-[14px] bg-zinc-50 border border-zinc-100 px-4 text-[14px] outline-none focus:bg-white focus:border-zinc-300 transition" 
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-500">PAN Number (9 digits) *</label>
                <input 
                  value={setupPanNumber} 
                  onChange={e => setSetupPanNumber(e.target.value.replace(/\D/g, '').slice(0, 9))} 
                  placeholder="123456789" 
                  inputMode="numeric" 
                  className="mt-2 w-full h-12 rounded-[14px] bg-zinc-50 border border-zinc-100 px-4 text-[15px] tracking-widest font-medium outline-none focus:bg-white focus:border-zinc-300 transition" 
                />
                <p className="mt-1.5 text-[11px] text-zinc-400">
                  {setupPanNumber.length}/9 digits {setupPanNumber.length === 9 ? '✓ valid' : ''}
                </p>
              </div>
              <div>
                <label className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-500">
                  {isEditingShop ? 'Next Bill Number' : 'Starting Bill Number'}
                </label>
                <input 
                  value={setupStartingBill} 
                  onChange={e => setSetupStartingBill(e.target.value.replace(/\D/g, ''))} 
                  placeholder={String(minBillNumber)} 
                  inputMode="numeric" 
                  className={`mt-2 w-full h-12 rounded-[14px] px-4 text-[14px] outline-none transition ${
                    isBillNumberValid 
                      ? 'bg-zinc-50 border border-zinc-100 focus:bg-white focus:border-zinc-300' 
                      : 'bg-red-50 border border-red-200 text-red-900 focus:border-red-300'
                  }`}
                />
                <p className={`mt-1.5 text-[11px] leading-relaxed ${isBillNumberValid ? 'text-zinc-400' : 'text-red-600 font-medium'}`}>
                  {isEditingShop 
                    ? (isBillNumberValid 
                        ? `Current active bill counter. You can increase this to sync with physical bills (minimum #${minBillNumber}).` 
                        : `Cannot decrease below #${minBillNumber}. Only forward increments are allowed to prevent duplicates.`)
                    : `Initial starting bill number for your shop (minimum 1).`}
                </p>
              </div>
            </div>
          </div>

          {/* Taxes & Discounts Options Card */}
          <div className="rounded-[24px] bg-white border border-zinc-100 shadow-[0_12px_40px_rgba(0,0,0,0.06)] p-6 mb-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[14px] font-semibold text-zinc-800">Taxes & Discounts</h3>
              <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">POS Options</span>
            </div>
            <p className="text-[12px] text-zinc-500 mb-4 leading-relaxed">
              Toggle quick calculation buttons on the billing keypad and itemized checkout screen.
            </p>

            <div className="space-y-3.5 divide-y divide-zinc-100">
              {/* VAT (+13%) Toggle */}
              <div 
                onClick={() => setSetupVatEnabled(!setupVatEnabled)}
                className="flex items-center justify-between pt-1 cursor-pointer select-none group"
              >
                <div className="pr-4">
                  <p className="text-[13.5px] font-semibold text-zinc-800 group-hover:text-black transition">Enable VAT (+13%)</p>
                  <p className="text-[11.5px] text-zinc-500 mt-0.5">Show +13% VAT button on billing screen</p>
                </div>
                <button 
                  type="button" 
                  role="switch"
                  aria-checked={setupVatEnabled}
                  onClick={(e) => { e.stopPropagation(); setSetupVatEnabled(!setupVatEnabled); }}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-end focus:outline-none"
                  aria-label="Toggle VAT (+13%)"
                >
                  <span className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${setupVatEnabled ? 'bg-zinc-900' : 'bg-zinc-200'}`}>
                    <span aria-hidden="true" className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${setupVatEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </span>
                </button>
              </div>

              {/* Discount (-10%) Toggle */}
              <div 
                onClick={() => setSetupDiscountEnabled(!setupDiscountEnabled)}
                className="flex items-center justify-between pt-3.5 cursor-pointer select-none group"
              >
                <div className="pr-4">
                  <p className="text-[13.5px] font-semibold text-zinc-800 group-hover:text-black transition">Enable Discount (-10%)</p>
                  <p className="text-[11.5px] text-zinc-500 mt-0.5">Show -10% Disc button on billing screen</p>
                </div>
                <button 
                  type="button" 
                  role="switch"
                  aria-checked={setupDiscountEnabled}
                  onClick={(e) => { e.stopPropagation(); setSetupDiscountEnabled(!setupDiscountEnabled); }}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-end focus:outline-none"
                  aria-label="Toggle Discount (-10%)"
                >
                  <span className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${setupDiscountEnabled ? 'bg-zinc-900' : 'bg-zinc-200'}`}>
                    <span aria-hidden="true" className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${setupDiscountEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Subscription Plan Card */}
          <div className="rounded-[24px] bg-white border border-zinc-100 shadow-[0_12px_40px_rgba(0,0,0,0.06)] p-6 mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center ${subscriptionInfo.isPro ? 'bg-amber-500 text-white' : 'bg-amber-500/10 text-amber-600'}`}>
                  <Crown className="w-4 h-4" />
                </div>
                <h3 className="text-[14px] font-semibold text-zinc-800">Subscription Plan</h3>
              </div>
              <span className={`text-[10.5px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                subscriptionInfo.isPro 
                  ? 'bg-amber-400 text-zinc-950 shadow-sm' 
                  : subscriptionInfo.isTrial 
                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300/60' 
                  : 'bg-red-100 text-red-800 border border-red-200'
              }`}>
                {subscriptionInfo.isPro && <Sparkles className="w-3 h-3 text-zinc-950" />}
                {subscriptionInfo.badgeText}
              </span>
            </div>

            <p className="text-[12px] text-zinc-600 mb-4 leading-relaxed">
              {subscriptionInfo.isPro ? (
                <span>Your <strong className="text-zinc-900 font-semibold">DigiBill Pro Plan</strong> is active with unlimited bill generation. {subscriptionInfo.message}</span>
              ) : subscriptionInfo.isTrial ? (
                <span>You are on the <strong className="text-zinc-900 font-semibold">7-Day Free Trial</strong> ({subscriptionInfo.daysLeft} days remaining). Upgrade to Pro for unlimited uninterrupted billing.</span>
              ) : (
                <span>Your 7-day trial has <strong className="text-red-600 font-semibold">expired</strong>. Upgrade to DigiBill Pro for Rs 500/mo to resume bill generation.</span>
              )}
            </p>

            <button 
              type="button" 
              onClick={() => setShowUpgradeModal(true)}
              className="w-full min-h-[48px] h-12 rounded-[14px] bg-zinc-950 text-white text-[13.5px] font-semibold flex items-center justify-center gap-2 shadow-sm hover:bg-zinc-800 active:scale-95 transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>{subscriptionInfo.isPro ? 'Renew / Extend Pro — Rs 500/mo' : 'Upgrade to Pro — Rs 500/mo'}</span>
            </button>
          </div>

          {/* Submit & Secondary Buttons */}
          <button 
            disabled={!isValidSetup || isSavingSetup || !checkIsOnline()} 
            onClick={handleSaveSetup} 
            className="w-full min-h-[52px] h-[52px] rounded-[14px] bg-black text-white font-semibold text-[14px] disabled:opacity-30 disabled:pointer-events-none active:scale-[0.99] transition flex items-center justify-center gap-2 shadow-sm"
          >
            {isSavingSetup ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving in Supabase...</span>
              </>
            ) : (
              isEditingShop ? 'Save Changes' : 'Save & Continue'
            )}
          </button>
          
          {isEditingShop && (
            <>
              <button 
                onClick={() => { setIsSetupMode(false); setIsEditingShop(false); }} 
                className="mt-3 w-full min-h-[44px] h-11 rounded-[12px] bg-zinc-100 font-medium text-[13px] hover:bg-zinc-200 transition flex items-center justify-center"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={signOut} 
                className="mt-2 w-full min-h-[44px] h-11 rounded-[12px] bg-red-50 text-red-600 font-medium text-[13px] hover:bg-red-100 transition flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" /> Sign Out / Switch Account
              </button>
            </>
          )}

          {(isUserAdmin(authUser) || isUserAdmin(shop)) && (
            <div className="mt-4 pt-3 border-t border-zinc-100 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSetupMode(false);
                  setIsAdminView(true);
                  window.location.hash = 'admin';
                }}
                className="text-[12px] text-amber-800 hover:text-amber-900 font-semibold transition inline-flex items-center gap-1.5 py-1.5 px-3 bg-amber-50 rounded-full border border-amber-200"
              >
                <Crown className="w-3.5 h-3.5 text-amber-600" />
                <span>Open Admin Dashboard</span>
              </button>
            </div>
          )}
          
          {!isEditingShop && (
            <p className="mt-4 text-center text-[11px] text-zinc-400 leading-relaxed">
              Bill numbers are sequential & never reset. PAN is masked on printed bills.<br/>
              Cloud Database • Supabase Realtime • Live
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
