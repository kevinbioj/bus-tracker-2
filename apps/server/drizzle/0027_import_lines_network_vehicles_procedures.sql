CREATE OR REPLACE FUNCTION import_lines(
    p_network_id integer,
    p_lines_data jsonb,
    p_recorded_at timestamp
)
RETURNS SETOF public.line
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(p_network_id);

    INSERT INTO public.line (network_id, ref, "number", color, text_color)
    SELECT 
        p_network_id, 
        ARRAY[(l->>'ref')]::varchar[], 
        (l->>'number'), 
        CASE WHEN length(l->>'color') = 6 THEN (l->>'color') ELSE NULL END,
        CASE WHEN length(l->>'textColor') = 6 THEN (l->>'textColor') ELSE NULL END
    FROM jsonb_array_elements(p_lines_data) AS l
    WHERE NOT EXISTS (
        SELECT 1 FROM public.line li
        WHERE li.network_id = p_network_id
          AND li.ref && ARRAY[(l->>'ref')]::varchar[]
          AND (li.archived_at IS NULL OR li.archived_at >= p_recorded_at)
    );

    RETURN QUERY
    SELECT l.* FROM public.line l
    WHERE l.network_id = p_network_id
      AND l.ref && (SELECT array_agg(lx->>'ref')::varchar[] FROM jsonb_array_elements(p_lines_data) lx)
      AND (l.archived_at IS NULL OR l.archived_at >= p_recorded_at);
END;
$$;

CREATE OR REPLACE FUNCTION import_vehicles(
    p_network_id integer,
    p_vehicle_refs text[]
)
RETURNS SETOF public.vehicle
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(p_network_id);

    INSERT INTO public.vehicle (network_id, ref, "number", type)
    SELECT 
        p_network_id, 
        r, 
        regexp_replace(r, '^(?:[^:]*:){3}', ''), 
        'UNKNOWN'
    FROM unnest(p_vehicle_refs) AS r
    WHERE NOT EXISTS (
        SELECT 1 FROM public.vehicle v 
        WHERE v.network_id = p_network_id AND v.ref = r
    );

    RETURN QUERY
    SELECT v.* FROM public.vehicle v
    WHERE v.network_id = p_network_id AND v.ref = ANY(p_vehicle_refs);
END;
$$;

CREATE OR REPLACE FUNCTION import_network(
    p_ref text
)
RETURNS SETOF public.network
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.network (ref, name)
    VALUES (p_ref, p_ref)
    ON CONFLICT (ref) DO NOTHING;

    RETURN QUERY
    SELECT n.* FROM public.network n WHERE n.ref = p_ref;
END;
$$;
