//-------------------------------------------//
//  LANDSAT-BASED MANGROVE ANALYSIS SCRIPT
//  10/20/2025
//  By: Mariela Garcia
//-------------------------------------------//
// ===== Load Image Collections and Composites =====
var L8 = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2");

var composite2015 = ee.Image('projects/ee-marivega910/assets/Composite2015_Landsat/Composite_2015v5');
var composite2023 = ee.Image('projects/ee-marivega910/assets/Composite2023_Landsat/Composite_2023v5');

var visParams = {bands: ['SR_B5', 'SR_B6', 'SR_B4'], min: 0, max: 0.35}; 

Map.addLayer(composite2015.clip(geometry), visParams, 'Landsat Composite 2015', false);
Map.addLayer(composite2023.clipToCollection(tiger), visParams, 'Landsat Composite 2023', false);

// ===== Set Base Map and Zoom =====
Map.centerObject(geometry, 9);
Map.setOptions('satellite');

// ===== Preprocessing Landsat 8 =====
function applyScaleFactors(image) {
  var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
  return image.addBands(opticalBands, null, true);
}

function maskL8sr(image) {
  var cloudShadowBitMask = 1 << 3;
  var cloudsBitMask = 1 << 5;
  var qa = image.select('QA_PIXEL');
  var mask = qa.bitwiseAnd(cloudShadowBitMask).eq(0).and(qa.bitwiseAnd(cloudsBitMask).eq(0));
  return image.updateMask(mask).select("SR_B[0-9]*").copyProperties(image, ["system:time_start"]);
}

var addIndicesL8 = function(img) {
  var ndvi = img.normalizedDifference(['SR_B5','SR_B4']).rename('NDVI');
  var ndmi = img.normalizedDifference(['SR_B7','SR_B3']).rename('NDMI');
  var mndwi = img.normalizedDifference(['SR_B3','SR_B6']).rename('MNDWI');
  var sr = img.select('SR_B5').divide(img.select('SR_B4')).rename('SR');
  var ratio54 = img.select('SR_B6').divide(img.select('SR_B5')).rename('R54');
  var ratio35 = img.select('SR_B4').divide(img.select('SR_B6')).rename('R35');
  var gcvi = img.expression('(NIR/GREEN)-1',{
    'NIR':img.select('SR_B5'),
    'GREEN':img.select('SR_B3')
  }).rename('GCVI');
  return img.addBands([ndvi, ndmi, mndwi, sr, ratio54, ratio35, gcvi]);
};

var l8 = L8
  .map(applyScaleFactors)
  .map(maskL8sr)
  .map(addIndicesL8)
  .filterBounds(geometry);

print(l8.first(),'Landsat 8 Processed Sample');

// ===== Load Landcover Maps =====
var areaOfstudy = ee.FeatureCollection(geometry);
var landcover2015 = ee.Image('projects/ee-marivega910/assets/Landcover2015_Landsat/Landcover_2015_Cleanupv5_03112025');
var landcover2023 = ee.Image('projects/ee-marivega910/assets/Landcover2023_Landsat/Landcover_2023_Cleanupv5_03112025');

Map.addLayer(areaOfstudy, {}, 'Area of Study Boundary', false);
Map.addLayer(landcover2015, {min:1, max:6, palette: ['#7fc97f','#beaed4','#fdc086','#ffff99','#386cb0','#f0027f']}, 'Landcover 2015', false);
Map.addLayer(landcover2023, {min:1, max:6, palette: ['#1a9850','#b2182b','#5ab4ac','#91cf60','#f6e8c3','#99d594']}, 'Landcover 2023', false);

// ===== Mangrove Change Detection =====
var mang2023 = landcover2023.eq(1);
var mang2015 = landcover2015.eq(1);
Map.addLayer(mang2023, {min:0, max:1}, 'Mangrove 2023 Mask', false);
Map.addLayer(mang2015, {min:0, max:1}, 'Mangrove 2015 Mask', false);

var mangJoin = mang2023.add(mang2015);
Map.addLayer(mangJoin, {}, 'Mangrove Sum (2015 + 2023)', false);

var mangJoinYear = mang2023.where(mang2023.eq(1), 2).add(mang2015);
Map.addLayer(mangJoinYear, {}, 'Mangrove Presence', false);

// -1: Loss | 0: No change | 1: Gain
var change = mang2023.subtract(mang2015).clipToCollection(tiger);
Map.addLayer(change, {min: -1, max: 1, palette: ['red', 'white', 'green']}, 'Mangrove Change 2015–2023', false);

// ===== Calculate Area of Gain & Loss =====
var gain = change.eq(1);
var loss = change.eq(-1);

var gainArea = gain.multiply(ee.Image.pixelArea().divide(1e6));
var lossArea = loss.multiply(ee.Image.pixelArea().divide(1e6));

var statsgain = gainArea.reduceRegion({
    reducer: ee.Reducer.sum(),
    scale: 30,
    maxPixels: 1e14
});

var statsloss = lossArea.reduceRegion({
    reducer: ee.Reducer.sum(),
    scale: 30,
    maxPixels: 1e14
});

print(statsgain.get('classification_mode'), 'Mangrove Gain (km²)');
print(statsloss.get('classification_mode'), 'Mangrove Loss (km²)');

Map.addLayer(gain.selfMask(), {palette: 'green'}, 'Mangrove Gain Mask', false);
Map.addLayer(loss.selfMask(), {palette: 'red'}, 'Mangrove Loss Mask', false);

// ===== NDVI Anomaly Analysis =====
var buffer = 1000;
var extentBuffer = landcover2015.focal_max(buffer, 'circle', 'meters');
Map.addLayer(landcover2015, {palette: '#000000'}, 'Mangrove Baseline 2015', false);
Map.addLayer(extentBuffer, {palette: '#0e49b5', opacity: 0.3}, 'Mangrove 1km Buffer', false);

var index = 'NDVI';
var ref_start = '2014-01-01';
var ref_end = '2016-12-31';

var reference = l8.filterDate(ref_start, ref_end).select(index);
print('Reference Image Count:', reference.size());
print(reference.first(), 'Reference Image Example');

var mean = reference.mean();
Map.addLayer(mean, {}, 'NDVI Mean (2014–2016)', false);

var period_start = '2021-01-01';
var period_end = '2023-12-31';

var anomalyfunction = function(image) {
    return image.subtract(mean).set('system:time_start', image.get('system:time_start'));
};

var series = l8.filterDate(period_start, period_end).map(anomalyfunction);
Map.addLayer(l8.select(index), {}, 'Landsat 8 NDVI Stack', false);

var seriesSum = series.select(index).sum();
var numImages = series.select(index).count();
var anomaly = seriesSum.divide(numImages);

var visAnon = {min: -0.20, max: 0.20, palette: ['red', 'black', 'green']};
Map.addLayer(anomaly, visAnon, 'NDVI Anomaly (2021–2023)', false);

Export.image.toAsset({
  image: anomaly,
  description: 'Anomaly',
  assetId: 'Anomaly',
  region: geometry,
  scale: 30
});

// Mangrove-specific anomaly layers
var mangAnomaly = anomaly.updateMask(mangJoinYear);
Map.addLayer(mangAnomaly, visAnon, 'NDVI Anomaly - Mangrove Area', false);
Map.addLayer(mangAnomaly.updateMask(mangJoinYear.gte(2)), visAnon, 'NDVI Anomaly - Mangroves Present in 2023', false);

// Gain/Loss from NDVI Thresholds
var lossfromndvi = anomaly.lte(-0.2).selfMask().updateMask(landcover2015);
Map.addLayer(lossfromndvi, {palette: ['orange']}, 'NDVI-Based Loss', false);

var gainfromndvi = anomaly.gte(0.20).selfMask().updateMask(extentBuffer);
Map.addLayer(gainfromndvi, {palette: ['blue']}, 'NDVI-Based Gain', false);

// Stable mangroves with no significant NDVI change
var stableMangroveMask = landcover2015.eq(1).and(anomaly.lte(0.2).and(anomaly.gte(-0.2))).and(landcover2023.eq(1));
Map.addLayer(anomaly.lte(0.2).and(anomaly.gte(-0.2)), {}, 'NDVI Stable Zones', false);

var stableMangrove = ee.Image(0).where(stableMangroveMask.eq(1), 7);
Map.addLayer(stableMangrove.clipToCollection(tiger), {min: 0, max: 7, palette: ['orange', 'green']}, 'Stable Mangrove Mask', false);

var stableMangrove2 = landcover2015.eq(1).add(anomaly.lte(0.2).and(anomaly.gte(-0.2))).add(landcover2023.eq(1));
Map.addLayer(stableMangrove2.clipToCollection(tiger), {min: 0, max: 3, palette: ['black', 'green', 'yellow', 'red']}, 'Stable Mangrove - Multi-Class', false);
