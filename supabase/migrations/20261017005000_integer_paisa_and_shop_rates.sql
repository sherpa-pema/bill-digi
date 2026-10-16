-- ==============================================================================
-- Migration: Integer Paisa Math, Shop Stored Rates & Explicit Kind Breakdown
-- ==============================================================================

-- 1. Add rate and simple line name columns to public.shops
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'vat_rate') THEN
        ALTER TABLE public.shops ADD COLUMN vat_rate NUMERIC(5, 2) NOT NULL DEFAULT 13.00 CHECK (vat_rate >= 0 AND vat_rate <= 100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'discount_rate') THEN
        ALTER TABLE public.shops ADD COLUMN discount_rate NUMERIC(5, 2) NOT NULL DEFAULT 10.00 CHECK (discount_rate >= 0 AND discount_rate <= 100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'vat_inclusive') THEN
        ALTER TABLE public.shops ADD COLUMN vat_inclusive BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'simple_item_name') THEN
        ALTER TABLE public.shops ADD COLUMN simple_item_name TEXT NOT NULL DEFAULT 'General Item';
    END IF;
END $$;

-- 2. Update create_bill_atomic: Integer Paisa Arithmetic & Server-Authoritative Breakdown
CREATE OR REPLACE FUNCTION public.create_bill_atomic(
    p_shop_id TEXT,
    p_bill_id TEXT,
    p_bill_type VARCHAR(20),
    p_total_amount NUMERIC(12, 2),
    p_items JSONB,
    p_created_at TIMESTAMPTZ DEFAULT NULL,
    p_subtotal NUMERIC(12, 2) DEFAULT NULL,       -- Ignored: Server computes strictly from line items
    p_discount_amount NUMERIC(12, 2) DEFAULT NULL, -- Ignored: Server computes strictly from line items
    p_tax_amount NUMERIC(12, 2) DEFAULT NULL       -- Ignored: Server computes strictly from line items
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_bill_number BIGINT;
    v_max_existing BIGINT;
    v_updated_shop shops%ROWTYPE;
    v_inserted_bill bills%ROWTYPE;
    v_caller_uid UUID;
    
    -- Integer Paisa Accumulators (1 NPR = 100 Paisa)
    p_total_paisa BIGINT;
    v_computed_total_paisa BIGINT := 0;
    v_computed_subtotal_paisa BIGINT := 0;
    v_computed_discount_paisa BIGINT := 0;
    v_computed_tax_paisa BIGINT := 0;
    
    v_item RECORD;
    v_item_count INTEGER;
    v_item_name TEXT;
    v_item_qty NUMERIC;
    v_item_price NUMERIC;
    v_item_line_total NUMERIC;
    v_item_kind TEXT;
    
    v_item_price_paisa BIGINT;
    v_item_line_total_paisa BIGINT;
    
    -- Shop Rates & Calculation Modes
    v_vat_rate NUMERIC(5, 2);
    v_discount_rate NUMERIC(5, 2);
    v_vat_inclusive BOOLEAN;
    v_taxable_base_paisa BIGINT;
    v_expected_discount_paisa BIGINT;
    v_expected_tax_paisa BIGINT;
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

    p_total_paisa := ROUND(p_total_amount * 100)::BIGINT;

    -- 3. Validate Items JSONB Payload Structure & Guard Against Storage Bloat
    IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' THEN
        RAISE EXCEPTION 'Invalid items payload: Expected JSON array.';
    END IF;

    IF octet_length(p_items::text) > 65536 THEN
        RAISE EXCEPTION 'Items payload exceeds maximum allowed size (64KB).';
    END IF;

    v_item_count := jsonb_array_length(p_items);
    IF v_item_count < 1 OR v_item_count > 200 THEN
        RAISE EXCEPTION 'Items array length must be between 1 and 200 items.';
    END IF;

    -- 4. Row-level lock on shop record to guarantee strictly serialized counter increment & fetch shop rates
    SELECT * INTO v_updated_shop
    FROM public.shops
    WHERE id = p_shop_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Shop with ID % not found', p_shop_id;
    END IF;

    -- 4a. Valid PAN Guard: Reject billing until a valid 9-digit PAN is set (not null, not placeholder 123456789)
    IF v_updated_shop.pan_number IS NULL OR TRIM(v_updated_shop.pan_number) = '' THEN
        RAISE EXCEPTION 'InvalidPanNumber: Billing is disabled until a valid 9-digit PAN number is configured in shop profile.'
            USING ERRCODE = 'P0004';
    END IF;

    IF v_updated_shop.pan_number !~ '^\d{9}$' THEN
        RAISE EXCEPTION 'InvalidPanNumber: Shop PAN number must be exactly 9 numeric digits.'
            USING ERRCODE = 'P0004';
    END IF;

    IF v_updated_shop.pan_number = '123456789' THEN
        RAISE EXCEPTION 'InvalidPanNumber: Billing is disabled under placeholder PAN 123456789. Please configure your registered 9-digit PAN in shop settings.'
            USING ERRCODE = 'P0004';
    END IF;

    -- 4b. Subscription & Trial Verification (Server-Authoritative Enforcement)
    IF NOT (SELECT public.is_admin()) THEN
        IF NOT (
            (v_updated_shop.subscription_tier = 'pro' AND 
             (v_updated_shop.subscription_expires_at IS NULL OR v_updated_shop.subscription_expires_at > NOW()))
            OR
            (COALESCE(v_updated_shop.trial_expires_at, v_updated_shop.created_at + INTERVAL '7 days') > NOW())
        ) THEN
            RAISE EXCEPTION 'SubscriptionExpired: Your 7-day trial or Pro subscription has expired. Please upgrade to continue billing.'
                USING ERRCODE = 'P0003';
        END IF;
    END IF;

    -- 4c. Load Rates Stored on Shop
    v_vat_rate := COALESCE(v_updated_shop.vat_rate, 13.00);
    v_discount_rate := COALESCE(v_updated_shop.discount_rate, 10.00);
    v_vat_inclusive := COALESCE(v_updated_shop.vat_inclusive, FALSE);

    -- 5. Validate Each Item Schema and Compute Integer Paisa Accumulators
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
        v_item_kind := LOWER(TRIM(COALESCE(v_item.kind, 'item')));

        -- Explicit Kind Enforcement: Only 'item', 'discount', or 'vat'
        IF v_item_kind NOT IN ('item', 'discount', 'vat') THEN
            RAISE EXCEPTION 'Invalid item kind "%" for item "%": Must be "item", "discount", or "vat".', v_item_kind, v_item_name;
        END IF;

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
        IF v_item_price < 0 AND v_item_kind != 'discount' THEN
            RAISE EXCEPTION 'Non-discount items cannot have a negative price: "%".', v_item_name;
        END IF;

        -- Discount items cannot have a positive line total
        IF v_item_line_total > 0 AND v_item_kind = 'discount' THEN
            RAISE EXCEPTION 'Discount item cannot have a positive line total: "%".', v_item_name;
        END IF;

        -- Integer Paisa representation of unit price and line total
        v_item_price_paisa := ROUND(v_item_price * 100)::BIGINT;
        v_item_line_total_paisa := ROUND(v_item_line_total * 100)::BIGINT;

        -- Verify line total calculation in integer paisa (line_total = qty * unit_price with 2 paisa tolerance)
        IF ABS(v_item_line_total_paisa - (v_item_qty * v_item_price_paisa)) > 2 THEN
            RAISE EXCEPTION 'Line total calculation mismatch for item "%".', v_item_name;
        END IF;

        -- Derive Breakdown Strictly from Explicit Kind (Never by item name string!)
        IF v_item_kind = 'discount' THEN
            v_computed_discount_paisa := v_computed_discount_paisa + ABS(v_item_line_total_paisa);
            v_computed_total_paisa := v_computed_total_paisa + v_item_line_total_paisa; -- negative addition decreases total
        ELSIF v_item_kind = 'vat' THEN
            v_computed_tax_paisa := v_computed_tax_paisa + v_item_line_total_paisa;
            IF NOT v_vat_inclusive THEN
                v_computed_total_paisa := v_computed_total_paisa + v_item_line_total_paisa;
            END IF;
        ELSE -- 'item'
            v_computed_subtotal_paisa := v_computed_subtotal_paisa + v_item_line_total_paisa;
            v_computed_total_paisa := v_computed_total_paisa + v_item_line_total_paisa;
        END IF;
    END LOOP;

    -- 6. Mathematical Recomputation Integrity Verification in Integer Paisa
    IF ABS(v_computed_total_paisa - p_total_paisa) > 2 THEN
        RAISE EXCEPTION 'Total amount mismatch: Recomputed sum (Rs %) does not match submitted total (Rs %).',
            (v_computed_total_paisa / 100.0), (p_total_paisa / 100.0);
    END IF;

    IF v_computed_total_paisa <= 0 THEN
        RAISE EXCEPTION 'Calculated bill total must be greater than zero.';
    END IF;

    -- 6c. Verify VAT and Discount against Rates Stored on Shop
    -- If a discount line was submitted, verify it aligns with shop's discount rate
    IF v_computed_discount_paisa > 0 AND v_computed_subtotal_paisa > 0 THEN
        v_expected_discount_paisa := ROUND((v_computed_subtotal_paisa * v_discount_rate) / 100.0)::BIGINT;
        IF ABS(v_computed_discount_paisa - v_expected_discount_paisa) > 5 THEN
            RAISE EXCEPTION 'Discount amount mismatch: Submitted Rs % does not match shop rate of % %% (expected Rs %).',
                (v_computed_discount_paisa / 100.0), v_discount_rate, (v_expected_discount_paisa / 100.0);
        END IF;
    END IF;

    -- If a VAT line was submitted, verify it aligns with shop's VAT rate and inclusive/exclusive mode
    IF v_computed_tax_paisa > 0 THEN
        v_taxable_base_paisa := v_computed_subtotal_paisa - v_computed_discount_paisa;
        IF v_vat_inclusive THEN
            -- In VAT-inclusive pricing (Retail MRP mode): VAT = TaxableBase * (rate / (100 + rate))
            v_expected_tax_paisa := ROUND((v_taxable_base_paisa * v_vat_rate) / (100.0 + v_vat_rate))::BIGINT;
        ELSE
            -- In VAT-exclusive pricing: VAT = TaxableBase * (rate / 100)
            v_expected_tax_paisa := ROUND((v_taxable_base_paisa * v_vat_rate) / 100.0)::BIGINT;
        END IF;

        IF ABS(v_computed_tax_paisa - v_expected_tax_paisa) > 5 THEN
            RAISE EXCEPTION 'VAT amount mismatch: Submitted Rs % does not match shop rate of % %% (expected Rs %).',
                (v_computed_tax_paisa / 100.0), v_vat_rate, (v_expected_tax_paisa / 100.0);
        END IF;
    END IF;

    -- 7. Self-Healing Monotonic Sequence Protection:
    SELECT COALESCE(MAX(bill_number) + 1, 1) INTO v_max_existing
    FROM public.bills
    WHERE shop_id = p_shop_id;

    v_bill_number := GREATEST(COALESCE(v_updated_shop.next_bill_number, 1), v_max_existing);

    -- Increment counter atomically with server timestamp NOW() and update shop metrics
    UPDATE public.shops
    SET next_bill_number = v_bill_number + 1,
        bill_count = COALESCE(bill_count, 0) + 1,
        total_revenue = COALESCE(total_revenue, 0) + ROUND(v_computed_total_paisa / 100.0, 2),
        updated_at = NOW()
    WHERE id = p_shop_id;

    -- Fetch refreshed shop state to return in payload
    SELECT * INTO v_updated_shop
    FROM public.shops
    WHERE id = p_shop_id;

    -- 8. Insert bill record with server-calculated breakdown (Ignoring any client p_subtotal overrides)
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
        COALESCE(v_updated_shop.shop_name, 'Shop'),
        v_updated_shop.pan_number,
        v_bill_number,
        p_bill_type,
        ROUND(v_computed_total_paisa / 100.0, 2),
        ROUND(v_computed_subtotal_paisa / 100.0, 2),
        ROUND(v_computed_discount_paisa / 100.0, 2),
        ROUND(v_computed_tax_paisa / 100.0, 2),
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

GRANT EXECUTE ON FUNCTION public.create_bill_atomic(TEXT, TEXT, VARCHAR, NUMERIC, JSONB, TIMESTAMPTZ, NUMERIC, NUMERIC, NUMERIC) TO authenticated;
