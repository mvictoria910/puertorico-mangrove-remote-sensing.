/-------------------------------------------//
//  LANDSAT-BASED MANGROVE ANALYSIS SCRIPT
//  10/20/2025
//  By: Mariela Garcia
//-------------------------------------------//
// ---------------------------------------------
// LOAD LANDSAT DATA & PRE-PROCESSED COMPOSITES
// ---------------------------------------------
var L8 = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2");



// Load 2015 Landsat composite from assets
var compositeNew = ee.Image('projects/ee-marivega910/assets/Composite2015_Landsat/Composite_2015v5');

// Visualization parameters for false color (SWIR1, SWIR2, Red)
var visParams = {bands: ['SR_B5', 'SR_B6', 'SR_B4'], min: 0, max: 0.35}; 

// Display 2015 composite clipped to study area
Map.addLayer(compositeNew.clip(geometry), visParams, 'Landsat Composite 2015', false);

// Load 2023 Landsat composite from assets
var L8v2compositeNew = ee.Image('projects/ee-marivega910/assets/Composite2023_Landsat/Composite_2023v5');

// Display 2023 composite clipped to municipalities
Map.addLayer(L8v2compositeNew.clipToCollection(tiger), visParams, 'Landsat Composite 2023', false);

// Optional: Center map on region of interest
// Map.centerObject(geometry,9)

// Set base map to satellite view
Map.setOptions('satellite');

// ---------------------------------------------
// FUNCTION: Apply reflectance scaling factors
// ---------------------------------------------
function applyScaleFactors(image) {
  var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
  return image.addBands(opticalBands, null, true);
}

// ---------------------------------------------
// FUNCTION: Cloud & shadow masking (QA_PIXEL bits 3 and 5)
// ---------------------------------------------
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

// ---------------------------------------------
// FUNCTION: Add mangrove-relevant spectral indices
// ---------------------------------------------
var addIndicesL8 = function(img) {
  var ndvi = img.normalizedDifference(['SR_B5','SR_B4']).rename('NDVI');
  var ndmi = img.normalizedDifference(['SR_B7','SR_B3']).rename('NDMI');
  var mndwi = img.normalizedDifference(['SR_B3','SR_B6']).rename('MNDWI');
  var sr = img.select('SR_B5').divide(img.select('SR_B4')).rename('SR');
  var ratio54 = img.select('SR_B6').divide(img.select('SR_B5')).rename('R54');
  var ratio35 = img.select('SR_B4').divide(img.select('SR_B6')).rename('R35');
  var gcvi = img.expression('(NIR/GREEN)-1',{
    'NIR': img.select('SR_B5'),
    'GREEN': img.select('SR_B3')
  }).rename('GCVI');
  return img
    .addBands(ndvi)
    .addBands(ndmi)
    .addBands(mndwi)
    .addBands(sr)
    .addBands(ratio54)
    .addBands(ratio35)
    .addBands(gcvi);
};

// ---------------------------------------------
// PROCESS LANDSAT 8 IMAGE COLLECTION
// ---------------------------------------------
var l8 = L8
    .map(applyScaleFactors)         // Apply scale factors
    .map(maskL8sr)                  // Mask clouds and shadows
    .map(addIndicesL8)              // Add spectral indices
    .filterBounds(geometry);        // Filter by region of interest

print(l8.first(),'l8 check');

// Add NDVI time series layer (disabled by default)
Map.addLayer(l8.select('NDVI'), {}, "Landsat NDVI TimeSEries", false);

// ---------------------------------------------
// LOAD CLASSIFIED LOSS IMAGE & MASK
// ---------------------------------------------
var mangroveLoss = ee.Image('projects/ee-marivega910/assets/Anomaly_Landsat/MangroveLossv3_03072025').gte(1);
var allMangrove = ee.Image('projects/ee-marivega910/assets/CCDC_Landsat/AllMangrove2023v3_03132025');

// ---------------------------------------------
// RUN CCDC TEMPORAL SEGMENTATION ON NDVI TIME SERIES 0.95
// ---------------------------------------------
var timeBreak = ee.Algorithms.TemporalSegmentation.Ccdc({
  collection: l8.select('NDVI'),
  minObservations: 3,
  chiSquareProbability: 0.95,
  minNumOfYearsScaler: 1.33,
  dateFormat: 1
});

Map.addLayer(timeBreak, {}, 'TimeBreak', false);

// Pad break and magnitude arrays to ensure consistent dimensions
var timeBreakPad = timeBreak.select('tBreak').arrayPad([5]);
var timeBreakMag = timeBreak.select('NDVI_magnitude').arrayPad([5]);

// ---------------------------------------------
// EXTRACT MAXIMUM NDVI LOSS CHANGE FROM TIME SERIES
// ---------------------------------------------
var LossTimeBreak1 = timeBreakPad.arrayGet([0])
    .addBands(timeBreakMag.arrayGet([0]).multiply(-1)).set('break', 1);
var LossTimeBreak2 = timeBreakPad.arrayGet([1])
    .addBands(timeBreakMag.arrayGet([1]).multiply(-1)).set('break', 2);
var LossTimeBreak3 = timeBreakPad.arrayGet([2])
    .addBands(timeBreakMag.arrayGet([2]).multiply(-1)).set('break', 3);
var LossTimeBreak4 = timeBreakPad.arrayGet([3])
    .addBands(timeBreakMag.arrayGet([3]).multiply(-1)).set('break', 4);
// Combine and select maximum NDVI loss magnitude and its corresponding break date
var maxImageLoss = ee.ImageCollection([
    LossTimeBreak1, LossTimeBreak2, LossTimeBreak3, LossTimeBreak4])
    .qualityMosaic('NDVI_magnitude')  // Select max magnitude
    .clipToCollection(tiger)
    .updateMask(allMangrove);        // Mask to mangrove loss pixels only

// Add time of break and NDVI magnitude loss to the map (disabled by default)
Map.addLayer(
  maxImageLoss.select('tBreak'),
  {min:2010, max:2020, palette:['#ffffd9','#edf8b1','#c7e9b4','#7fcdbb','#41b6c4','#1d91c0','#225ea8','#253494','#081d58']},
  'Year of Max tBreak - Loss/Degraded', false
);

Map.addLayer(
  maxImageLoss.select('NDVI_magnitude'),
  {min:0, max:0.5, palette:['green','yellow','red']},
  'Max NDVI Magnitude - Loss', false
);

// ---------------------------------------------
// EXPORT RESULTS TO ASSET & DRIVE
// ---------------------------------------------

// Export full composite (break + magnitude) to asset
Export.image.toAsset({
  image: maxImageLoss,
  description: 'maxImageLoss',
  assetId: 'maxImageLoss',
  region: geometry,
  scale: 30
});

// Export tBreak layer only to asset
Export.image.toAsset({
  image: maxImageLoss.select('tBreak'),
  description: 'Time Break',
  assetId: 'TimeBreak',
  region: geometry,
  scale: 30
});

// Export tBreak to Google Drive
Export.image.toDrive({
  image: maxImageLoss.select('tBreak'),
  description: 'TimeBreak',
  folder: 'EarthEngine_Exports',
  fileNamePrefix: 'TimeBreak',
  region: geometry,
  scale: 30,
  maxPixels: 1e13
});

// Convert tBreak band to integer for simplified export (e.g. for use in QGIS)
var maxImageLossIntTBreak = maxImageLoss.select(['tBreak']).toInt();

Export.image.toDrive({
  image: maxImageLossIntTBreak,
  description: 'MaxImageLoss_Int_Export',
  scale: 30,
  region: geometry,
  fileFormat: 'GeoTIFF',
  maxPixels: 1e8
});

// Export NDVI magnitude to asset
Export.image.toAsset({
  image: maxImageLoss.select('NDVI_magnitude'),
  description: 'NDVIMagnitude',
  assetId: 'NDVIMagnitude',
  region: geometry,
  scale: 30
});
