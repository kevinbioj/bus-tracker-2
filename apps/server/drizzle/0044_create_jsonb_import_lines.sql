-- La migration 0043 supposait que `import_lines(integer, jsonb, timestamp)` existait encore (0030) :
-- ce n'est pas le cas partout, la variante ayant pu être supprimée à la main. Elle est créée ici
-- explicitement, sur le modèle d'`import_vehicles(integer, jsonb)` : les entrées JSON sont converties
-- puis confiées à la version à `line_input[]`, seule à porter la logique d'import.
-- Les noms de paramètres sont ceux de 0030 : CREATE OR REPLACE remplace ainsi la fonction là où elle
-- existe encore, et la crée ailleurs.
CREATE OR REPLACE FUNCTION import_lines(p_network_id integer, p_lines_data jsonb, p_recorded_at timestamp)
RETURNS SETOF public.line LANGUAGE sql AS $$
    SELECT * FROM import_lines(
        p_network_id,
        ARRAY(
            SELECT ROW(l.ref, l."number", l.color, l."textColor")::line_input
            FROM jsonb_to_recordset(p_lines_data) AS l(ref varchar, "number" varchar, color varchar, "textColor" varchar)
        ),
        p_recorded_at
    );
$$;
