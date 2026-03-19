CREATE OR REPLACE FUNCTION register_activities(
    p_inputs activity_input[],
    p_threshold_minutes integer DEFAULT 90
)
RETURNS void
LANGUAGE sql
AS $$
WITH input AS (
    SELECT * FROM unnest(p_inputs)
),

v_upd AS (
    UPDATE vehicle v
    SET last_seen_at = i.recorded_at
    FROM input i
    WHERE v.id = i.vehicle_id
      AND (v.last_seen_at IS NULL OR v.last_seen_at < i.recorded_at)
),

la_upd AS (
    UPDATE line_activity la
    SET updated_at = i.recorded_at
    FROM input i
    WHERE la.vehicle_id = i.vehicle_id
      AND la.line_id = i.line_id
      AND la.updated_at >= i.recorded_at - (p_threshold_minutes * interval '1 minute')
    RETURNING la.vehicle_id, la.line_id
)

INSERT INTO line_activity (vehicle_id, line_id, service_date, started_at, updated_at)
SELECT i.vehicle_id, i.line_id, i.service_date, i.recorded_at, i.recorded_at
FROM input i
WHERE NOT EXISTS (
    SELECT 1 FROM la_upd
    WHERE la_upd.vehicle_id = i.vehicle_id
      AND la_upd.line_id = i.line_id
);
$$
