ALTER TABLE bengaluru_wards
ADD COLUMN IF NOT EXISTS aqi FLOAT;

COMMENT ON COLUMN bengaluru_wards.aqi IS 'Ward-level AQI (Sentinel-5P proxy)';

DROP TABLE IF EXISTS ward_aqi_stage;

CREATE TABLE ward_aqi_stage (
    ward_id INTEGER,
    ward_name TEXT,
    aqi FLOAT
);

\copy ward_aqi_stage FROM '/absolute/path/to/ward_aqi2.csv' CSV HEADER;

//Validate import you should see 16 aqi wards loaded
SELECT * FROM ward_aqi_stage;

UPDATE bengaluru_wards w
SET 
    aqi = s.aqi,
    last_updated = NOW(),
    data_source = 'Sentinel-5P AQI Proxy'
FROM ward_aqi_stage s
WHERE w.id = s.ward_id;

//Verify
SELECT ward_number, ward_name_en, aqi
FROM bengaluru_wards
WHERE aqi IS NOT NULL;

SELECT 
    id,
    ward_number,
    ward_name_en,
    baseline_lst,
    baseline_ndvi,
    baseline_albedo,
    aqi,
    ST_AsGeoJSON(geometry) AS geometry
FROM bengaluru_wards;

function getAQIColor(aqi) {
  if (aqi === null || aqi === undefined) {
    return Cesium.Color.GRAY.withAlpha(0.6);
  }

  if (aqi <= 50) return Cesium.Color.GREEN;
  if (aqi <= 100) return Cesium.Color.YELLOW;
  if (aqi <= 200) return Cesium.Color.ORANGE;
  return Cesium.Color.RED;
}
CREATE OR REPLACE FUNCTION get_ward_by_coordinates(
    longitude FLOAT,
    latitude FLOAT
)
RETURNS TABLE(
    ward_id INTEGER,
    ward_name TEXT,
    ward_number INTEGER,
    baseline_ndvi FLOAT,
    baseline_lst FLOAT,
    baseline_albedo FLOAT,
    aqi FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        w.id,
        w.ward_name_en,
        w.ward_number,
        w.baseline_ndvi,
        w.baseline_lst,
        w.baseline_albedo,
        w.aqi
    FROM bengaluru_wards w
    WHERE ST_Contains(
        w.geometry,
        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
    )
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;
