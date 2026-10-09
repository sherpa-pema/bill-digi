-- ==============================================================================
-- Migration: Add Subtotal, Discount, Tax, Shop Name & PAN Snapshots to Bills,
-- enforce server-side NOW() timestamp, and prevent VAT misclassification.
-- ==============================================================================

-- 1. Add snapshot and breakdown columns to bills table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bills' AND column_name = 'shop_name') THEN
        ALTER TABLE public.bills ADD COLUMN shop_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bills' AND column_name = 'pan_number') THEN
        ALTER TABLE public.bills ADD COLUMN pan_number VARCHAR(9);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bills' AND column_name = 'subtotal') THEN
        ALTER TABLE public.bills ADD COLUMN subtotal NUMERIC(12, 2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bills' AND column_name = 'discount_amount') THEN
        ALTER TABLE public.bills ADD COLUMN discount_amount NUMERIC(12, 2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bills' AND column_name = 'tax_amount') THEN
        ALTER TABLE public.bills ADD COLUMN tax_amount NUMERIC(12, 2) DEFAULT 0;
    END IF;

    -- Backfill snapshotted shop details for existing bills from current shops table
    UPDATE public.bills b
    SET shop_name = s.shop_name,
        pan_number = s.pan_number
    FROM public.shops s
    WHERE b.shop_id = s.id
      AND (b.shop_name IS NULL OR b.pan_number IS NULL);
END $$;

-- 2. Update create_bill_atomic function to enforce server NOW(), snapshot shop & PAN, and support idempotency
CREATE OR REPLACE FUNCTION public.create_bill_atomic(
    p_shop_id TEXT,
    p_bill_id TEXT,
    p_bill_type VARCHAR(20),
    p_total_amount NUMERIC(12, 2),
    p_items JSONB,
    p_created_at TIMESTAMPTZ DEFAULT NULL, -- Ignored to prevent client backdating; server enforces NOW()
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
    v_bill_number BIGINT;
    v_updated_shop shops%ROWTYPE;
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
    IF NOT (
        public.is_admin() OR 
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

        IF v_item_qty < 1 OR v_item_qty > 99999 OR v_item_qty != ROUND(v_item_qty) THEN
            RAISE EXCEPTION 'Invalid quantity for item "%": Qty must be an integer between 1 and 99,999.', v_item_name;
        END IF;

        -- Price ceiling & floor check (-9,999,999.99 to 9,999,999.99)
        IF v_item_price < -9999999.99 OR v_item_price > 9999999.99 THEN
            RAISE EXCEPTION 'Unit price out of bounds for item "%".', v_item_name;
        END IF;

        -- Non-discount items cannot have a negative price
        IF v_item_price < 0 AND v_item_kind != 'discount' AND v_item_name NOT ILIKE 'discount%' THEN
            RAISE EXCEPTION 'Non-discount items cannot have a negative price: "%".', v_item_name;
        END IF;

        -- Verify line total calculation (line_total = qty * unit_price with 0.05 rounding tolerance)
        IF ABS(v_item_line_total - (v_item_qty * v_item_price)) > 0.05 THEN
            RAISE EXCEPTION 'Line total calculation mismatch for item "%".', v_item_name;
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

    -- Increment counter atomically using server timestamp NOW()
    UPDATE public.shops
    SET next_bill_number = v_bill_number + 1,
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

    -- Return confirmed bill and updated shop payload
    RETURN jsonb_build_object(
        'bill', to_jsonb(v_inserted_bill),
        'shop', to_jsonb(v_updated_shop)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_bill_atomic(TEXT, TEXT, VARCHAR, NUMERIC, JSONB, TIMESTAMPTZ, NUMERIC, NUMERIC, NUMERIC) TO authenticated;

-- 3. Update get_public_bill to prioritize snapshotted shop_name and pan_number
CREATE OR REPLACE FUNCTION public.get_public_bill(p_bill_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_bill bills%ROWTYPE;
    v_shop shops%ROWTYPE;
BEGIN
    -- 1. Fetch bill by ID
    SELECT * INTO v_bill
    FROM public.bills
    WHERE id = p_bill_id;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- 2. Fetch associated shop
    SELECT * INTO v_shop
    FROM public.shops
    WHERE id = v_bill.shop_id;

    -- 3. Return sanitized public payload with snapshotted shop details
    RETURN jsonb_build_object(
        'bill', to_jsonb(v_bill),
        'shop', jsonb_build_object(
            'id', v_shop.id,
            'shop_name', COALESCE(v_bill.shop_name, v_shop.shop_name),
            'pan_number', COALESCE(v_bill.pan_number, v_shop.pan_number),
            'phone', v_shop.phone,
            'email', v_shop.email,
            'starting_bill_number', v_shop.starting_bill_number,
            'next_bill_number', v_shop.next_bill_number,
            'created_at', v_shop.created_at,
            'updated_at', v_shop.updated_at
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_bill(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_bill(TEXT) TO authenticated;
