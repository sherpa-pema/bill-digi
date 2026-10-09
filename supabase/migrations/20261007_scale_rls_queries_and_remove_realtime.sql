-- ==============================================================================
-- Migration: Scalability Optimizations: Scalar RLS Evaluation, Shop Metric Maintenance,
--            Fast Admin Overview, and Remove Unused Realtime Publications
-- Date: 2026-10-07
-- Description:
--   1. Wraps auth.uid() in (SELECT auth.uid()) and public.is_admin() in (SELECT public.is_admin())
--      across all RLS policies to evaluate once per query (InitPlan) instead of per-row.
--   2. Adds bill_count and total_revenue columns to shops table and backfills them from bills.
--   3. Updates create_bill_atomic to atomically increment bill_count and total_revenue on shops.
--   4. Replaces heavy LEFT JOIN bills aggregation in get_admin_shops_summary() with fast O(1) query.
--   5. Drops unused tables (shops, items, bills) from supabase_realtime publication.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SCALAR SUBQUERY RLS POLICIES (InitPlan Single Evaluation per Query)
-- ------------------------------------------------------------------------------

-- SHOPS POLICIES
DROP POLICY IF EXISTS "Users can select own shop" ON public.shops;
CREATE POLICY "Users can select own shop" 
ON public.shops FOR SELECT 
TO authenticated 
USING ((SELECT public.is_admin()) OR (SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own shop" ON public.shops;
CREATE POLICY "Users can insert own shop" 
ON public.shops FOR INSERT 
TO authenticated 
WITH CHECK ((SELECT public.is_admin()) OR (SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own shop" ON public.shops;
CREATE POLICY "Users can update own shop" 
ON public.shops FOR UPDATE 
TO authenticated 
USING ((SELECT public.is_admin()) OR (SELECT auth.uid()) = user_id) 
WITH CHECK ((SELECT public.is_admin()) OR (SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own shop" ON public.shops;
CREATE POLICY "Users can delete own shop" 
ON public.shops FOR DELETE 
TO authenticated 
USING ((SELECT public.is_admin()) OR (SELECT auth.uid()) = user_id);

-- ITEMS POLICIES
DROP POLICY IF EXISTS "Users can select items of own shops" ON public.items;
CREATE POLICY "Users can select items of own shops" 
ON public.items FOR SELECT 
TO authenticated 
USING (
    (SELECT public.is_admin()) OR
    EXISTS (
        SELECT 1 FROM public.shops 
        WHERE public.shops.id = items.shop_id 
        AND public.shops.user_id = (SELECT auth.uid())
    )
);

DROP POLICY IF EXISTS "Users can insert items to own shops" ON public.items;
CREATE POLICY "Users can insert items to own shops" 
ON public.items FOR INSERT 
TO authenticated 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.shops 
        WHERE public.shops.id = items.shop_id 
        AND public.shops.user_id = (SELECT auth.uid())
    )
);

DROP POLICY IF EXISTS "Users can update items in own shops" ON public.items;
CREATE POLICY "Users can update items in own shops" 
ON public.items FOR UPDATE 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.shops 
        WHERE public.shops.id = items.shop_id 
        AND public.shops.user_id = (SELECT auth.uid())
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.shops 
        WHERE public.shops.id = items.shop_id 
        AND public.shops.user_id = (SELECT auth.uid())
    )
);

DROP POLICY IF EXISTS "Users can delete items from own shops" ON public.items;
CREATE POLICY "Users can delete items from own shops" 
ON public.items FOR DELETE 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.shops 
        WHERE public.shops.id = items.shop_id 
        AND public.shops.user_id = (SELECT auth.uid())
    )
);

-- BILLS POLICIES
DROP POLICY IF EXISTS "Users can select bills of own shops" ON public.bills;
CREATE POLICY "Users can select bills of own shops" 
ON public.bills FOR SELECT 
TO authenticated 
USING (
    (SELECT public.is_admin()) OR
    EXISTS (
        SELECT 1 FROM public.shops 
        WHERE public.shops.id = bills.shop_id 
        AND public.shops.user_id = (SELECT auth.uid())
    )
);

-- SUBSCRIPTION PAYMENTS POLICIES
DROP POLICY IF EXISTS "Tenants and admins can view subscription payments" ON public.subscription_payments;
CREATE POLICY "Tenants and admins can view subscription payments"
ON public.subscription_payments FOR SELECT
TO authenticated
USING (
    (SELECT public.is_admin()) OR
    EXISTS (
        SELECT 1 FROM public.shops 
        WHERE public.shops.id = subscription_payments.shop_id 
        AND public.shops.user_id = (SELECT auth.uid())
    )
);

DROP POLICY IF EXISTS "Admins can insert subscription payments" ON public.subscription_payments;
CREATE POLICY "Admins can insert subscription payments"
ON public.subscription_payments FOR INSERT
TO authenticated
WITH CHECK (
    (SELECT public.is_admin())
);

DROP POLICY IF EXISTS "Admins can update subscription payments" ON public.subscription_payments;
CREATE POLICY "Admins can update subscription payments"
ON public.subscription_payments FOR UPDATE
TO authenticated
USING (
    (SELECT public.is_admin())
)
WITH CHECK (
    (SELECT public.is_admin())
);

DROP POLICY IF EXISTS "Admins can delete subscription payments" ON public.subscription_payments;
CREATE POLICY "Admins can delete subscription payments"
ON public.subscription_payments FOR DELETE
TO authenticated
USING (
    (SELECT public.is_admin())
);

-- ADMIN USERS POLICIES
DROP POLICY IF EXISTS "Admins can select admin_users" ON public.admin_users;
CREATE POLICY "Admins can select admin_users"
ON public.admin_users
FOR SELECT
TO authenticated
USING (
    (SELECT public.is_admin()) OR
    user_id = (SELECT auth.uid())
);

-- ------------------------------------------------------------------------------
-- 2. ADD & BACKFILL AGGREGATE METRIC COLUMNS ON SHOPS
-- ------------------------------------------------------------------------------
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS bill_count BIGINT DEFAULT 0;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS total_revenue NUMERIC(14, 2) DEFAULT 0;

-- Backfill counts and revenue from existing bills
UPDATE public.shops s
SET 
    bill_count = COALESCE(b.cnt, 0),
    total_revenue = COALESCE(b.rev, 0)
FROM (
    SELECT shop_id, COUNT(*) AS cnt, SUM(total_amount) AS rev
    FROM public.bills
    GROUP BY shop_id
) b
WHERE s.id = b.shop_id;

-- Fallback for shops with sequential counter records
UPDATE public.shops
SET bill_count = GREATEST(0, next_bill_number - starting_bill_number)
WHERE bill_count = 0 AND next_bill_number > starting_bill_number;

-- ------------------------------------------------------------------------------
-- 3. UPDATE ATOMIC BILL GENERATION TO MAINTAIN SHOP METRICS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_bill_atomic(
    p_bill_id TEXT,
    p_shop_id TEXT,
    p_bill_type VARCHAR(20),
    p_total_amount NUMERIC(12, 2),
    p_items JSONB,
    p_created_at TIMESTAMPTZ DEFAULT NULL,
    p_subtotal NUMERIC(12, 2) DEFAULT NULL,
    p_discount_amount NUMERIC(12, 2) DEFAULT NULL,
    p_tax_amount NUMERIC(12, 2) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated_shop shops%ROWTYPE;
    v_bill_number BIGINT;
    v_inserted_bill bills%ROWTYPE;
    v_caller_uid UUID;
    v_computed_total NUMERIC(12, 2) := 0;
    v_computed_subtotal NUMERIC(12, 2) := 0;
    v_computed_discount NUMERIC(12, 2) := 0;
    v_computed_tax NUMERIC(12, 2) := 0;
    v_item RECORD;
    v_item_count INTEGER;
    v_item_name TEXT;
    v_item_qty NUMERIC;
    v_item_price NUMERIC;
    v_item_line_total NUMERIC;
    v_item_kind TEXT;
BEGIN
    -- Security check: Ensure authenticated caller owns this shop or has admin privileges
    v_caller_uid := auth.uid();
    IF v_caller_uid IS NULL OR NOT (
        (SELECT public.is_admin()) OR 
        EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id AND user_id = v_caller_uid)
    ) THEN
        RAISE EXCEPTION 'Unauthorized: You do not have permission to generate bills for this shop.';
    END IF;

    -- 0. Idempotency Check: If bill with this ID already exists for this shop, return it directly
    SELECT * INTO v_inserted_bill
    FROM public.bills
    WHERE id = p_bill_id AND shop_id = p_shop_id;

    IF FOUND THEN
        SELECT * INTO v_updated_shop
        FROM public.shops
        WHERE id = p_shop_id;

        RETURN jsonb_build_object(
            'bill', to_jsonb(v_inserted_bill),
            'shop', to_jsonb(v_updated_shop)
        );
    END IF;

    -- 1. Validate Bill Type
    IF p_bill_type IS NULL OR p_bill_type NOT IN ('simple', 'itemized') THEN
        RAISE EXCEPTION 'Invalid bill type: Must be "simple" or "itemized".';
    END IF;

    -- 2. Validate Items Array
    IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' THEN
        RAISE EXCEPTION 'Invalid items payload: Items must be a JSON array.';
    END IF;

    v_item_count := jsonb_array_length(p_items);
    IF v_item_count = 0 THEN
        RAISE EXCEPTION 'Cannot generate bill with empty basket items.';
    END IF;

    IF v_item_count > 100 THEN
        RAISE EXCEPTION 'Basket items exceed maximum allowed limit of 100.';
    END IF;

    -- 3. Validate Each Item and Recompute Totals Server-Side
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        name TEXT,
        qty NUMERIC,
        unit_price NUMERIC,
        line_total NUMERIC,
        kind TEXT
    )
    LOOP
        v_item_name := TRIM(COALESCE(v_item.name, ''));
        v_item_qty := COALESCE(v_item.qty, 0);
        v_item_price := COALESCE(v_item.unit_price, 0);
        v_item_line_total := COALESCE(v_item.line_total, 0);
        v_item_kind := LOWER(TRIM(COALESCE(v_item.kind, '')));

        IF length(v_item_name) = 0 OR length(v_item_name) > 120 THEN
            RAISE EXCEPTION 'Invalid item name: Name must be between 1 and 120 characters.';
        END IF;

        IF v_item_qty <= 0 OR v_item_qty > 10000 THEN
            RAISE EXCEPTION 'Invalid item quantity for "%": Quantity must be between 0.01 and 10000.', v_item_name;
        END IF;

        IF ROUND(v_item_line_total, 2) != ROUND(v_item_qty * v_item_price, 2) THEN
            RAISE EXCEPTION 'Line total calculation mismatch for item "%".', v_item_name;
        END IF;

        -- Non-discount items cannot have a negative price
        IF v_item_price < 0 AND v_item_kind != 'discount' AND v_item_name NOT ILIKE 'discount%' THEN
            RAISE EXCEPTION 'Non-discount items cannot have a negative price: "%".', v_item_name;
        END IF;

        -- Compute server-side breakdowns accurately
        IF v_item_kind = 'discount' OR v_item_price < 0 OR v_item_name ILIKE 'discount%' THEN
            v_computed_discount := v_computed_discount + ABS(v_item_line_total);
        ELSIF v_item_kind = 'vat' OR v_item_name ILIKE 'vat (%' OR v_item_name ILIKE 'vat' THEN
            v_computed_tax := v_computed_tax + v_item_line_total;
        ELSE
            v_computed_subtotal := v_computed_subtotal + v_item_line_total;
        END IF;

        v_computed_total := v_computed_total + v_item_line_total;
    END LOOP;

    IF v_computed_total < 0 THEN
        RAISE EXCEPTION 'Invalid bill total: Bill total cannot be negative.';
    END IF;

    -- Validate that client declared total matches server-verified sum within 2-decimal rounding tolerance
    IF ABS(p_total_amount - v_computed_total) > 0.05 THEN
        RAISE EXCEPTION 'Total amount mismatch: Client sent %, server computed %.', p_total_amount, v_computed_total;
    END IF;

    -- 4. Row-level lock on shop record to guarantee strictly serialized counter increment
    SELECT * INTO v_updated_shop
    FROM public.shops
    WHERE id = p_shop_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Shop with ID % not found', p_shop_id;
    END IF;

    -- Retrieve current counter (or fallback to 1)
    v_bill_number := COALESCE(v_updated_shop.next_bill_number, 1);

    -- Increment counter atomically with server timestamp NOW() and update shop metrics
    UPDATE public.shops
    SET next_bill_number = v_bill_number + 1,
        bill_count = COALESCE(bill_count, 0) + 1,
        total_revenue = COALESCE(total_revenue, 0) + ROUND(v_computed_total, 2),
        updated_at = NOW()
    WHERE id = p_shop_id
    RETURNING * INTO v_updated_shop;

    -- Insert the bill with the locked sequential number, snapshotted shop details, and server timestamp NOW()
    INSERT INTO public.bills (
        id,
        shop_id,
        shop_name,
        pan_number,
        bill_number,
        bill_type,
        total_amount,
        subtotal,
        discount_amount,
        tax_amount,
        items,
        created_at
    ) VALUES (
        p_bill_id,
        p_shop_id,
        v_updated_shop.shop_name,
        v_updated_shop.pan_number,
        v_bill_number,
        p_bill_type,
        ROUND(v_computed_total, 2),
        ROUND(COALESCE(p_subtotal, v_computed_subtotal), 2),
        ROUND(COALESCE(p_discount_amount, v_computed_discount), 2),
        ROUND(COALESCE(p_tax_amount, v_computed_tax), 2),
        p_items,
        NOW()
    )
    RETURNING * INTO v_inserted_bill;

    RETURN jsonb_build_object(
        'bill', to_jsonb(v_inserted_bill),
        'shop', to_jsonb(v_updated_shop)
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. ZERO-JOIN ADMIN SHOPS SUMMARY RPC
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_admin_shops_summary();

CREATE OR REPLACE FUNCTION public.get_admin_shops_summary()
RETURNS TABLE (
    id TEXT,
    user_id UUID,
    shop_name TEXT,
    pan_number TEXT,
    owner_name TEXT,
    email TEXT,
    phone TEXT,
    starting_bill_number BIGINT,
    next_bill_number BIGINT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    subscription_tier TEXT,
    subscription_status TEXT,
    subscription_started_at TIMESTAMPTZ,
    subscription_expires_at TIMESTAMPTZ,
    trial_expires_at TIMESTAMPTZ,
    bill_count BIGINT,
    total_revenue NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
    IF NOT (SELECT public.is_admin()) THEN
        RAISE EXCEPTION 'Unauthorized: Only administrators can view the cross-tenant shop summary.';
    END IF;

    RETURN QUERY
    SELECT 
        s.id,
        s.user_id,
        s.shop_name,
        s.pan_number,
        s.owner_name,
        s.email,
        s.phone,
        COALESCE(s.starting_bill_number, 1)::BIGINT,
        COALESCE(s.next_bill_number, 1)::BIGINT,
        s.created_at,
        s.updated_at,
        COALESCE(s.subscription_tier, 'free')::TEXT,
        COALESCE(s.subscription_status, 'trial')::TEXT,
        s.subscription_started_at,
        s.subscription_expires_at,
        s.trial_expires_at,
        COALESCE(s.bill_count, GREATEST(0, s.next_bill_number - s.starting_bill_number), 0)::BIGINT AS bill_count,
        COALESCE(s.total_revenue, 0)::NUMERIC AS total_revenue
    FROM public.shops s
    ORDER BY s.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_shops_summary() TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. REMOVE UNUSED REALTIME PUBLICATIONS
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS shops, items, bills;
    EXCEPTION
        WHEN undefined_object THEN NULL;
        WHEN undefined_table THEN NULL;
        WHEN others THEN NULL;
    END;
END $$;
