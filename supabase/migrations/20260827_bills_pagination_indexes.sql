-- ==============================================================================
-- MIGRATION: Bills Table Pagination & Date Range Performance Indexes
-- Ensures sub-millisecond query execution when fetching paginated history by shop
-- ==============================================================================

-- 1. Composite index on (shop_id, created_at DESC) for date-range pagination
CREATE INDEX IF NOT EXISTS idx_bills_shop_created_at 
ON public.bills(shop_id, created_at DESC);

-- 2. Composite index on (shop_id, bill_number DESC) for sequential order pagination
CREATE INDEX IF NOT EXISTS idx_bills_shop_bill_number 
ON public.bills(shop_id, bill_number DESC);
