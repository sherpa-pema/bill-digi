-- ==============================================================================
-- DigiBill: Deduplicate Shops & Enforce Single Shop per User
-- ==============================================================================

-- 1. Ensure subscription columns exist on `shops` table
ALTER TABLE IF EXISTS shops ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';
ALTER TABLE IF EXISTS shops ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial';
ALTER TABLE IF EXISTS shops ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE IF EXISTS shops ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS shops ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days');

-- 2. Deduplicate existing duplicate shop entries (Keep the oldest or most referenced shop)
DO $$
DECLARE
    r RECORD;
    keeper_id TEXT;
BEGIN
    FOR r IN (
        SELECT user_id, COUNT(*) AS cnt 
        FROM shops 
        WHERE user_id IS NOT NULL 
        GROUP BY user_id 
        HAVING COUNT(*) > 1
    ) LOOP
        -- Choose keeper: prioritize shop that has bills or items, else the oldest created
        SELECT id INTO keeper_id
        FROM shops s
        WHERE s.user_id = r.user_id
        ORDER BY 
            (SELECT COUNT(*) FROM bills b WHERE b.shop_id = s.id) DESC,
            (SELECT COUNT(*) FROM items i WHERE i.shop_id = s.id) DESC,
            s.created_at ASC
        LIMIT 1;

        -- Reassign any items/bills from duplicate shops to keeper before deletion
        UPDATE items SET shop_id = keeper_id WHERE shop_id IN (
            SELECT id FROM shops WHERE user_id = r.user_id AND id != keeper_id
        );

        UPDATE bills SET shop_id = keeper_id WHERE shop_id IN (
            SELECT id FROM shops WHERE user_id = r.user_id AND id != keeper_id
        );

        -- Delete duplicate shops
        DELETE FROM shops WHERE user_id = r.user_id AND id != keeper_id;
    END LOOP;
END $$;

-- 3. Add UNIQUE constraint on user_id in shops table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_shops_user_id'
    ) THEN
        ALTER TABLE shops ADD CONSTRAINT uq_shops_user_id UNIQUE (user_id);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN others THEN NULL;
END $$;

-- 4. Update automatic shop provisioning trigger to populate trial fields
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
    v_shop_name := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'business_name'), ''), 'My Shop');
    v_pan_number := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'pan_number'), ''), '123456789');
    v_owner_name := NULLIF(TRIM(NEW.raw_user_meta_data->>'owner_name'), '');
    v_phone := COALESCE(NULLIF(TRIM(NEW.phone), ''), NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), ''));
    v_email := COALESCE(NULLIF(TRIM(NEW.email), ''), NULLIF(TRIM(NEW.raw_user_meta_data->>'email'), ''));
    v_shop_id := 'shop_' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
    v_trial_expiry := NOW() + INTERVAL '7 days';

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
