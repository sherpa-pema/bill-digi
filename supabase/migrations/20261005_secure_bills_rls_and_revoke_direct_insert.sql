-- ==============================================================================
-- DigiBill POS: Revoke Direct INSERT on Bills Table (SEC-02 Mitigation)
-- Enforces that all bills must be generated exclusively via create_bill_atomic() RPC.
-- Prevents authenticated tenants or adversaries from directly inserting unvalidated
-- bills via PostgREST, skipping sequential counters, or bypassing math verification.
-- ==============================================================================

-- 1. Drop all direct INSERT policies on public.bills
DROP POLICY IF EXISTS "Users can insert bills to own shops" ON public.bills;
DROP POLICY IF EXISTS "Enable read/write for all" ON public.bills;
DROP POLICY IF EXISTS "Allow public and authenticated access to bills" ON public.bills;
DROP POLICY IF EXISTS "Public access policy" ON public.bills;

-- 2. Explicitly ensure Row Level Security is active on public.bills
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

-- 3. Confirm SELECT policy remains strictly bounded to tenant shop ownership and verified admins
DROP POLICY IF EXISTS "Users can select bills of own shops" ON public.bills;
CREATE POLICY "Users can select bills of own shops" 
ON public.bills FOR SELECT 
TO authenticated 
USING (
    public.is_admin() OR
    EXISTS (
        SELECT 1 FROM public.shops 
        WHERE public.shops.id = public.bills.shop_id 
        AND public.shops.user_id = auth.uid()
    )
);

-- Note:
-- Direct INSERT, UPDATE, and DELETE policies are intentionally omitted for both 'authenticated' and 'anon' roles.
-- Since Row Level Security defaults to default-deny, no client REST calls (POST/PATCH/DELETE to /rest/v1/bills) can alter the bills table.
-- All bill creation must be executed via the SECURITY DEFINER stored procedure `public.create_bill_atomic()`.
