# puertorico-mangrove-remote-sensing.
Mapping mangrove cover and quantifying mangrove loss in Puerto Rico using remote sensing. Assesses impacts of natural (hurricanes, earthquakes, drought) and human (urbanization) disturbances to support coastal management, restoration planning, and ecosystem service preservation.
---

# README.md

# Mapping Mangrove Cover and Loss in Puerto Rico

This repository contains reproducible examples and supporting materials from my research focused on mapping mangrove cover and quantifying mangrove loss in Puerto Rico, linked to natural and human disturbances.

The project integrates remote sensing and geospatial analysis to understand coastal ecosystem dynamics, with a focus on mangrove forests. The research supports conservation and management strategies by identifying areas of loss and their drivers.

## Data Sources

The analysis uses publicly available datasets accessed via Google Earth Engine (GEE):

* SRTM Elevation Data

  * Source: USGS SRTMGL1_003
  * High-resolution digital elevation data for analyzing mangrove distribution in relation to topography and flood risk.

* Landsat 8 Surface Reflectance Tier 1 Level 2

  * Source: LANDSAT/LC08/C02/T1_L2
  * Multi-temporal satellite imagery to map mangrove cover and detect changes over time.

## Methodology

1. Mangrove Mapping

   * Identify mangrove extent using satellite imagery and vegetation indices.
   * Refine coastal and tidal boundaries using elevation data.

2. Change Detection and Loss Assessment

   * Compare multi-temporal imagery to quantify mangrove loss.
   * Assess the impact of natural and human disturbances, including:

     * Hurricanes
     * Earthquakes
     * Drought
     * Urbanization

3. Spatial Analysis and Visualization

   * Conduct analyses using GEE, ArcGIS Pro, and R.
   * Generate maps and statistics to visualize mangrove distribution, loss spots, and possible links between disturbances and loss.

## Tools and Workflows

* Google Earth Engine (GEE): Efficient processing and analysis of large-scale satellite imagery.
* ArcGIS Pro: Spatial analysis, map refinement, and visualization.
* R: Statistical analysis, plotting, and reporting.

## Objectives

* Map the current extent of mangroves in Puerto Rico.
* Quantify mangrove loss over recent decades.
* Identify drivers of mangrove decline, including natural (hurricanes, earthquakes, drought) and human (urbanization) disturbances.
* Provide actionable insights for coastal management, restoration planning, and ecosystem service preservation.

## License

* Code: Licensed under the MIT License. See [LICENSE.md] for full license text.
* Thesis content and data: Licensed under Creative Commons Attribution 4.0 (CC BY 4.0). See [LICENSE.md] for full license text.

## Broader Impact

This research contributes to regional conservation and aligns with initiatives to enhance biodiversity monitoring and ecosystem resilience in hurricane-affected tropical forests. By linking mangrove loss to its drivers, the project supports informed decision-making for coastal protection and ecosystem service preservation.
