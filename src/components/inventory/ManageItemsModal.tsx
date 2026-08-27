import React from 'react';
import { ArrowLeft, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useShop } from '../../hooks/useShop';
import { useBilling } from '../../hooks/useBilling';

export const ManageItemsModal: React.FC = () => {
  const { isOnline, showItemsModal, setShowItemsModal } = useShop();
  const {
    items,
    isSavingItem,
    editItemId,
    setEditItemId,
    editItemName,
    setEditItemName,
    editItemPrice,
    setEditItemPrice,
    handleSaveItem,
    handleEditItem,
    handleDeleteItem
  } = useBilling();

  if (!showItemsModal) return null;

  return (
    <div className="min-h-[calc(100vh-28px)] bg-[#fcfcfc] flex flex-col">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 bg-white border-b border-zinc-100 flex items-center gap-3">
        <button 
          onClick={() => setShowItemsModal(false)} 
          className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-zinc-100 flex items-center justify-center active:scale-95 hover:bg-zinc-200 transition"
          title="Back"
        >
          <ArrowLeft className="w-4.5 h-4.5" />
        </button>
        <h2 className="serif text-[22px]">My Items</h2>
        <div className="ml-auto text-[12px] px-3 py-1 rounded-full bg-zinc-900 text-white font-medium">
          {items.length} items
        </div>
      </div>

      {/* Body List */}
      <div className="flex-1 p-4 pb-32 max-w-2xl mx-auto w-full">
        <div className="space-y-2">
          {items.map(v => (
            <div key={v.id} className="rounded-[16px] bg-white border border-zinc-100 p-3.5 flex items-center justify-between shadow-sm">
              <div className="flex-1 min-w-0">
                <p className="text-[14.5px] font-medium truncate">{v.name}</p>
                <p className="text-[12.5px] font-semibold text-zinc-600 mt-0.5">Rs {v.price}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => handleEditItem(v)} 
                  className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center active:scale-95 transition"
                  title="Edit Item"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDeleteItem(v.id)} 
                  className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center active:scale-95 transition"
                  title="Delete Item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="text-center py-12 text-[13px] text-zinc-400">No items found in Supabase. Add one below.</div>
          )}
        </div>

        {/* Add/Edit Form */}
        <div className="mt-6 rounded-[20px] bg-white border border-zinc-100 p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
          <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-400 mb-3">
            {editItemId ? 'Edit Item in Supabase' : 'Add New Item to Supabase'}
          </p>
          <div className="flex gap-2">
            <input 
              value={editItemName} 
              onChange={e => setEditItemName(e.target.value)} 
              maxLength={120}
              placeholder="Name e.g. Tea" 
              className="flex-1 h-12 rounded-[14px] bg-zinc-50 border border-zinc-200 px-3.5 text-[14px] outline-none focus:bg-white focus:border-zinc-400 transition" 
            />
            <input 
              value={editItemPrice} 
              onChange={e => setEditItemPrice(e.target.value.replace(/[^0-9.]/g, ''))} 
              placeholder="Rs" 
              type="text" 
              inputMode="decimal" 
              maxLength={10}
              className="w-[100px] h-12 rounded-[14px] bg-zinc-50 border border-zinc-200 px-3.5 text-[14px] outline-none focus:bg-white focus:border-zinc-400 transition font-medium" 
            />
          </div>
          {editItemPrice !== '' && parseFloat(editItemPrice) > 9999999.99 && (
            <p className="mt-1.5 text-[11px] text-red-500 font-medium">Price cannot exceed Rs 9,999,999.99</p>
          )}
          <button 
            onClick={handleSaveItem} 
            disabled={!editItemName.trim() || !editItemPrice || isNaN(parseFloat(editItemPrice)) || parseFloat(editItemPrice) < 0 || parseFloat(editItemPrice) > 9999999.99 || isSavingItem || !isOnline} 
            className="mt-3.5 w-full min-h-[48px] h-12 rounded-[14px] bg-black text-white text-[13.5px] font-semibold disabled:opacity-30 active:scale-[0.99] transition flex items-center justify-center gap-2 shadow-sm"
          >
            {isSavingItem ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving to Supabase...</span>
              </>
            ) : (
              editItemId ? 'Update Item in Cloud' : '+ Add Item to Cloud'
            )}
          </button>
          {editItemId && (
            <button 
              onClick={() => { setEditItemId(null); setEditItemName(''); setEditItemPrice(''); }} 
              className="mt-2 w-full min-h-[44px] h-11 rounded-[14px] bg-zinc-100 text-[13px] font-medium hover:bg-zinc-200 transition"
            >
              Cancel Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
