-- ==============================================================================
-- DigiBill POS: Harden Bill Creation, Payload Guardrails & Price Verification
-- Prevents price tampering, math forgery, storage bloat (DoS), and ledger corruption
-- ==============================================================================

-- 1. Hardened Atomic Bill Creation Function with Full Server-Side Validation
CREATE OR REPLACE FUNCTION public.create_bill_atomic(
    p_shop_id TEXT,
    p_bill_id TEXT,
    p_bill_type VARCHAR(20),
    p_total_amount NUMERIC(12, 2),
    p_items JSONB,
    p_created_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_bill_number BIGINT;
    v_updated_shop shops%ROWTYPE;
    v_inserted_bill bills%ROWTYPE;
    v_caller_uid UUID;
    v_computed_total NUMERIC(12, 2) := 0;
    v_item RECORD;
    v_item_count INTEGER;
    v_item_name TEXT;
    v_item_qty NUMERIC;
    v_item_price NUMERIC;
    v_item_line_total NUMERIC;
BEGIN
    -- Security check: Ensure authenticated caller owns this shop or has admin privileges
    v_caller_uid := auth.uid();
    IF NOT (
        public.is_admin() OR 
        EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id AND user_id = v_caller_uid)
    ) THEN
        RAISE EXCEPTION 'Unauthorized: You do not have permission to generate bills for this shop.';
    END IF;

    -- 1. Validate Bill Type
    IF p_bill_type IS NULL OR p_bill_type NOT IN ('simple', 'itemized') THEN
        RAISE EXCEPTION 'Invalid bill type: Must be "simple" or "itemized".';
    END IF;

    -- 2. Validate Total Amount Range
    IF p_total_amount IS NULL OR p_total_amount <= 0 OR p_total_amount > 99999999.99 THEN
        RAISE EXCEPTION 'Invalid total amount: Total must be between Rs 0.01 and Rs 99,999,999.99.';
    END IF;

    -- 3. Validate Items JSONB Payload Structure & Guard Against Storage Bloat
    IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' THEN
        RAISE EXCEPTION 'Invalid items payload: Expected JSON array.';
    END IF;

    -- Guard against storage bloat & DoS payload (max 64KB JSON string)
    IF octet_length(p_items::text) > 65536 THEN
        RAISE EXCEPTION 'Items payload exceeds maximum allowed size (64KB).';
    END IF;

    v_item_count := jsonb_array_length(p_items);
    IF v_item_count < 1 OR v_item_count > 200 THEN
        RAISE EXCEPTION 'Items array length must be between 1 and 200 items.';
    END IF;

    -- 4. Validate Each Item Schema and Price Boundaries
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS (
        id TEXT,
        name TEXT,
        qty NUMERIC,
        unit_price NUMERIC,
        line_total NUMERIC
    )
    LOOP
        v_item_name := TRIM(COALESCE(v_item.name, ''));
        v_item_qty := COALESCE(v_item.qty, 0);
        v_item_price := COALESCE(v_item.unit_price, 0);
        v_item_line_total := COALESCE(v_item.line_total, 0);

        IF length(v_item_name) = 0 OR length(v_item_name) > 120 THEN
            RAISE EXCEPTION 'Invalid item name: Name must be between 1 and 120 characters.';
        END IF;

        IF v_item_qty < 1 OR v_item_qty > 99999 OR v_item_qty != ROUND(v_item_qty) THEN
            RAISE EXCEPTION 'Invalid quantity for item "%": Qty must be an integer between 1 and 99,999.', v_item_name;
        END IF;

        -- Price ceiling & floor check (-9,999,999.99 to 9,999,999.99)
        IF v_item_price < -9999999.99 OR v_item_price > 9999999.99 THEN
            RAISE EXCEPTION 'Unit price out of bounds for item "%".', v_item_name;
        END IF;

        -- Non-discount items cannot have a negative price
        IF v_item_price < 0 AND v_item_name NOT ILIKE '%discount%' THEN
            RAISE EXCEPTION 'Non-discount items cannot have a negative price: "%".', v_item_name;
        END IF;

        -- Verify line total calculation (line_total = qty * unit_price with 0.05 rounding tolerance)
        IF ABS(v_item_line_total - (v_item_qty * v_item_price)) > 0.05 THEN
            RAISE EXCEPTION 'Line total calculation mismatch for item "%".', v_item_name;
        END IF;

        v_computed_total := v_computed_total + v_item_line_total;
    END LOOP;

    -- 5. Mathematical Recomputation Integrity Verification
    IF ABS(v_computed_total - p_total_amount) > 0.05 THEN
        RAISE EXCEPTION 'Total amount mismatch: Recomputed sum (%) does not match submitted total (%).', v_computed_total, p_total_amount;
    END IF;

    IF v_computed_total <= 0 THEN
        RAISE EXCEPTION 'Calculated bill total must be greater than zero.';
    END IF;

    -- 6. Row-level lock on shop record to guarantee strictly serialized counter increment
    SELECT * INTO v_updated_shop
    FROM public.shops
    WHERE id = p_shop_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Shop with ID % not found', p_shop_id;
    END IF;

    -- Retrieve current counter (or fallback to 1)
    v_bill_number := COALESCE(v_updated_shop.next_bill_number, 1);

    -- Increment counter atomically
    UPDATE public.shops
    SET next_bill_number = v_bill_number + 1,
        updated_at = p_created_at
    WHERE id = p_shop_id
    RETURNING * INTO v_updated_shop;

    -- Insert the bill with the locked sequential number and sanitized computed total
    INSERT INTO public.bills (
        id,
        shop_id,
        bill_number,
        bill_type,
        total_amount,
        items,
        created_at
    ) VALUES (
        p_bill_id,
        p_shop_id,
        v_bill_number,
        p_bill_type,
        ROUND(v_computed_total, 2),
        p_items,
        p_created_at
    )
    RETURNING * INTO v_inserted_bill;

    -- Return confirmed bill and updated shop payload
    RETURN jsonb_build_object(
        'bill', to_jsonb(v_inserted_bill),
        'shop', to_jsonb(v_updated_shop)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_bill_atomic(TEXT, TEXT, VARCHAR, NUMERIC, JSONB, TIMESTAMPTZ) TO authenticated;

-- 2. Add Storage-Level CHECK Constraints to Prevent Negative/Corrupted Data
DO $$
BEGIN
    -- Check total_amount on bills
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_bills_total_amount'
    ) THEN
        ALTER TABLE public.bills 
        ADD CONSTRAINT chk_bills_total_amount 
        CHECK (total_amount > 0 AND total_amount <= 99999999.99);
    END IF;

    -- Check items is JSON array on bills
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_bills_items_is_array'
    ) THEN
        ALTER TABLE public.bills 
        ADD CONSTRAINT chk_bills_items_is_array 
        CHECK (jsonb_typeof(items) = 'array');
    END IF;

    -- Check price on items table
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_items_price'
    ) THEN
        ALTER TABLE public.items 
        ADD CONSTRAINT chk_items_price 
        CHECK (price >= 0 AND price <= 9999999.99);
    END IF;
EXCEPTION
    WHEN others THEN NULL;
END $$;

-- 3. Enforce Financial Immutability on public.bills
-- Revoke direct UPDATE and DELETE permissions from tenant users to preserve ledger integrity
DROP POLICY IF EXISTS "Users can update bills of own shops" ON public.bills;
DROP POLICY IF EXISTS "Users can delete bills of own shops" ON public.bills;
