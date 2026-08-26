import { useContext } from 'react';
import { ShopContext, type ShopContextType } from '../context/shopContextDef';

export function useShop(): ShopContextType {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error('useShop must be used within a ShopProvider');
  }
  return context;
}
