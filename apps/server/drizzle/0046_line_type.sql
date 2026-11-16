ALTER TABLE "line" ADD COLUMN "type" varchar(32);--> statement-breakpoint
CREATE OR REPLACE FUNCTION import_lines(p_network_id integer, p_lines_data jsonb, p_recorded_at timestamp)
RETURNS SETOF public.line LANGUAGE plpgsql AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(p_network_id);

    UPDATE public.line li
    SET type = i.type
    FROM jsonb_to_recordset(p_lines_data) AS i(ref varchar, type varchar)
    WHERE li.network_id = p_network_id
      AND li.ref && ARRAY[i.ref]::varchar[]
      AND (li.archived_at IS NULL OR li.archived_at >= p_recorded_at)
      AND i.type IS NOT NULL
      AND i.type <> 'UNKNOWN'
      AND li.type IS DISTINCT FROM i.type;

    INSERT INTO public.line (network_id, ref, "number", color, text_color, type)
    SELECT DISTINCT ON (i.ref)
        p_network_id,
        ARRAY[i.ref]::varchar[],
        i."number",
        CASE WHEN length(i.color) = 6 THEN i.color END,
        CASE WHEN length(i."textColor") = 6 THEN i."textColor" END,
        i.type
    FROM jsonb_to_recordset(p_lines_data) AS i(ref varchar, "number" varchar, color varchar, "textColor" varchar, type varchar)
    WHERE NOT EXISTS (
        SELECT 1 FROM public.line li
        WHERE li.network_id = p_network_id
          AND li.ref && ARRAY[i.ref]::varchar[]
          AND (li.archived_at IS NULL OR li.archived_at >= p_recorded_at)
    );

    RETURN QUERY
    SELECT l.* FROM public.line l
    WHERE l.network_id = p_network_id
      AND l.ref && ARRAY(SELECT i.ref FROM jsonb_to_recordset(p_lines_data) AS i(ref varchar))::varchar[]
      AND (l.archived_at IS NULL OR l.archived_at >= p_recorded_at);
END;
$$;
