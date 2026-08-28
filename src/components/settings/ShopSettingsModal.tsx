import { useState, useEffect, useMemo } from 'react';
import { Crown, Sparkles, LogOut, Loader2, X, Moon, Sun } from 'lucide-react';
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
    isDarkMode,
    toggleDarkMode,
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
    <div className="fixed inset-0 z-50 bg-[#fcfcfc] dark:bg-zinc-950 overflow-y-auto overscroll-y-contain text-zinc-900 dark:text-zinc-100">
      <div className="min-h-full flex flex-col justify-start p-5 pb-28 sm:pb-32">
        <div className="w-full max-w-[440px] mx-auto relative">
          {/* Close Button when editing */}
          {isEditingShop && (
            <button 
              type="button"
              onClick={() => { setIsSetupMode(false); setIsEditingShop(false); }} 
              className="absolute -top-1 right-0 min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 active:scale-95 transition cursor-pointer z-10"
              title="Close Settings"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {/* Logo & Heading */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto rounded-[18px] overflow-hidden flex items-center justify-center shadow-sm bg-white dark:bg-zinc-800 p-1">
              <img 
                src={sanoBillLogo} 
                alt="Sano Bill" 
                className="w-full h-full object-contain"
              />
            </div>
            <h1 className="serif text-[32px] mt-3.5 tracking-tight text-zinc-900 dark:text-zinc-100 leading-tight">Sano Bill</h1>
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-1">
              {isEditingShop ? 'Edit shop & cloud settings' : 'Set up your shop to start billing'}
            </p>
          </div>
          
          {/* Shop Details Card */}
          <div className="rounded-[24px] bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 shadow-[0_12px_40px_rgba(0,0,0,0.06)] dark:shadow-none p-6 mb-4">
            <h3 className="text-[14px] font-semibold mb-4 text-zinc-800 dark:text-zinc-200">Shop Details (Supabase)</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-500 dark:text-zinc-400">Shop Name *</label>
                <input 
                  value={setupShopName} 
                  onChange={e => setSetupShopName(e.target.value)} 
                  placeholder="e.g. Shrestha Kirana Pasal" 
                  className="mt-2 w-full h-12 rounded-[14px] bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 px-4 text-[14px] text-zinc-900 dark:text-zinc-100 outline-none focus:bg-white dark:focus:bg-zinc-800 focus:border-zinc-300 dark:focus:border-zinc-500 transition" 
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-500 dark:text-zinc-400">PAN Number (9 digits) *</label>
                <input 
                  value={setupPanNumber} 
                  onChange={e => setSetupPanNumber(e.target.value.replace(/\D/g, '').slice(0, 9))} 
                  placeholder="123456789" 
                  inputMode="numeric" 
                  className="mt-2 w-full h-12 rounded-[14px] bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 px-4 text-[15px] tracking-widest font-medium text-zinc-900 dark:text-zinc-100 outline-none focus:bg-white dark:focus:bg-zinc-800 focus:border-zinc-300 dark:focus:border-zinc-500 transition" 
                />
                <p className="mt-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                  {setupPanNumber.length}/9 digits {setupPanNumber.length === 9 ? '✓ valid' : ''}
                </p>
              </div>
              <div>
                <label className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-500 dark:text-zinc-400">
                  {isEditingShop ? 'Next Bill Number' : 'Starting Bill Number'}
                </label>
                <input 
                  value={setupStartingBill} 
                  onChange={e => setSetupStartingBill(e.target.value.replace(/\D/g, ''))} 
                  placeholder={String(minBillNumber)} 
                  inputMode="numeric" 
                  className={`mt-2 w-full h-12 rounded-[14px] px-4 text-[14px] outline-none transition ${
                    isBillNumberValid 
                      ? 'bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-zinc-800 focus:border-zinc-300 dark:focus:border-zinc-500' 
                      : 'bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-200 focus:border-red-300'
                  }`}
                />
                <p className={`mt-1.5 text-[11px] leading-relaxed ${isBillNumberValid ? 'text-zinc-400 dark:text-zinc-500' : 'text-red-600 dark:text-red-400 font-medium'}`}>
                  {isEditingShop 
                    ? (isBillNumberValid 
                        ? `Current active bill counter. You can increase this to sync with physical bills (minimum #${minBillNumber}).` 
                        : `Cannot decrease below #${minBillNumber}. Only forward increments are allowed to prevent duplicates.`)
                    : `Initial starting bill number for your shop (minimum 1).`}
                </p>
              </div>
            </div>
          </div>

          {/* Appearance & Theme Card */}
          <div className="rounded-[24px] bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 shadow-[0_12px_40px_rgba(0,0,0,0.06)] dark:shadow-none p-6 mb-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                  {isDarkMode ? <Moon className="w-4 h-4 text-amber-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
                </div>
                <h3 className="text-[14px] font-semibold text-zinc-800 dark:text-zinc-200">Appearance & Theme</h3>
              </div>
              <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                {isDarkMode ? 'Dark' : 'Light'}
              </span>
            </div>
            <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mb-4 leading-relaxed">
              Switch between light and dark appearance across all POS screens, modals, and navigation.
            </p>

            <div 
              onClick={toggleDarkMode}
              className="flex items-center justify-between pt-1 cursor-pointer select-none group"
            >
              <div className="pr-4">
                <p className="text-[13.5px] font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-black dark:group-hover:text-white transition">
                  Dark Mode
                </p>
                <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {isDarkMode ? 'Dark theme is currently active' : 'Enable high-contrast dark theme'}
                </p>
              </div>
              <button 
                type="button" 
                role="switch"
                aria-checked={isDarkMode}
                onClick={(e) => { e.stopPropagation(); toggleDarkMode(); }}
                className="min-w-[44px] min-h-[44px] flex items-center justify-end focus:outline-none"
                aria-label="Toggle Dark Mode"
              >
                <span className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${isDarkMode ? 'bg-amber-500' : 'bg-zinc-200 dark:bg-zinc-700'}`}>
                  <span aria-hidden="true" className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${isDarkMode ? 'translate-x-5' : 'translate-x-0'}`} />
                </span>
              </button>
            </div>
          </div>

          {/* Taxes & Discounts Options Card */}
          <div className="rounded-[24px] bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 shadow-[0_12px_40px_rgba(0,0,0,0.06)] dark:shadow-none p-6 mb-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[14px] font-semibold text-zinc-800 dark:text-zinc-200">Taxes & Discounts</h3>
              <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">POS Options</span>
            </div>
            <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mb-4 leading-relaxed">
              Toggle quick calculation buttons on the billing keypad and itemized checkout screen.
            </p>

            <div className="space-y-3.5 divide-y divide-zinc-100 dark:divide-zinc-800">
              {/* VAT (+13%) Toggle */}
              <div 
                onClick={() => setSetupVatEnabled(!setupVatEnabled)}
                className="flex items-center justify-between pt-1 cursor-pointer select-none group"
              >
                <div className="pr-4">
                  <p className="text-[13.5px] font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-black dark:group-hover:text-white transition">Enable VAT (+13%)</p>
                  <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 mt-0.5">Show +13% VAT button on billing screen</p>
                </div>
                <button 
                  type="button" 
                  role="switch"
                  aria-checked={setupVatEnabled}
                  onClick={(e) => { e.stopPropagation(); setSetupVatEnabled(!setupVatEnabled); }}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-end focus:outline-none"
                  aria-label="Toggle VAT (+13%)"
                >
                  <span className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${setupVatEnabled ? 'bg-zinc-900 dark:bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-700'}`}>
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
                  <p className="text-[13.5px] font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-black dark:group-hover:text-white transition">Enable Discount (-10%)</p>
                  <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 mt-0.5">Show -10% Disc button on billing screen</p>
                </div>
                <button 
                  type="button" 
                  role="switch"
                  aria-checked={setupDiscountEnabled}
                  onClick={(e) => { e.stopPropagation(); setSetupDiscountEnabled(!setupDiscountEnabled); }}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-end focus:outline-none"
                  aria-label="Toggle Discount (-10%)"
                >
                  <span className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${setupDiscountEnabled ? 'bg-zinc-900 dark:bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-700'}`}>
                    <span aria-hidden="true" className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${setupDiscountEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Subscription Plan Card */}
          <div className="rounded-[24px] bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 shadow-[0_12px_40px_rgba(0,0,0,0.06)] dark:shadow-none p-6 mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center ${subscriptionInfo.isPro ? 'bg-amber-500 text-white' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                  <Crown className="w-4 h-4" />
                </div>
                <h3 className="text-[14px] font-semibold text-zinc-800 dark:text-zinc-200">Subscription Plan</h3>
              </div>
              <span className={`text-[10.5px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                subscriptionInfo.isPro 
                  ? 'bg-amber-400 text-zinc-950 shadow-sm' 
                  : subscriptionInfo.isTrial 
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border border-emerald-300/60 dark:border-emerald-700' 
                  : 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
              }`}>
                {subscriptionInfo.isPro && <Sparkles className="w-3 h-3 text-zinc-950" />}
                {subscriptionInfo.badgeText}
              </span>
            </div>

            <p className="text-[12px] text-zinc-600 dark:text-zinc-400 mb-4 leading-relaxed">
              {subscriptionInfo.isPro ? (
                <span>Your <strong className="text-zinc-900 dark:text-zinc-100 font-semibold">Sano Bill Pro Plan</strong> is active with unlimited bill generation. {subscriptionInfo.message}</span>
              ) : subscriptionInfo.isTrial ? (
                <span>You are on the <strong className="text-zinc-900 dark:text-zinc-100 font-semibold">7-Day Free Trial</strong> ({subscriptionInfo.daysLeft} days remaining). Upgrade to Pro for unlimited uninterrupted billing.</span>
              ) : (
                <span>Your 7-day trial has <strong className="text-red-600 dark:text-red-400 font-semibold">expired</strong>. Upgrade to Sano Bill Pro for Rs 500/mo to resume bill generation.</span>
              )}
            </p>

            <button 
              type="button" 
              onClick={() => setShowUpgradeModal(true)}
              className="w-full min-h-[48px] h-12 rounded-[14px] bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[13.5px] font-semibold flex items-center justify-center gap-2 shadow-sm hover:bg-zinc-800 dark:hover:bg-zinc-100 active:scale-95 transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-400 dark:text-amber-600" />
              <span>{subscriptionInfo.isPro ? 'Renew / Extend Pro — Rs 500/mo' : 'Upgrade to Pro — Rs 500/mo'}</span>
            </button>
          </div>

          {/* Submit & Secondary Buttons */}
          <button 
            disabled={!isValidSetup || isSavingSetup || !checkIsOnline()} 
            onClick={handleSaveSetup} 
            className="w-full min-h-[52px] h-[52px] rounded-[14px] bg-black dark:bg-white text-white dark:text-zinc-950 font-semibold text-[14px] disabled:opacity-30 disabled:pointer-events-none active:scale-[0.99] transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
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
                className="mt-3 w-full min-h-[44px] h-11 rounded-[12px] bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium text-[13px] hover:bg-zinc-200 dark:hover:bg-zinc-700 transition flex items-center justify-center cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={signOut} 
                className="mt-2 w-full min-h-[44px] h-11 rounded-[12px] bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-medium text-[13px] hover:bg-red-100 dark:hover:bg-red-900/40 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" /> Sign Out / Switch Account
              </button>
            </>
          )}

          {(isUserAdmin(authUser) || isUserAdmin(shop)) && (
            <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSetupMode(false);
                  setIsAdminView(true);
                  window.location.hash = 'admin';
                }}
                className="text-[12px] text-amber-800 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200 font-semibold transition inline-flex items-center gap-1.5 py-1.5 px-3 bg-amber-50 dark:bg-amber-950/50 rounded-full border border-amber-200 dark:border-amber-800 cursor-pointer"
              >
                <Crown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Open Admin Dashboard</span>
              </button>
            </div>
          )}
          
          {!isEditingShop && (
            <p className="mt-4 text-center text-[11px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
              Bill numbers are sequential & never reset. PAN is masked on printed bills.<br/>
              Cloud Database • Supabase Realtime • Live
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
