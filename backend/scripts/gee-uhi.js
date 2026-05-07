// Bengaluru Boundary

var blr = ee.Geometry.Rectangle([77.4, 12.8, 77.8, 13.2]);
Map.centerObject(blr, 11);


// LANDSAT 8 - Land Surface Temperature (°C)

var lst = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
    .filterBounds(blr)
    .filterDate("2024-03-01", "2024-05-31")
    .filter(ee.Filter.lt("CLOUD_COVER", 20))
    .median()
    .select("ST_B10")
    .multiply(0.00341802)
    .add(149.0)
    .subtract(273.15)
    .rename("lst")
    .toFloat();

Map.addLayer(lst, { min: 25, max: 45, palette: ["blue", "yellow", "red"] }, "LST (°C)");


// SENTINEL-2 - NDVI

var s2 = ee.ImageCollection("COPERNICUS/S2_SR")
    .filterBounds(blr)
    .filterDate("2024-03-01", "2024-05-31")
    .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
    .median();

var ndvi = s2.normalizedDifference(["B8", "B4"])
    .rename("ndvi")
    .toFloat();

Map.addLayer(ndvi, { min: 0, max: 0.8, palette: ["brown", "yellow", "green"] }, "NDVI");


// MODIS - Surface Albedo

var albedo = ee.ImageCollection("MODIS/061/MCD43A3")
    .filterBounds(blr)
    .filterDate("2024-03-01", "2024-05-31")
    .select("Albedo_WSA_shortwave")
    .mean()
    .multiply(0.001)
    .rename("albedo")
    .toFloat();

// Resample albedo to 30m
albedo = albedo
    .resample("bilinear")
    .reproject({
        crs: lst.projection(),
        scale: 30
    });

Map.addLayer(albedo, { min: 0.05, max: 0.35, palette: ["black", "yellow", "white"] }, "Albedo");


// Combine Bands (float32)

var combined = lst
    .addBands(ndvi)
    .addBands(albedo)
    .clip(blr)
    .toFloat();

print("Combined image", combined);
print("Band types", combined.bandTypes());


// Export combined raster (GeoTIFF)

Export.image.toDrive({
    image: combined,
    description: "blr_lst_ndvi_albedo",
    folder: "UHI",
    scale: 30,
    region: blr,
    maxPixels: 1e9
});


// Sample points for ML dataset (csv)

var points = combined.sample({
    region: blr,
    scale: 30,
    numPixels: 50000,
    geometries: true
});

// Extract latitude & longitude explicitly
var pointsWithCoords = points.map(function (f) {
    var coords = f.geometry().coordinates();
    return f.set({
        lon: coords.get(0),
        lat: coords.get(1)
    }).select(["lat", "lon", "lst", "ndvi", "albedo"]);
});


// Export points with coordinates to CSV

Export.table.toDrive({
    collection: pointsWithCoords,
    description: "blr_uhi_ml_dataset",
    folder: "UHI",
    fileFormat: "CSV"
});