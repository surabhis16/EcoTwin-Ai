CREATE TABLE materials (
    id SERIAL PRIMARY KEY,
    material_name TEXT NOT NULL,
    usage_type TEXT NOT NULL,
    applications TEXT,
    thermal_conductivity FLOAT,
    specific_heat FLOAT,
    solar_reflective_index FLOAT,
    embodied_carbon FLOAT,
    voc_rating FLOAT,
    recycled_content FLOAT,
    price_inr_per_m3 FLOAT,
    local_availability INTEGER,
    source_distance_km FLOAT,
    cooling_index FLOAT,
    transport_adjusted_carbon FLOAT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_materials_usage_type ON materials(usage_type);
CREATE INDEX idx_materials_applications ON materials(applications);