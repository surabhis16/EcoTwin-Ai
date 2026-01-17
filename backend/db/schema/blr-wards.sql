CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE bengaluru_wards (
    id SERIAL PRIMARY KEY,
    ward_number INTEGER UNIQUE NOT NULL,
    ward_name_en TEXT NOT NULL,
    ward_name_ka TEXT,
    population INTEGER,
    area_sqkm FLOAT,

    geometry GEOMETRY(MultiPolygon, 4326),
    centroid GEOMETRY(Point, 4326),

    baseline_ndvi FLOAT,
    baseline_lst FLOAT,
    baseline_albedo FLOAT,

    built_up_density FLOAT,
    tree_count INTEGER,
    road_density FLOAT,

    male_population INTEGER,
    female_population INTEGER,
    sc_population INTEGER,
    st_population INTEGER,

    assembly_constituency TEXT,
    parliamentary_constituency TEXT,

    last_updated TIMESTAMP DEFAULT NOW(),
    data_source TEXT
);

CREATE INDEX idx_wards_geometry
ON bengaluru_wards
USING GIST (geometry);

CREATE INDEX idx_wards_centroid
ON bengaluru_wards
USING GIST (centroid);

CREATE INDEX idx_wards_ward_number
ON bengaluru_wards (ward_number);

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
    baseline_albedo FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        w.id,
        w.ward_name_en,
        w.ward_number,
        w.baseline_ndvi,
        w.baseline_lst,
        w.baseline_albedo
    FROM bengaluru_wards w
    WHERE ST_Contains(
        w.geometry,
        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
    )
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;




