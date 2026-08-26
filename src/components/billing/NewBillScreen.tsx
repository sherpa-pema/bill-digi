import React from 'react';
import { useBilling } from '../../hooks/useBilling';
import { SimpleModeView } from './SimpleModeView';
import { ItemizedModeView } from './ItemizedModeView';
import { CustomItemModal } from './CustomItemModal';

export const NewBillScreen: React.FC = () => {
  const { isItemizedMode } = useBilling();

  return (
    <div className="p-4 pb-24">
      {!isItemizedMode ? <SimpleModeView /> : <ItemizedModeView />}
      <CustomItemModal />
    </div>
  );
};
