-- ==============================================================================
-- Migration: Universal Server-Side Search for Shop Bills
-- Date: 2026-10-07
-- Description:
--   Creates dedicated PostgreSQL RPC `search_shop_bills` allowing multi-tenant
--   shop owners to search across all historical bills by:
--   - Partial / substring bill numbers (e.g. "12" matching #112)
--   - Formatted totals / amounts
--   - Item names / JSONB line item details
--   - Bill type ("simple", "itemized")
--   Supports date-range filtering, keyset-compatible pagination, and exact matching count.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.search_shop_bills(
    p_shop_id TEXT,
    p_query TEXT DEFAULT NULL,
    p_date_filter TEXT DEFAULT '30days',
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL,
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_query TEXT;
    v_today_start TIMESTAMPTZ;
    v_seven_days_ago TIMESTAMPTZ;
    v_thirty_days_ago TIMESTAMPTZ;
    v_total_count BIGINT;
    v_bills JSONB;
BEGIN
    -- 1. Security Check: caller must be owner of shop or admin
    IF NOT (
        (SELECT public.is_admin()) OR 
        EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id AND user_id = (SELECT auth.uid()))
    ) THEN
        RAISE EXCEPTION 'Forbidden: You do not have permission to view bills for this shop.';
    END IF;

    v_clean_query := TRIM(COALESCE(p_query, ''));
    v_today_start := date_trunc('day', NOW());
    v_seven_days_ago := NOW() - INTERVAL '7 days';
    v_thirty_days_ago := NOW() - INTERVAL '30 days';

    WITH filtered AS (
        SELECT b.*
        FROM public.bills b
        WHERE b.shop_id = p_shop_id
          AND (
            p_start_date IS NOT NULL AND b.created_at >= p_start_date OR
            p_start_date IS NULL AND (
                p_date_filter = 'all' OR
                (p_date_filter = 'today' AND b.created_at >= v_today_start) OR
                (p_date_filter = '7days' AND b.created_at >= v_seven_days_ago) OR
                (p_date_filter = '30days' AND b.created_at >= v_thirty_days_ago) OR
                p_date_filter IS NULL
            )
          )
          AND (p_end_date IS NULL OR b.created_at <= p_end_date)
          AND (
            v_clean_query = '' OR
            b.bill_number::TEXT ILIKE '%' || v_clean_query || '%' OR
            b.total_amount::TEXT ILIKE '%' || v_clean_query || '%' OR
            b.bill_type ILIKE '%' || v_clean_query || '%' OR
            b.items::TEXT ILIKE '%' || v_clean_query || '%'
          )
    ),
    counted AS (
        SELECT COUNT(*) AS total_count FROM filtered
    ),
    sliced AS (
        SELECT * FROM filtered
        ORDER BY bill_number DESC
        LIMIT GREATEST(1, p_limit) + 1
        OFFSET GREATEST(0, p_offset)
    )
    SELECT 
        (SELECT total_count FROM counted),
        COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.bill_number DESC), '[]'::jsonb)
    INTO v_total_count, v_bills
    FROM sliced s;

    RETURN jsonb_build_object(
        'bills', CASE 
            WHEN jsonb_array_length(v_bills) > p_limit 
            THEN v_bills - (jsonb_array_length(v_bills) - 1)::int 
            ELSE v_bills 
        END,
        'has_more', (jsonb_array_length(v_bills) > p_limit),
        'total_count', COALESCE(v_total_count, 0)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_shop_bills(TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INT, INT) TO authenticated;
