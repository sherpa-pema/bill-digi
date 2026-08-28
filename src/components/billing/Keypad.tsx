import React from 'react';
import { Delete } from 'lucide-react';
import { useBilling } from '../../hooks/useBilling';

export const Keypad: React.FC = () => {
  const { handleKeypadPress } = useBilling();

  return (
    <div className="mt-5 space-y-2.5">
      {/* Digits 1-9 in 3 columns */}
      <div className="grid grid-cols-3 gap-2.5">
        {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map((k) => (
          <button 
            key={k} 
            type="button" 
            onClick={() => handleKeypadPress(k)} 
            className="min-h-[60px] h-[60px] rounded-[16px] bg-[#f6f6f6] dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700/70 text-zinc-900 dark:text-zinc-100 text-[22px] font-medium active:bg-zinc-900 active:text-white dark:active:bg-zinc-600 active:scale-[0.97] transition shadow-sm cursor-pointer"
          >
            {k}
          </button>
        ))}
      </div>
      
      {/* 4-Key Bottom Row: 0, 00, ., ⌫ */}
      <div className="grid grid-cols-4 gap-2.5">
        <button 
          type="button" 
          onClick={() => handleKeypadPress('0')} 
          className="min-h-[60px] h-[60px] rounded-[16px] bg-[#f6f6f6] dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700/70 text-zinc-900 dark:text-zinc-100 text-[21px] font-medium active:bg-zinc-900 active:text-white dark:active:bg-zinc-600 active:scale-[0.97] transition shadow-sm flex items-center justify-center cursor-pointer"
        >
          0
        </button>
        <button 
          type="button" 
          onClick={() => handleKeypadPress('00')} 
          className="min-h-[60px] h-[60px] rounded-[16px] bg-[#f6f6f6] dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700/70 text-zinc-900 dark:text-zinc-100 text-[19px] font-medium active:bg-zinc-900 active:text-white dark:active:bg-zinc-600 active:scale-[0.97] transition shadow-sm flex items-center justify-center cursor-pointer"
        >
          00
        </button>
        <button 
          type="button" 
          onClick={() => handleKeypadPress('.')} 
          className="min-h-[60px] h-[60px] rounded-[16px] bg-[#f6f6f6] dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700/70 text-zinc-900 dark:text-zinc-100 text-[22px] font-bold active:bg-zinc-900 active:text-white dark:active:bg-zinc-600 active:scale-[0.97] transition shadow-sm flex items-center justify-center cursor-pointer"
        >
          .
        </button>
        <button 
          type="button" 
          onClick={() => handleKeypadPress('⌫')} 
          className="min-h-[60px] h-[60px] rounded-[16px] bg-zinc-900 dark:bg-zinc-700 text-white text-[15px] font-semibold active:bg-black dark:active:bg-zinc-600 active:scale-[0.97] transition shadow-sm flex items-center justify-center cursor-pointer"
          title="Backspace"
        >
          <Delete className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
