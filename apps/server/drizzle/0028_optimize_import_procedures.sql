-- Suppression de l'ancien index de véhicule s'il existe
DROP INDEX IF EXISTS vehicle_network_ref_index;

-- Création du nouvel index unique pour les véhicules
CREATE UNIQUE INDEX IF NOT EXISTS vehicle_network_ref_unique_index ON public.vehicle (network_id, ref);

-- Création de l'index GIN pour les lignes (accélère les recherches de tableaux)
CREATE INDEX IF NOT EXISTS line_ref_gin_idx ON public.line USING gin (ref);

-- Optimisation de import_network
CREATE OR REPLACE FUNCTION import_network(p_ref text)
RETURNS SETOF public.network LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    WITH ins AS (
        INSERT INTO public.network (ref, name)
        VALUES (p_ref, p_ref)
        ON CONFLICT (ref) DO NOTHING
        RETURNING *
    )
    SELECT * FROM ins
    UNION ALL
    SELECT * FROM public.network n WHERE n.ref = p_ref AND NOT EXISTS (SELECT 1 FROM ins);
END;
$$;

-- Optimisation de import_vehicles
CREATE OR REPLACE FUNCTION import_vehicles(p_network_id integer, p_vehicle_refs text[])
RETURNS SETOF public.vehicle LANGUAGE plpgsql AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(p_network_id);

    INSERT INTO public.vehicle (network_id, ref, "number", type)
    SELECT p_network_id, r, regexp_replace(r, '^(?:[^:]*:){3}', ''), 'UNKNOWN'
    FROM (SELECT DISTINCT unnest(p_vehicle_refs) AS r) AS src
    WHERE NOT EXISTS (
        SELECT 1 FROM public.vehicle v 
        WHERE v.network_id = p_network_id AND v.ref = src.r
    );

    RETURN QUERY
    SELECT v.* FROM public.vehicle v
    WHERE v.network_id = p_network_id AND v.ref = ANY(p_vehicle_refs);
END;
$$;

-- Optimisation de import_lines (parsing JSON unique, CTE pour retour rapide, index GIN utilisé)
CREATE OR REPLACE FUNCTION import_lines(p_network_id integer, p_lines_data jsonb, p_recorded_at timestamp)
RETURNS SETOF public.line LANGUAGE plpgsql AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(p_network_id);

    RETURN QUERY
    WITH input_data AS (
        SELECT DISTINCT
            (l->>'ref')::varchar AS ref,
            (l->>'number')::varchar AS number,
            CASE WHEN length(l->>'color') = 6 THEN (l->>'color') ELSE NULL END AS color,
            CASE WHEN length(l->>'textColor') = 6 THEN (l->>'textColor') ELSE NULL END AS text_color
        FROM jsonb_array_elements(p_lines_data) AS l
    ),
    all_refs AS (
        SELECT array_agg(ref) as refs FROM input_data
    ),
    inserted AS (
        INSERT INTO public.line (network_id, ref, "number", color, text_color)
        SELECT p_network_id, ARRAY[id.ref]::varchar[], id.number, id.color, id.text_color
        FROM input_data id
        WHERE NOT EXISTS (
            SELECT 1 FROM public.line li
            WHERE li.network_id = p_network_id
              AND li.ref && ARRAY[id.ref]::varchar[]
              AND (li.archived_at IS NULL OR li.archived_at >= p_recorded_at)
        )
        RETURNING *
    )
    SELECT l.* FROM public.line l, all_refs
    WHERE l.network_id = p_network_id
      AND l.ref && all_refs.refs
      AND (l.archived_at IS NULL OR l.archived_at >= p_recorded_at);
END;
$$;
