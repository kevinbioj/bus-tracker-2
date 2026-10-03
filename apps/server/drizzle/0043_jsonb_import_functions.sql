-- Variantes des fonctions d'import qui reçoivent leurs entrées en un seul paramètre JSON plutôt
-- qu'en un tableau de ROW(...) construit paramètre par paramètre : le texte de la requête ne dépend
-- plus de la taille du lot, et la limite de 65 535 paramètres par requête ne peut plus être atteinte.
-- `import_lines` en a déjà une (0030), reprise telle quelle. Les versions à ROW(...) sont conservées
-- pour un éventuel retour arrière.

CREATE OR REPLACE FUNCTION import_vehicles(p_network_id integer, p_refs jsonb)
RETURNS SETOF public.vehicle LANGUAGE sql AS $$
    SELECT * FROM import_vehicles(
        p_network_id,
        ARRAY(SELECT ROW(r.ref)::vehicle_input FROM jsonb_array_elements_text(p_refs) AS r(ref))
    );
$$;
--> statement-breakpoint

-- Enregistre le passage de véhicules sur des lignes.
--
-- Par rapport à la version précédente :
-- - une seule entrée par couple (véhicule, ligne), la plus récente : deux entrées pour un couple sans
--   activité en cours créaient deux activités ;
-- - l'activité prolongée est la dernière démarrée du couple, trouvée par l'index
--   (vehicle_id, line_id, started_at) : `updated_at` n'a plus besoin d'être indexé, ce qui permet à
--   PostgreSQL de réécrire la ligne sur place (HOT) ;
-- - `updated_at` et `last_seen_at` ne reculent plus lorsqu'une position plus ancienne arrive après une
--   plus récente.
CREATE OR REPLACE FUNCTION register_activities(p_inputs jsonb, p_threshold_minutes integer DEFAULT 90)
RETURNS void LANGUAGE sql AS $$
WITH input AS (
    SELECT DISTINCT ON (i.vehicle_id, i.line_id) i.vehicle_id, i.line_id, i.recorded_at, i.service_date
    FROM jsonb_to_recordset(p_inputs) AS i(vehicle_id integer, line_id integer, recorded_at timestamp, service_date date)
    ORDER BY i.vehicle_id, i.line_id, i.recorded_at DESC
),

v_upd AS (
    UPDATE vehicle v
    SET last_seen_at = i.recorded_at
    FROM (SELECT vehicle_id, max(recorded_at) AS recorded_at FROM input GROUP BY vehicle_id) i
    WHERE v.id = i.vehicle_id
      AND (v.last_seen_at IS NULL OR v.last_seen_at < i.recorded_at)
),

current_activity AS (
    SELECT i.*, la.id AS activity_id, la.updated_at
    FROM input i
    LEFT JOIN LATERAL (
        SELECT id, updated_at
        FROM line_activity
        WHERE vehicle_id = i.vehicle_id AND line_id = i.line_id
        ORDER BY started_at DESC
        LIMIT 1
    ) la ON true
),

la_upd AS (
    UPDATE line_activity la
    SET updated_at = c.recorded_at
    FROM current_activity c
    WHERE la.id = c.activity_id
      AND c.updated_at >= c.recorded_at - (p_threshold_minutes * interval '1 minute')
      AND c.updated_at < c.recorded_at
)

INSERT INTO line_activity (vehicle_id, line_id, service_date, started_at, updated_at)
SELECT c.vehicle_id, c.line_id, c.service_date, c.recorded_at, c.recorded_at
FROM current_activity c
WHERE c.activity_id IS NULL
   OR c.updated_at < c.recorded_at - (p_threshold_minutes * interval '1 minute');
$$;
--> statement-breakpoint

-- Une mise à jour HOT n'a lieu que si la page de la ligne a de la place pour sa nouvelle version.
-- Ne vaut que pour les pages écrites désormais : les pages existantes se libèrent au fil des VACUUM.
ALTER TABLE line_activity SET (fillfactor = 90);
--> statement-breakpoint
ALTER TABLE vehicle SET (fillfactor = 90);
