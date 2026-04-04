CREATE OR REPLACE FUNCTION import_network(p_input network_input)
RETURNS SETOF public.network LANGUAGE plpgsql AS $$
DECLARE
    v_network public.network;
BEGIN
    SELECT * INTO v_network FROM public.network WHERE ref = p_input.ref;

    IF FOUND THEN
        RETURN NEXT v_network;
    ELSE
        RETURN QUERY
        INSERT INTO public.network (ref, name)
        VALUES (p_input.ref, p_input.name)
        RETURNING *;
    END IF;
END;
$$;
