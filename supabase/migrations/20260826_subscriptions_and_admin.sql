-- ==============================================================================
-- DigiBill POS: Subscriptions & Admin Management Schema
-- ==============================================================================

-- 1. Add subscription and admin columns to `shops` table
ALTER TABLE IF EXISTS shops ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'free';
ALTER TABLE IF EXISTS shops ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'active';
ALTER TABLE IF EXISTS shops ADD COLUMN IF NOT EXISTS subscription_started_at timestamptz DEFAULT now();
ALTER TABLE IF EXISTS shops ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz;
ALTER TABLE IF EXISTS shops ADD COLUMN IF NOT EXISTS trial_expires_at timestamptz;
ALTER TABLE IF EXISTS shops ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- Auto-populate trial_expires_at for existing shops (7 days from creation)
UPDATE shops 
SET trial_expires_at = COALESCE(trial_expires_at, created_at + interval '7 days')
WHERE trial_expires_at IS NULL;

-- 2. Create `subscription_payments` audit log table
CREATE TABLE IF NOT EXISTS subscription_payments (
  id text PRIMARY KEY,
  shop_id text REFERENCES shops(id) ON DELETE CASCADE,
  shop_name text NOT NULL,
  pan_number text NOT NULL,
  amount numeric NOT NULL DEFAULT 500,
  duration_days integer NOT NULL DEFAULT 30,
  payment_method text DEFAULT 'bank_qr',
  transaction_ref text,
  activated_by text DEFAULT 'user@gmail.com',
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 3. Create indexes for quick lookups
CREATE INDEX IF NOT EXISTS idx_shops_pan ON shops(pan_number);
CREATE INDEX IF NOT EXISTS idx_shops_subscription ON shops(subscription_tier, subscription_expires_at);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_shop ON subscription_payments(shop_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_created ON subscription_payments(created_at DESC);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies: Allow default admin (user@gmail.com) full access
DO $$
BEGIN
  -- Policy for admin on shops
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'shops' AND policyname = 'Admins have full access to shops'
  ) THEN
    CREATE POLICY "Admins have full access to shops"
      ON shops
      FOR ALL
      USING (
        auth.jwt() ->> 'email' = 'user@gmail.com' OR
        auth.uid() = user_id
      );
  END IF;

  -- Policy for admin on subscription_payments
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'subscription_payments' AND policyname = 'Admins manage payments'
  ) THEN
    CREATE POLICY "Admins manage payments"
      ON subscription_payments
      FOR ALL
      USING (
        auth.jwt() ->> 'email' = 'user@gmail.com'
      );
  END IF;
END
$$;
