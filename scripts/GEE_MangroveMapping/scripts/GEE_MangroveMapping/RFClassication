//-------------------------------------------//
//  LANDSAT-BASED MANGROVE ANALYSIS SCRIPT
//  10/20/2025
//  By: Mariela Garcia
//-------------------------------------------//
// Load composite image and visualize with specific bands and parameters
var compositeNew = ee.Image('projects/ee-marivega910/assets/Composite2015_Landsat/Composite_2015v5');
var visParams = {bands: ['SR_B5', 'SR_B6', 'SR_B4'], min: 0, max: 0.35};

Map.centerObject(geometry, 9);
Map.setOptions('satellite');
Map.addLayer(compositeNew.clip(geometry), visParams, 'Composite 2015');

// Merge training polygons from different classes
var classes = TrainingClasses.merge(Mangrove).merge(built).merge(bare);

// Select bands used for classification and clip to geometry
var bands = ['SR_B2','SR_B3','SR_B5','SR_B6','SR_B4','NDVI','MNDWI','SR','GCVI'];
var compositeImage = compositeNew.select(bands).clip(geometry);

// Add training polygons to the map
Map.addLayer(classes, {}, 'Training Classes');

// Sample training points from composite image using training polygons
var samples = compositeImage.sampleRegions({
  collection: classes,
  properties: ['landcover'],
  scale: 30,
  tileScale: 2
}).randomColumn('random');

// Split samples into training (80%) and testing (20%) sets
var split = 0.8;
var training = samples.filter(ee.Filter.lt('random', split));
var testing = samples.filter(ee.Filter.gte('random', split));

print('Samples n =', samples.aggregate_count('.all'));
print('Training n =', training.aggregate_count('.all'));
print('Testing n =', testing.aggregate_count('.all'));

// Train a Random Forest classifier with 20 trees and max depth 5
var classifier = ee.Classifier.smileRandomForest(20, 5).train({
  features: training,
  classProperty: 'landcover',
  inputProperties: bands
});

// Classify the composite image with the trained classifier
var classifiedrf = compositeImage.classify(classifier);

// Add classified result to the map with a specified color palette
Map.addLayer(classifiedrf, {
  palette: ['green', 'red', 'blue','brown','yellow','orange'],
  min: 1, max: 6
}, 'Classification Result');

// Train a Random Forest classifier to output class probabilities (100 trees)
var trainedClassifierProb = ee.Classifier.smileRandomForest(100)
  .setOutputMode('MULTIPROBABILITY')
  .train({
    features: training,
    classProperty: 'landcover',
    inputProperties: bands
});

// Classify composite image to get probability layers per class
var probImage = compositeImage.classify(trainedClassifierProb);
var probImageMangrove = ee.Image(probImage.arrayGet([0])).rename('probMangrove');
var probImageBuilt = ee.Image(probImage.arrayGet([1])).rename('probBuilt');

// Add probability layers for visualization
Map.addLayer(probImage, {min: 0, max: 1}, 'All Class Probabilities');
Map.addLayer(probImageMangrove, {min: 0, max: 1}, 'Mangrove Probability');
Map.addLayer(probImageBuilt, {min: 0, max: 1}, 'Built Probability');

// Create quality mosaic based on max probability across classes
var probAll2015 = ee.ImageCollection([
  classifiedrf.addBands(probImageMangrove.rename('prob')),
  classifiedrf.addBands(probImageBuilt.rename('prob')),
  classifiedrf.addBands(ee.Image(probImage.arrayGet([2])).rename('prob')), // water
  classifiedrf.addBands(ee.Image(probImage.arrayGet([3])).rename('prob')), // forest
  classifiedrf.addBands(ee.Image(probImage.arrayGet([4])).rename('prob')), // bare
  classifiedrf.addBands(ee.Image(probImage.arrayGet([5])).rename('prob'))  // vegetation
]);

var probAll2015_QM = probAll2015.qualityMosaic('prob');
Map.addLayer(probAll2015_QM, {}, 'Quality Mosaic by Probability');

// Export quality mosaic image to asset
Export.image.toAsset({
  image: probAll2015_QM,
  description: 'Landcover_QM_2015',
  assetId: 'Landcover_QM_2015',
  region: geometry,
  scale: 30
});

// Calculate polygon area in square meters and add as property 'area'
var CombinedClassesWithArea = classes.map(function(feature) {
  var areaSqm = feature.geometry().area({maxError: 1});
  return feature.set('area', areaSqm);
});

// Sum areas by landcover class in square meters
var areaByClass = CombinedClassesWithArea.reduceColumns({
  selectors: ['landcover', 'area'],
  reducer: ee.Reducer.sum().group({
    groupField: 0,
    groupName: 'landcover'
  })
});
print('Total area by class (sq. meters):', areaByClass);

// Add area in hectares as property 'area_ha'
CombinedClassesWithArea = classes.map(function(feature) {
  var areaSqM = feature.geometry().area({maxError: 1});
  var areaHa = areaSqM.divide(10000);
  return feature.set('area_ha', areaHa);
});

// Sum area in hectares by class
areaByClass = CombinedClassesWithArea.reduceColumns({
  selectors: ['landcover', 'area_ha'],
  reducer: ee.Reducer.sum().group({
    groupField: 0,
    groupName: 'landcover'
  })
});
print('Total area by class (hectares):', areaByClass);

// Calculate total mangrove area in hectares from classified raster (class 1 = mangrove)
var mangroveClass = classifiedrf.eq(1);
var mangroveArea = mangroveClass.multiply(ee.Image.pixelArea()).divide(10000);
var mangroveAreaHectares = mangroveArea.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: geometry,
  scale: 30,
  maxPixels: 1e8,
});
print('Total mangrove area in hectares:', mangroveAreaHectares);

// Generate stratified random validation points for accuracy assessment
var randomPoints = classifiedrf.stratifiedSample({
  numPoints: 10,
  classBand: 'classification',
  region: geometry,
  scale: 30,
  seed: 1,
  geometries: true
});
Map.addLayer(randomPoints, {}, 'Random Validation Points');
print('Validation Points', randomPoints);
Export.table.toDrive(randomPoints);

// Sample spectral data by class for spectral signature analysis
var spectralPlots = compositeImage.select(bands).sampleRegions({
  collection: classes,
  properties: ['landcover'],
  scale: 30,
  geometries: true
});
Export.table.toDrive(spectralPlots);

var coreBands = bands;

// Compute mean reflectance for each band and class
function getMeanReflectanceByClass(image, classCollection, bands) {
  var reduced = image.select(bands).reduceRegions({
    collection: classCollection,
    reducer: ee.Reducer.mean(),
    scale: 30
  });

  return ee.FeatureCollection(reduced)
    .reduceColumns({
      reducer: ee.Reducer.mean().repeat(bands.length),
      selectors: bands
    })
    .get('mean');
}

// Get unique landcover classes sorted
var uniqueClasses = classes.aggregate_array('landcover').distinct().sort();

// Create feature collection of mean reflectances per class
var meanReflectanceByClass = ee.FeatureCollection(uniqueClasses.map(function(classValue) {
  var classSubset = classes.filter(ee.Filter.eq('landcover', classValue));
  var meanRef = getMeanReflectanceByClass(compositeImage, classSubset, coreBands);
  return ee.Feature(null, ee.Dictionary.fromLists(coreBands, ee.List(meanRef)))
    .set('landcover', classValue);
}));

// Plot spectral signatures as line chart
var spectralChart = ui.Chart.feature.byFeature(meanReflectanceByClass, 'landcover', coreBands)
  .setChartType('LineChart')
  .setOptions({
    title: 'Spectral Signature per Class',
    hAxis: {
      title: 'Bands',
      ticks: coreBands.map(function(band, i) {
        return {v: i + 1, f: band};
      })
    },
    vAxis: {title: 'Reflectance'},
    lineWidth: 2,
    pointSize: 4
  });

print(spectralChart);
