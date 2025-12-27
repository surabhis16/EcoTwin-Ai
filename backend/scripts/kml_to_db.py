from dotenv import load_dotenv
load_dotenv()

import xml.etree.ElementTree as ET
from sqlalchemy import create_engine, text
from shapely.geometry import Polygon, MultiPolygon, shape
from shapely import wkt
import geopandas as gpd
import os

DATABASE_URL = os.getenv("DATABASE_URL")  
engine = create_engine(DATABASE_URL)

# Parse KML coordinate string to Shapely polygon
def parse_kml_coordinates(coord_string):
    coords = []
    for point in coord_string.strip().split():
        lon, lat, *_ = point.split(',')
        coords.append((float(lon), float(lat)))
    return Polygon(coords)

# Import KML ward data to PostgreSQL
def import_kml_to_database(kml_file_path):
    
    # Parse KML
    tree = ET.parse(kml_file_path)
    root = tree.getroot()
    
    # KML namespace
    ns = {'kml': 'http://www.opengis.net/kml/2.2'}
    
    with engine.connect() as conn:
        for placemark in root.findall('.//kml:Placemark', ns):
            # Extract basic info
            extended_data = placemark.find('.//kml:ExtendedData', ns)
            schema_data = extended_data.find('.//kml:SchemaData', ns)
            
            data = {}
            for simple_data in schema_data.findall('.//kml:SimpleData', ns):
                key = simple_data.get('name')
                value = simple_data.text
                data[key] = value
            
            # Extract geometry
            coords_elem = placemark.find('.//kml:coordinates', ns)
            if coords_elem is not None:
                polygon = parse_kml_coordinates(coords_elem.text)
                geometry_wkt = wkt.dumps(MultiPolygon([polygon]))
                centroid_wkt = wkt.dumps(polygon.centroid)
                
                # Insert into database
                query = text("""
                    INSERT INTO bengaluru_wards (
                        ward_number,
                        ward_name_en,
                        ward_name_ka,
                        population,
                        area_sqkm,
                        geometry,
                        centroid,
                        male_population,
                        female_population,
                        sc_population,
                        st_population,
                        assembly_constituency,
                        parliamentary_constituency,
                        data_source
                    ) VALUES (
                        :ward_number,
                        :ward_name_en,
                        :ward_name_ka,
                        :population,
                        :area_sqkm,
                        ST_GeomFromText(:geometry, 4326),
                        ST_GeomFromText(:centroid, 4326),
                        :male_pop,
                        :female_pop,
                        :sc_pop,
                        :st_pop,
                        :assembly,
                        :parliamentary,
                        'BBMP KML 2024'
                    )
                    ON CONFLICT (ward_number) DO UPDATE SET
                        ward_name_en = EXCLUDED.ward_name_en,
                        population = EXCLUDED.population
                """)
                
                conn.execute(query, {
                    'ward_number': int(data.get('id')),
                    'ward_name_en': data.get('proposed_ward_name_en'),
                    'ward_name_ka': data.get('proposed_ward_name_ka'),
                    'population': int(data.get('population', 0)),
                    'area_sqkm': float(data.get('ward_area', 0)),
                    'geometry': geometry_wkt,
                    'centroid': centroid_wkt,
                    'male_pop': int(data.get('male_population', 0)),
                    'female_pop': int(data.get('female_population', 0)),
                    'sc_pop': int(data.get('sc_population', 0)),
                    'st_pop': int(data.get('st_population', 0)),
                    'assembly': data.get('assembly_constituency_name_en'),
                    'parliamentary': data.get('parliamentary_constituency_name_en')
                })
                
                print(f"Imported Ward {data.get('id')}: {data.get('proposed_ward_name_en')}")
        
        conn.commit()

if __name__ == "__main__":
    import_kml_to_database("public/data/bengaluru_wards.kml")
    print("KML import complete.")