-- ==============================================================================
-- Migration: Move VAT/Discount toggles to shops table and provide RPC for starting bill
-- Date: 2026-10-07
-- Description:
--   1. Adds `vat_enabled` and `discount_enabled` BOOLEAN columns to `public.shops`
--      so POS configuration follows the user account and does not leak across shops
--      on shared devices via browser localStorage.
--   2. Creates dedicated RPC `set_shop_starting_bill_number` to safely adjust
--      the starting or next bill counter under row locks, preventing race conditions,
--      stale tab counter overwrites, regressions, and duplicate bill numbers.
-- ==============================================================================

-- 1. Add vat_enabled and discount_enabled columns to shops table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'shops' 
          AND column_name = 'vat_enabled'
    ) THEN
        ALTER TABLE public.shops ADD COLUMN vat_enabled BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'shops' 
          AND column_name = 'discount_enabled'
    ) THEN
        ALTER TABLE public.shops ADD COLUMN discount_enabled BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
END $$;

-- 2. Dedicated RPC to Safely Adjust Starting / Next Bill Counter
-- Strictly prevents stale-tab overwrites, regressions, and duplicate bill numbers.
CREATE OR REPLACE FUNCTION public.set_shop_starting_bill_number(
    p_shop_id TEXT,
    p_starting_bill_number BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_shop shops%ROWTYPE;
    v_max_existing_bill BIGINT;
    v_caller_uid UUID;
BEGIN
    -- 1. Security verification: caller must be shop owner or an admin
    v_caller_uid := auth.uid();
    IF NOT (
        public.is_admin() OR 
        EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id AND user_id = v_caller_uid)
    ) THEN
        RAISE EXCEPTION 'Forbidden: You do not have permission to manage this shop.';
    END IF;

    -- 2. Validate input parameter
    IF p_starting_bill_number IS NULL OR p_starting_bill_number < 1 THEN
        RAISE EXCEPTION 'Starting bill number must be at least 1.';
    END IF;

    -- 3. Lock shop record for update
    SELECT * INTO v_shop
    FROM public.shops
    WHERE id = p_shop_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Shop with ID % not found.', p_shop_id;
    END IF;

    -- 4. Check against existing generated bills for this shop
    SELECT COALESCE(MAX(bill_number), 0) INTO v_max_existing_bill
    FROM public.bills
    WHERE shop_id = p_shop_id;

    IF v_max_existing_bill > 0 AND p_starting_bill_number <= v_max_existing_bill THEN
        RAISE EXCEPTION 'Starting bill number (%) cannot be less than or equal to existing generated bill number (%).', p_starting_bill_number, v_max_existing_bill;
    END IF;

    -- 5. Atomically update starting_bill_number and ensure next_bill_number advances
    UPDATE public.shops
    SET starting_bill_number = p_starting_bill_number,
        next_bill_number = GREATEST(COALESCE(next_bill_number, 1), p_starting_bill_number),
        updated_at = NOW()
    WHERE id = p_shop_id
    RETURNING * INTO v_shop;

    RETURN to_jsonb(v_shop);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_shop_starting_bill_number(TEXT, BIGINT) TO authenticated;
