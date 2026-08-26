import React from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { useShop } from '../../hooks/useShop';

export const NetworkStatusBar: React.FC = () => {
  const { isOnline, feedbackMessage, loadError, handleManualRefresh } = useShop();

  return (
    <>
      {/* Offline Status Warning Bar */}
      {!isOnline && (
        <div className="bg-amber-500 text-black px-4 py-2 text-[12px] font-medium flex items-center justify-between shadow-sm z-30">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>Offline: App requires an active internet connection.</span>
          </div>
        </div>
      )}

      {/* Temporary Feedback Notification */}
      {feedbackMessage && isOnline && (
        <div className="bg-zinc-900 text-white px-4 py-2 text-[12px] font-medium flex items-center justify-between z-30">
          <div className="flex items-center gap-2">
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <span>{feedbackMessage}</span>
          </div>
        </div>
      )}

      {/* Load Error Banner */}
      {loadError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2.5 text-[12px] text-red-700 flex items-center justify-between z-30">
          <span className="truncate pr-2">{loadError}</span>
          <button 
            onClick={handleManualRefresh} 
            className="min-h-[44px] px-2 text-[11px] font-bold underline shrink-0 hover:text-red-900 flex items-center"
          >
            Retry
          </button>
        </div>
      )}
    </>
  );
};
