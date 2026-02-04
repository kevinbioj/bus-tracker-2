CREATE OR REPLACE FUNCTION register_activities(
    p_inputs activity_input[],
    p_threshold_minutes integer DEFAULT 90
)
RETURNS void
LANGUAGE sql
AS $$
WITH input AS (
    SELECT *
    FROM unnest(p_inputs)
),
locked AS (
    SELECT
      pg_advisory_xact_lock(i.vehicle_id)
    FROM input i
),
updated_vehicles AS (
    UPDATE vehicle v
    SET last_seen_at = i.recorded_at
    FROM input i
    WHERE v.id = i.vehicle_id
),
updated_activities AS (
    UPDATE line_activity la
    SET updated_at = i.recorded_at
    FROM input i
    WHERE la.vehicle_id = i.vehicle_id
      AND la.line_id = i.line_id
      AND la.updated_at >= i.recorded_at - make_interval(mins => p_threshold_minutes)
    RETURNING la.vehicle_id, la.line_id
)
INSERT INTO line_activity (
    vehicle_id,
    line_id,
    service_date,
    started_at,
    updated_at
)
SELECT
    i.vehicle_id,
    i.line_id,
    i.service_date,
    i.recorded_at,
    i.recorded_at
FROM input i
LEFT JOIN updated_activities ua
  ON ua.vehicle_id = i.vehicle_id
 AND ua.line_id = i.line_id
WHERE ua.vehicle_id IS NULL;
$$;
