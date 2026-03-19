CREATE TYPE line_input AS (
    ref varchar,
    "number" varchar,
    color varchar,
    text_color varchar
);

CREATE OR REPLACE FUNCTION import_lines(p_network_id integer, p_lines_data line_input[], p_recorded_at timestamp)
RETURNS SETOF public.line LANGUAGE plpgsql AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(p_network_id);

    RETURN QUERY
    WITH input_data AS (
        SELECT DISTINCT
            id.ref::varchar AS ref,
            id.number::varchar AS number,
            CASE WHEN length(id.color) = 6 THEN id.color ELSE NULL END AS color,
            CASE WHEN length(id.text_color) = 6 THEN id.text_color ELSE NULL END AS text_color
        FROM unnest(p_lines_data) AS id
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
      AND (l.archived_at IS NULL OR l.archived_at >= p_recorded_at)
    UNION ALL
    SELECT * FROM inserted;
END;
$$;

CREATE TYPE network_input AS (
    ref varchar,
    name varchar
);

CREATE OR REPLACE FUNCTION import_network(p_input network_input)
RETURNS SETOF public.network LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    WITH ins AS (
        INSERT INTO public.network (ref, name)
        VALUES (p_input.ref, p_input.name)
        ON CONFLICT (ref) DO NOTHING
        RETURNING *
    )
    SELECT * FROM ins
    UNION ALL
    SELECT * FROM public.network n WHERE n.ref = p_input.ref AND NOT EXISTS (SELECT 1 FROM ins);
END;
$$;

CREATE TYPE vehicle_input AS (
    ref varchar
);

CREATE OR REPLACE FUNCTION import_vehicles(p_network_id integer, p_vehicle_inputs vehicle_input[])
RETURNS SETOF public.vehicle LANGUAGE plpgsql AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(p_network_id);

    INSERT INTO public.vehicle (network_id, ref, "number", type)
    SELECT p_network_id, id.ref, regexp_replace(id.ref, '^(?:[^:]*:){3}', ''), 'UNKNOWN'
    FROM (SELECT DISTINCT ref FROM unnest(p_vehicle_inputs)) AS id
    WHERE NOT EXISTS (
        SELECT 1 FROM public.vehicle v
        WHERE v.network_id = p_network_id AND v.ref = id.ref
    );

    RETURN QUERY
    SELECT v.* FROM public.vehicle v
    WHERE v.network_id = p_network_id AND v.ref = ANY(SELECT ref FROM unnest(p_vehicle_inputs));
END;
$$;