-- ==============================================================================
-- Migration: Single Trigger Provisioning, Profile Completion RPC & Valid PAN Guard
-- ==============================================================================

-- 1. Ensure columns shop_name and pan_number can be NULL until profile is completed
ALTER TABLE public.shops ALTER COLUMN shop_name DROP NOT NULL;
ALTER TABLE public.shops ALTER COLUMN pan_number DROP NOT NULL;

-- 2. Update CHECK constraint on pan_number to allow NULL or strictly 9 numeric digits
ALTER TABLE public.shops DROP CONSTRAINT IF EXISTS chk_shops_pan_format;
ALTER TABLE public.shops ADD CONSTRAINT chk_shops_pan_format CHECK (pan_number IS NULL OR pan_number ~ '^\d{9}$');

-- 3. Cleanup existing fake/placeholder PANs: nullify 123456789 so billing cannot occur under fake PAN
UPDATE public.shops 
SET pan_number = NULL 
WHERE pan_number = '123456789' OR pan_number !~ '^\d{9}$';

-- 4. DB Trigger: Single Creator with NO DEFAULTS (No 'My Shop', No '123456789')
CREATE OR REPLACE FUNCTION public.handle_new_user_shop()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_shop_name TEXT;
    v_pan_number TEXT;
    v_owner_name TEXT;
    v_phone TEXT;
    v_email TEXT;
    v_shop_id TEXT;
    v_trial_expiry TIMESTAMPTZ;
BEGIN
    -- Do not default to 'My Shop' or '123456789'
    v_shop_name := NULLIF(TRIM(NEW.raw_user_meta_data->>'business_name'), '');
    v_pan_number := NULLIF(TRIM(NEW.raw_user_meta_data->>'pan_number'), '');
    
    -- Reject placeholder or invalid PAN in metadata: do NOT fallback to 123456789
    IF v_pan_number IS NOT NULL AND (v_pan_number !~ '^\d{9}$' OR v_pan_number = '123456789') THEN
        v_pan_number := NULL;
    END IF;

    v_owner_name := NULLIF(TRIM(NEW.raw_user_meta_data->>'owner_name'), '');
    v_phone := COALESCE(NULLIF(TRIM(NEW.phone), ''), NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), ''));
    v_email := COALESCE(NULLIF(TRIM(NEW.email), ''), NULLIF(TRIM(NEW.raw_user_meta_data->>'email'), ''));
    v_shop_id := 'shop_' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
    v_trial_expiry := NOW() + INTERVAL '7 days';

    -- Trigger is the SINGLE creator: insert with ON CONFLICT (user_id) DO NOTHING
    IF NOT EXISTS (SELECT 1 FROM public.shops WHERE user_id = NEW.id) THEN
        INSERT INTO public.shops (
            id,
            user_id,
            shop_name,
            pan_number,
            owner_name,
            email,
            phone,
            starting_bill_number,
            next_bill_number,
            subscription_tier,
            subscription_status,
            subscription_started_at,
            subscription_expires_at,
            trial_expires_at,
            created_at,
            updated_at
        ) VALUES (
            v_shop_id,
            NEW.id,
            v_shop_name,
            v_pan_number,
            v_owner_name,
            v_email,
            v_phone,
            1,
            1,
            'free',
            'trial',
            NOW(),
            NULL,
            v_trial_expiry,
            NOW(),
            NOW()
        )
        ON CONFLICT (user_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_shop();

-- 5. Dedicated Profile Completion RPC: Clients complete profile through one RPC
CREATE OR REPLACE FUNCTION public.complete_shop_profile(
    p_shop_name TEXT,
    p_pan_number TEXT,
    p_owner_name TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_shop_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_uid UUID;
    v_clean_name TEXT;
    v_clean_pan TEXT;
    v_target_shop_id TEXT;
    v_updated_shop public.shops%ROWTYPE;
BEGIN
    v_caller_uid := auth.uid();
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: You must be logged in to complete shop profile.';
    END IF;

    -- Validate shop name: required and non-empty
    v_clean_name := TRIM(COALESCE(p_shop_name, ''));
    IF length(v_clean_name) = 0 THEN
        RAISE EXCEPTION 'Invalid shop name: Shop name is required.';
    END IF;
    IF length(v_clean_name) > 120 THEN
        RAISE EXCEPTION 'Invalid shop name: Shop name cannot exceed 120 characters.';
    END IF;

    -- Validate PAN number: exactly 9 numeric digits, and NOT placeholder 123456789
    v_clean_pan := TRIM(COALESCE(p_pan_number, ''));
    IF v_clean_pan !~ '^\d{9}$' THEN
        RAISE EXCEPTION 'Invalid PAN number: PAN must be exactly 9 numeric digits.';
    END IF;
    IF v_clean_pan = '123456789' THEN
        RAISE EXCEPTION 'Invalid PAN number: Cannot use placeholder PAN 123456789. Please enter your registered 9-digit PAN.';
    END IF;

    -- Resolve shop ID: verify ownership or admin privileges
    IF p_shop_id IS NOT NULL AND TRIM(p_shop_id) != '' THEN
        IF NOT (
            public.is_admin() OR
            EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id AND user_id = v_caller_uid)
        ) THEN
            RAISE EXCEPTION 'Forbidden: You do not have permission to manage this shop.';
        END IF;
        v_target_shop_id := p_shop_id;
    ELSE
        SELECT id INTO v_target_shop_id
        FROM public.shops
        WHERE user_id = v_caller_uid
        ORDER BY created_at ASC
        LIMIT 1;
    END IF;

    -- If no shop exists for user (e.g. legacy account prior to trigger), provision safely
    IF v_target_shop_id IS NULL THEN
        v_target_shop_id := 'shop_' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
        INSERT INTO public.shops (
            id,
            user_id,
            shop_name,
            pan_number,
            owner_name,
            email,
            phone,
            starting_bill_number,
            next_bill_number,
            subscription_tier,
            subscription_status,
            subscription_started_at,
            trial_expires_at,
            created_at,
            updated_at
        ) VALUES (
            v_target_shop_id,
            v_caller_uid,
            v_clean_name,
            v_clean_pan,
            NULLIF(TRIM(p_owner_name), ''),
            NULLIF(TRIM(p_email), ''),
            NULLIF(TRIM(p_phone), ''),
            1,
            1,
            'free',
            'trial',
            NOW(),
            NOW() + INTERVAL '7 days',
            NOW(),
            NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
            shop_name = EXCLUDED.shop_name,
            pan_number = EXCLUDED.pan_number,
            owner_name = COALESCE(EXCLUDED.owner_name, public.shops.owner_name),
            email = COALESCE(EXCLUDED.email, public.shops.email),
            phone = COALESCE(EXCLUDED.phone, public.shops.phone),
            updated_at = NOW()
        RETURNING * INTO v_updated_shop;

        RETURN to_jsonb(v_updated_shop);
    END IF;

    -- Atomically update shop profile in single operation
    UPDATE public.shops
    SET shop_name = v_clean_name,
        pan_number = v_clean_pan,
        owner_name = COALESCE(NULLIF(TRIM(p_owner_name), ''), owner_name),
        email = COALESCE(NULLIF(TRIM(p_email), ''), email),
        phone = COALESCE(NULLIF(TRIM(p_phone), ''), phone),
        updated_at = NOW()
    WHERE id = v_target_shop_id
    RETURNING * INTO v_updated_shop;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Shop with ID % not found.', v_target_shop_id;
    END IF;

    RETURN to_jsonb(v_updated_shop);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_shop_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Function alias: complete_profile
CREATE OR REPLACE FUNCTION public.complete_profile(
    p_shop_name TEXT,
    p_pan_number TEXT,
    p_owner_name TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_shop_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.complete_shop_profile(p_shop_name, p_pan_number, p_owner_name, p_email, p_phone, p_shop_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- 6. Update set_shop_pan_number to reject placeholder PAN 123456789
CREATE OR REPLACE FUNCTION public.set_shop_pan_number(
    p_shop_id TEXT,
    p_pan_number TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_pan TEXT;
    v_updated_shop public.shops%ROWTYPE;
    v_caller_uid UUID;
BEGIN
    -- Authorization check
    v_caller_uid := auth.uid();
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: You must be logged in to update shop settings.';
    END IF;

    IF NOT (
        public.is_admin() OR 
        EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id AND user_id = v_caller_uid)
    ) THEN
        RAISE EXCEPTION 'Forbidden: You do not have permission to manage this shop.';
    END IF;

    -- Validate PAN: 9 numeric digits and not placeholder 123456789
    v_clean_pan := TRIM(COALESCE(p_pan_number, ''));
    IF v_clean_pan !~ '^\d{9}$' THEN
        RAISE EXCEPTION 'Invalid PAN number: PAN must be exactly 9 numeric digits.';
    END IF;

    IF v_clean_pan = '123456789' THEN
        RAISE EXCEPTION 'Invalid PAN number: Cannot use placeholder PAN 123456789. Please enter your registered 9-digit PAN.';
    END IF;

    UPDATE public.shops
    SET pan_number = v_clean_pan,
        updated_at = NOW()
    WHERE id = p_shop_id
    RETURNING * INTO v_updated_shop;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Shop with ID % not found.', p_shop_id;
    END IF;

    RETURN to_jsonb(v_updated_shop);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_shop_pan_number(TEXT, TEXT) TO authenticated;

-- 7. Update create_bill_atomic: Strictly Reject Billing Until Valid PAN is Set
CREATE OR REPLACE FUNCTION public.create_bill_atomic(
    p_shop_id TEXT,
    p_bill_id TEXT,
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
    v_bill_number BIGINT;
    v_max_existing BIGINT;
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

        IF v_item_price < -9999999.99 OR v_item_price > 9999999.99 THEN
            RAISE EXCEPTION 'Unit price out of bounds for item "%".', v_item_name;
        END IF;

        IF v_item_price < 0 AND v_item_kind != 'discount' AND v_item_name NOT ILIKE 'discount%' THEN
            RAISE EXCEPTION 'Non-discount items cannot have a negative price: "%".', v_item_name;
        END IF;

        IF ABS(v_item_line_total - (v_item_qty * v_item_price)) > 0.05 THEN
            RAISE EXCEPTION 'Line total calculation mismatch for item "%".', v_item_name;
        END IF;

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

    -- 6a. Valid PAN Guard: Reject billing until a valid 9-digit PAN is set (not null, not placeholder 123456789)
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

    -- 6b. Subscription & Trial Verification (Server-Authoritative Enforcement)
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

    -- 7. Self-Healing Monotonic Sequence Protection:
    SELECT COALESCE(MAX(bill_number) + 1, 1) INTO v_max_existing
    FROM public.bills
    WHERE shop_id = p_shop_id;

    v_bill_number := GREATEST(COALESCE(v_updated_shop.next_bill_number, 1), v_max_existing);

    -- Increment counter atomically with server timestamp NOW() and update shop metrics
    UPDATE public.shops
    SET next_bill_number = v_bill_number + 1,
        bill_count = COALESCE(bill_count, 0) + 1,
        total_revenue = COALESCE(total_revenue, 0) + ROUND(v_computed_total, 2),
        updated_at = NOW()
    WHERE id = p_shop_id;

    -- Fetch refreshed shop state to return in payload
    SELECT * INTO v_updated_shop
    FROM public.shops
    WHERE id = p_shop_id;

    -- 8. Insert bill record with server-calculated breakdown and server-enforced NOW() timestamp
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
        ROUND(v_computed_total, 2),
        ROUND(v_computed_subtotal, 2),
        ROUND(v_computed_discount, 2),
        ROUND(v_computed_tax, 2),
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
