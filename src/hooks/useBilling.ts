import { useContext } from 'react';
import { BillingContext, type BillingContextType } from '../context/billingContextDef';

export function useBilling(): BillingContextType {
  const context = useContext(BillingContext);
  if (!context) {
    throw new Error('useBilling must be used within a BillingProvider');
  }
  return context;
}
