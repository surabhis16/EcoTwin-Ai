from dotenv import load_dotenv
load_dotenv()

import os
import numpy as np
import geopandas as gpd
import rasterio
from rasterio.mask import mask
import pandas as pd
from sqlalchemy import create_engine, text


# Database connection
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)


# Band mean
def safe_band_mean(band_array, nodata=None, valid_range=None):
    """
    Compute mean while safely excluding nodata and invalid values
    """
    band = band_array.astype("float32")

    # Remove explicit nodata
    if nodata is not None:
        band[band == nodata] = np.nan

    # Remove physically impossible values
    if valid_range:
        min_val, max_val = valid_range
        band[(band < min_val) | (band > max_val)] = np.nan

    if np.isnan(band).all():
        return None

    return float(np.nanmean(band))


# Main Function
def calculate_ward_averages(geotiff_path):
    """
    Safely calculate ward-level mean LST, NDVI, and Albedo
    from a multi-band GeoTIFF.
    """

    with engine.begin() as conn:  
        wards = conn.execute(text("""
            SELECT id, ward_number, ward_name_en,
                   ST_AsText(geometry) AS geom_wkt
            FROM bengaluru_wards
        """)).fetchall()

        with rasterio.open(geotiff_path) as src:
            nodata = src.nodata
            print("Raster nodata value:", nodata)
            print("Raster CRS:", src.crs)
            print("Raster shape:", src.shape)

            for ward in wards:
                try:
                    geom = gpd.GeoSeries.from_wkt(
                        [ward.geom_wkt],
                        crs="EPSG:4326"
                    ).geometry[0]

                    out_image, _ = mask(
                        src,
                        [geom],
                        crop=True,
                        filled=True
                    )

                    # Extract bands
                    lst_band = out_image[0]
                    ndvi_band = out_image[1]
                    albedo_band = out_image[2]

                    # Compute safe means
                    lst_avg = safe_band_mean(
                        lst_band,
                        nodata=nodata,
                        valid_range=(15, 65)   # Bengaluru surface temp
                    )

                    ndvi_avg = safe_band_mean(
                        ndvi_band,
                        nodata=nodata,
                        valid_range=(-1, 1)
                    )

                    albedo_avg = safe_band_mean(
                        albedo_band,
                        nodata=nodata,
                        valid_range=(0, 1)
                    )

                    if lst_avg is None:
                        print(f"Ward {ward.ward_number}: No valid pixels")
                        continue

                    conn.execute(text("""
                        UPDATE bengaluru_wards
                        SET baseline_lst = :lst,
                            baseline_ndvi = :ndvi,
                            baseline_albedo = :albedo,
                            last_updated = NOW()
                        WHERE id = :ward_id
                    """), {
                        "lst": lst_avg,
                        "ndvi": ndvi_avg,
                        "albedo": albedo_avg,
                        "ward_id": ward.id
                    })

                    print(
                        f"Ward {ward.ward_number} ({ward.ward_name_en}): "
                        f"LST={lst_avg:.2f}°C | "
                        f"NDVI={ndvi_avg:.3f} | "
                        f"Albedo={albedo_avg:.3f}"
                    )

                except Exception as e:
                    print(
                        f"Failed for ward {ward.ward_number} "
                        f"({ward.ward_name_en}): {e}"
                    )

    print("Ward baselines updated.")

if __name__ == "__main__":
    geotiff_path = "public/data/blr_lst_ndvi_albedo.tif"
    calculate_ward_averages(geotiff_path)





 