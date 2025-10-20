//-------------------------------------------//
//  LANDSAT-BASED MANGROVE ANALYSIS SCRIPT
//  10/20/2025
//  By: Mariela Garcia
//-------------------------------------------//

//-------------------------------------------//
//  1. Load Data
//-------------------------------------------//

// Elevation data (SRTM)
var SRTM = ee.Image("USGS/SRTMGL1_003");

// Landsat 8 Surface Reflectance Tier 1 Level 2
var L8 = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2");

//-------------------------------------------//
//  2. Center Map and Set View
//-------------------------------------------//

// Center to region of interest (make sure 'geometry' is defined)
// Map.centerObject(geometry, 9);
// Map.setOptions('satellite');

//-------------------------------------------//
//  3. Helper Functions
//-------------------------------------------//

// Apply scale factors to reflectance bands
function applyScaleFactors(image) {
  var opticalBands = image.select('SR_B.*').multiply(0.0000275).add(-0.2);
  return image.addBands(opticalBands, null, true);
}

// Cloud and shadow masking
function maskL8sr(image) {
  var cloudShadowBitMask = 1 << 3;
  var cloudsBitMask = 1 << 5;
  var qa = image.select('QA_PIXEL');
  var mask = qa.bitwiseAnd(cloudShadowBitMask).eq(0)
                .and(qa.bitwiseAnd(cloudsBitMask).eq(0));
  return image.updateMask(mask)
              .select("SR_B[0-9]*")
              .copyProperties(image, ["system:time_start"]);
}

// Add vegetation and water indices
var addIndicesL8 = function(img) {
  var ndvi = img.normalizedDifference(['SR_B5','SR_B4']).rename('NDVI');
  var ndmi = img.normalizedDifference(['SR_B7','SR_B3']).rename('NDMI');
  var mndwi = img.normalizedDifference(['SR_B3','SR_B6']).rename('MNDWI');
  var sr = img.select('SR_B5').divide(img.select('SR_B4')).rename('SR');
  var ratio54 = img.select('SR_B6').divide(img.select('SR_B5')).rename('R54');
  var ratio35 = img.select('SR_B4').divide(img.select('SR_B6')).rename('R35');
  var gcvi = img.expression('(NIR/GREEN)-1', {
    'NIR': img.select('SR_B5'),
    'GREEN': img.select('SR_B3')
  }).rename('GCVI');

  return img.addBands([ndvi, ndmi, mndwi, sr, ratio54, ratio35, gcvi]);
};

//-------------------------------------------//
//  4. Define Time Ranges
//-------------------------------------------//

var startDate2015 = '2014-01-01';
var endDate2015 = '2016-12-31';

var startDate2023 = '2021-01-01';
var endDate2023 = '2023-12-31';

//-------------------------------------------//
//  5. Filter, Preprocess and Add Indices
//-------------------------------------------//

var l8_2015 = L8.filterDate(startDate2015, endDate2015)
  .map(applyScaleFactors)
  .map(maskL8sr)
  .map(addIndicesL8);

var l8_2023 = L8.filterDate(startDate2023, endDate2023)
  .map(applyScaleFactors)
  .map(maskL8sr)
  .map(addIndicesL8);

//-------------------------------------------//
//  6. Create Median Composites
//-------------------------------------------//

var composite2015 = l8_2015.median().clip(geometry);
var composite2023 = l8_2023.median().clip(geometry);

//-------------------------------------------//
//  7. Elevation Masking (< 65m)
//-------------------------------------------//

var srtmClip = SRTM.clip(geometry);
var elevationMask = srtmClip.lt(65);
Map.addLayer(elevationMask, {}, 'Elevation Mask', false);

// Apply elevation mask
var composite2015Masked = composite2015.updateMask(elevationMask);
var composite2023Masked = composite2023.updateMask(elevationMask);

//-------------------------------------------//
//  8. Visualize Bands and Indices
//-------------------------------------------//

// Visualization parameters
var visParams = {min: 0, max: 0.3};
var visGreen = {min: 0, max: 0.3, palette: ['white', 'lime']};
var visSWIR2 = {min: 0, max: 0.3, palette: ['white', 'navy']};
var visSR = {min: 0, max: 3, palette: ['white', 'green']};
var visR54 = {min: 0, max: 3, palette: ['white', 'purple']};
var visR35 = {min: 0, max: 3, palette: ['white', 'orange']};

// // Add selected bands for 2015 and 2023
// Map.addLayer(composite2015.select('SR_B5'), visParams, 'NIR 2015');
// Map.addLayer(composite2023.select('SR_B5'), visParams, 'NIR 2023');
// Map.addLayer(composite2015.select('SR_B3'), visGreen, 'Green 2015');
// Map.addLayer(composite2023.select('SR_B3'), visGreen, 'Green 2023');
// Map.addLayer(composite2015.select('SR_B7'), visSWIR2, 'SWIR2 2015');
// Map.addLayer(composite2023.select('SR_B7'), visSWIR2, 'SWIR2 2023');

// // Vegetation and water indices
// Map.addLayer(composite2015.select('NDVI'), {min: -1, max: 1, palette: ['blue', 'white', 'green']}, 'NDVI 2015');
// Map.addLayer(composite2023.select('NDVI'), {min: -1, max: 1, palette: ['blue', 'white', 'green']}, 'NDVI 2023');

// Map.addLayer(composite2015.select('NDMI'), {min: -1, max: 1, palette: ['blue', 'white', 'brown']}, 'NDMI 2015');
// Map.addLayer(composite2023.select('NDMI'), {min: -1, max: 1, palette: ['blue', 'white', 'brown']}, 'NDMI 2023');

// Map.addLayer(composite2015.select('MNDWI'), {min: -1, max: 1, palette: ['black', 'blue', 'cyan']}, 'MNDWI 2015');
// Map.addLayer(composite2023.select('MNDWI'), {min: -1, max: 1, palette: ['black', 'blue', 'cyan']}, 'MNDWI 2023');

// Map.addLayer(composite2015.select('GCVI'), {min: -1, max: 3, palette: ['white', 'darkgreen']}, 'GCVI 2015');
// Map.addLayer(composite2023.select('GCVI'), {min: -1, max: 3, palette: ['white', 'darkgreen']}, 'GCVI 2023');

// // Other indices
// Map.addLayer(composite2015.select('SR'), visSR, 'SR 2015');
// Map.addLayer(composite2015.select('R54'), visR54, 'R54 2015');
// Map.addLayer(composite2015.select('R35'), visR35, 'R35 2015');

//-------------------------------------------//
//  9. Visualize Final Composite (RGB)
//-------------------------------------------//

var visRGB = {bands: ['SR_B5', 'SR_B6', 'SR_B4'], min: 0, max: 0.35};
Map.addLayer(composite2015Masked, visRGB, 'Landsat Composite 2015');
Map.addLayer(composite2023Masked, visRGB, 'Landsat Composite 2023');

//-------------------------------------------//
//  10. Export Median Composites
//-------------------------------------------//

Export.image.toAsset({
  image: composite2015Masked,
  description: 'Landsat_Composite_2015',
  assetId: 'Composite_2015',
  region: geometry,
  scale: 30
});

Export.image.toAsset({
  image: composite2023Masked,
  description: 'Landsat_Composite_2023',
  assetId: 'Composite_2023',
  region: geometry,
  scale: 30
});

//-------------------------------------------//
//  11. Create Quality Mosaic (Highest NDVI)
//-------------------------------------------//

var collection2015 = ee.ImageCollection([composite2015Masked]);
var collection2023 = ee.ImageCollection([composite2023Masked]);

var composite2015Mosaic = collection2015.qualityMosaic('NDVI');
var composite2023Mosaic = collection2023.qualityMosaic('NDVI');

Map.addLayer(composite2015Mosaic, visRGB, 'Quality Mosaic 2015');
Map.addLayer(composite2023Mosaic, visRGB, 'Quality Mosaic 2023');

//-------------------------------------------//
//  12. Export Quality Mosaics
//-------------------------------------------//

Export.image.toAsset({
  image: composite2015Mosaic,
  description: 'Landsat_QualityMosaic_2015',
  assetId: 'QMosaic_2015',
  region: geometry,
  scale: 30
});

Export.image.toAsset({
  image: composite2023Mosaic,
  description: 'Landsat_QualityMosaic_2023',
  assetId: 'QMosaic_2023',
  region: geometry,
  scale: 30
});
