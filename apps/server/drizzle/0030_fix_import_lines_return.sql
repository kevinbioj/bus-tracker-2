CREATE OR REPLACE FUNCTION import_lines(p_network_id integer, p_lines_data jsonb, p_recorded_at timestamp)
RETURNS SETOF public.line LANGUAGE plpgsql AS $$
DECLARE
    v_refs varchar[];
BEGIN
    PERFORM pg_advisory_xact_lock(p_network_id);

    SELECT array_agg(DISTINCT (l->>'ref')::varchar) INTO v_refs
    FROM jsonb_array_elements(p_lines_data) AS l;

    INSERT INTO public.line (network_id, ref, "number", color, text_color)
    SELECT p_network_id, ARRAY[id.ref]::varchar[], id.number, id.color, id.text_color
    FROM (
        SELECT DISTINCT
            (l->>'ref')::varchar AS ref,
            (l->>'number')::varchar AS number,
            CASE WHEN length(l->>'color') = 6 THEN (l->>'color') ELSE NULL END AS color,
            CASE WHEN length(l->>'textColor') = 6 THEN (l->>'textColor') ELSE NULL END AS text_color
        FROM jsonb_array_elements(p_lines_data) AS l
    ) id
    WHERE NOT EXISTS (
        SELECT 1 FROM public.line li
        WHERE li.network_id = p_network_id
          AND li.ref && ARRAY[id.ref]::varchar[]
          AND (li.archived_at IS NULL OR li.archived_at >= p_recorded_at)
    );

    RETURN QUERY
    SELECT l.* FROM public.line l
    WHERE l.network_id = p_network_id
      AND l.ref && v_refs
      AND (l.archived_at IS NULL OR l.archived_at >= p_recorded_at);
END;
$$;
