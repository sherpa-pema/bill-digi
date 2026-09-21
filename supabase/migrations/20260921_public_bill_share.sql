-- ==============================================================================
-- Migration: Public Bill Sharing Stored Procedure
-- Allows unauthenticated customers scanning QR code to safely fetch bill & shop
-- ==============================================================================

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

    -- 3. Return sanitized public payload (omits internal auth IDs, subscription keys, etc.)
    RETURN jsonb_build_object(
        'bill', to_jsonb(v_bill),
        'shop', jsonb_build_object(
            'id', v_shop.id,
            'shop_name', v_shop.shop_name,
            'pan_number', v_shop.pan_number,
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

-- Grant execution to anon and authenticated callers
GRANT EXECUTE ON FUNCTION public.get_public_bill(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_bill(TEXT) TO authenticated;
