CREATE OR REPLACE FUNCTION import_network(p_ref text)
RETURNS SETOF public.network LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM public.network WHERE ref = p_ref;

    IF NOT FOUND THEN
        INSERT INTO public.network (ref, name)
        SELECT p_ref, p_ref
        WHERE NOT EXISTS (SELECT 1 FROM public.network WHERE ref = p_ref)
        ON CONFLICT (ref) DO NOTHING;

        RETURN QUERY
        SELECT * FROM public.network WHERE ref = p_ref;
    END IF;
END;
$$;
