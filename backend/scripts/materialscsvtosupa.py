import os
import pandas as pd
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

# import materials from csv to postgresql db in supa
def import_materials_from_csv(csv_path="backend/materials_dataset.csv"):
    try:
        df = pd.read_csv(csv_path)
        
        # map CSV cols to database cols
        column_mapping = {
            'Material_Name': 'material_name',
            'Usage_Type': 'usage_type',
            'Applications': 'applications',
            'Thermal_Conductivity_W_mK': 'thermal_conductivity',
            'Specific_Heat_kJ_kgK': 'specific_heat',
            'Solar_Reflective_Index': 'solar_reflective_index',
            'Embodied_Carbon_kgCO2_kg': 'embodied_carbon',
            'VOC_Rating': 'voc_rating',
            'Recycled_Content_percent': 'recycled_content',
            'Price_INR_per_m3': 'price_inr_per_m3',
            'Local_Availability_1_10': 'local_availability',
            'Source_Distance_KM': 'source_distance_km',
            'Cooling_Index': 'cooling_index',
            'Transport_Adjusted_Carbon': 'transport_adjusted_carbon'
        }
        
        # rename columns to match database schema
        df_renamed = df.rename(columns=column_mapping)
        
        # handle missing values
        df_renamed = df_renamed.where(pd.notnull(df_renamed), None)
        
        # select only columns that exist in the database
        db_columns = list(column_mapping.values())
        df_final = df_renamed[db_columns]
        
        # clear existing data first? (give me a choice)
        clear_existing = input("Clear existing materials in database? (y/n): ").lower()
        
        with engine.connect() as conn:
            if clear_existing == 'y':
                conn.execute(text("DELETE FROM materials"))
                conn.commit()
                print("Cleared existing data")
            
            # pandas to_sql for efficient batch insert
            print("Inserting materials into database...")
            df_final.to_sql(
                'materials',
                con=conn,
                if_exists='append',  # append to existing table
                index=False,
                method='multi',
                chunksize=100
            )
            conn.commit()
        
        print(f"\Imported {len(df_final)} materials from CSV.")
        
        # verify the import
        with engine.connect() as conn:
            count_query = text("SELECT COUNT(*) as count FROM materials")
            result = conn.execute(count_query).fetchone()
            print(f"Verification: Database now has {result.count} total materials")
        
        return len(df_final)
    
    except FileNotFoundError:
        print(f"Error: Could not find CSV file at {csv_path}")
        return 0
    
    except Exception as e:
        print(f"Error importing materials: {e}")
        import traceback
        traceback.print_exc()
        return 0

def verify_import():
    try:
        with engine.connect() as conn:
            # Get sample materials
            query = text("""
                SELECT material_name, usage_type, price_inr_per_m3, cooling_index
                FROM materials 
                ORDER BY cooling_index DESC
                LIMIT 5
            """)
            result = conn.execute(query).fetchall()
        
        print("\nTop 5 materials by cooling index:")
        for i, row in enumerate(result, 1):
            print(f"{i}. {row.material_name}")
            print(f"   Type: {row.usage_type}")
            print(f"   Price: ₹{row.price_inr_per_m3}/m³")
            print(f"   Cooling Index: {row.cooling_index}")
            print()
        
    except Exception as e:
        print(f"Error verifying data: {e}")

def test_with_ward():
    print("\nTesting material recommendation...")
    
    try:
        with engine.connect() as conn:
            # Get a sample ward
            ward_query = text("""
                SELECT ward_name_en, baseline_lst 
                FROM bengaluru_wards 
                ORDER BY baseline_lst DESC 
                LIMIT 1
            """)
            ward = conn.execute(ward_query).fetchone()
        
        if ward:
            print(f"Testing with hottest ward: {ward.ward_name_en} (LST: {ward.baseline_lst}°C)")
            print(f"This ward would get materials optimized for high heat zones")
        else:
            print("No ward data found. Make sure your bengaluru_wards table is populated.")
    
    except Exception as e:
        print(f"Error testing: {e}")

if __name__ == "__main__":
    
    csv_path = input("Enter CSV file path (press Enter for 'materials_dataset.csv'): ").strip()
    if not csv_path:
        csv_path = "materials_dataset.csv"
    

    # Confirm import
    confirm = input("\nProceed with import? (y/n): ").lower()
    if confirm == 'y':
        imported = import_materials_from_csv(csv_path)
        
        if imported > 0:
            verify_import()
            test_with_ward()
    else:
        print("Import cancelled")