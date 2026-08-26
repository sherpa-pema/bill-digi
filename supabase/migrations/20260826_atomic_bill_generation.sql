-- ==============================================================================
-- DigiBill POS: Atomic Bill Generation & Sequential Numbering Function
-- Eliminates TOCTOU race conditions and duplicate key collisions
-- ==============================================================================

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
BEGIN
    -- Security check: Ensure authenticated caller owns this shop or has admin privileges
    v_caller_uid := auth.uid();
    IF NOT (
        public.is_admin() OR 
        EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id AND user_id = v_caller_uid)
    ) THEN
        RAISE EXCEPTION 'Unauthorized: You do not have permission to generate bills for this shop.';
    END IF;

    -- Row-level lock on shop record to guarantee strictly serialized counter increment
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

    -- Insert the bill with the locked sequential number
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
        p_total_amount,
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
