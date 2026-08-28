import { ShopProvider } from './context/ShopContext';
import { BillingProvider } from './context/BillingContext';
import { useShop } from './hooks/useShop';
import { useBilling } from './hooks/useBilling';
import { isUserAdmin } from './lib/authService';
import { navigateToPOS } from './lib/navigation';
import AdminPanel from './components/AdminPanel';
import AuthScreen from './components/AuthScreen';
import { LumaSpin } from '@/components/ui/luma-spin';
import { Header } from './components/layout/Header';
import { NetworkStatusBar } from './components/layout/NetworkStatusBar';
import { NewBillScreen } from './components/billing/NewBillScreen';
import { HistoryScreen } from './components/history/HistoryScreen';
import { ReceiptModal } from './components/receipt/ReceiptModal';
import { ManageItemsModal } from './components/inventory/ManageItemsModal';
import { ShopSettingsModal } from './components/settings/ShopSettingsModal';
import { UpgradeModal } from './components/settings/UpgradeModal';

function AppContent() {
  const {
    shop,
    authUser,
    isLoadingData,
    isAdminView,
    setIsAdminView,
    showAuthScreen,
    setShowAuthScreen,
    authInitialMode,
    handleAuthSuccess,
    isSetupMode,
    showItemsModal,
    signOut
  } = useShop();

  const {
    activeTab,
    generatedBill
  } = useBilling();

  // 1. Loading Screen with LumaSpin
  if (isLoadingData) {
    return (
      <div className="min-h-screen bg-[#f2f2f2] dark:bg-zinc-950 flex items-center justify-center font-[Inter,system-ui,sans-serif]">
        <div className="w-full max-w-[430px] bg-[#fcfcfc] dark:bg-zinc-900 min-h-screen flex flex-col items-center justify-center p-6 text-center shadow-lg text-zinc-900 dark:text-zinc-100">
          <div className="mb-8 flex items-center justify-center">
            <LumaSpin />
          </div>
          <h2 className="serif text-xl font-medium tracking-tight mb-2">Sano Bill</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-[260px] leading-relaxed">
            Initializing your Sano Bill & cloud workspace...
          </p>
        </div>
      </div>
    );
  }

  // 2. Admin Panel
  if (isAdminView && (isUserAdmin(authUser) || isUserAdmin(shop))) {
    return (
      <AdminPanel 
        currentUser={authUser} 
        onBackToPOS={() => {
          setIsAdminView(false);
          navigateToPOS();
        }} 
        onSignOut={signOut}
      />
    );
  }

  // 3. Unauthenticated Auth Screen
  if (showAuthScreen && !shop) {
    return (
      <AuthScreen 
        initialMode={authInitialMode}
        onSuccess={handleAuthSuccess}
      />
    );
  }

  // 4. Main POS Application
  return (
    <div className="min-h-screen bg-[#f2f2f2] dark:bg-zinc-950 flex justify-center font-[Inter,system-ui,sans-serif] text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      <div className="w-full max-w-[430px] md:max-w-4xl lg:max-w-5xl bg-[#fcfcfc] dark:bg-zinc-900 min-h-screen relative flex flex-col shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_20px_60px_rgba(0,0,0,0.12)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden transition-all duration-200">
        {/* Network and Feedback Status Banners */}
        <NetworkStatusBar />

        {/* Header */}
        {!isSetupMode && !generatedBill && !showItemsModal && <Header />}

        {/* Main Content Body */}
        <div className="flex-1 overflow-y-auto">
          {generatedBill ? (
            <ReceiptModal bill={generatedBill} />
          ) : showItemsModal ? (
            <ManageItemsModal />
          ) : activeTab === 'newBill' ? (
            <NewBillScreen />
          ) : (
            <HistoryScreen />
          )}
        </div>

        {/* Overlays / Modals */}
        <ShopSettingsModal />
        <UpgradeModal />

        {/* Logged-in Auth Screen Overlay (for account switching) */}
        {showAuthScreen && shop && (
          <div className="fixed inset-0 z-50 bg-[#fcfcfc] dark:bg-zinc-900 overflow-y-auto overscroll-y-contain animate-slideUp">
            <AuthScreen 
              initialMode={authInitialMode}
              onClose={() => setShowAuthScreen(false)}
              onSuccess={handleAuthSuccess}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ShopProvider>
      <BillingProvider>
        <AppContent />
      </BillingProvider>
    </ShopProvider>
  );
}
