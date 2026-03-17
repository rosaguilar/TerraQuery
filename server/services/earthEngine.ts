import ee from '@google/earthengine';
import { datasetConfig } from './datasetConfig.js';

let isInitialized = false;

export function getEEInitialized(): boolean {
  return isInitialized;
}

export function initEarthEngine(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isInitialized) {
      resolve();
      return;
    }

    const serviceAccountStr = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!serviceAccountStr) {
      console.warn("WARNING: GOOGLE_APPLICATION_CREDENTIALS_JSON is not set.");
      reject(new Error("Missing credentials"));
      return;
    }

    try {
      const credentials = JSON.parse(serviceAccountStr);
      ee.data.authenticateViaPrivateKey(
        credentials,
        () => {
          ee.initialize(
            null,
            null,
            () => {
              isInitialized = true;
              resolve();
            },
            (err: any) => reject(new Error(`Earth Engine initialization failed: ${err}`))
          );
        },
        (err: any) => reject(new Error(`Earth Engine authentication failed: ${err}`))
      );
    } catch (parseError) {
      reject(new Error("Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON."));
    }
  });
}

// ─── Landcover module: getDynamicMapLayer ────────────────────────────────────

export async function getDynamicMapLayer(
  lat: number,
  lon: number,
  type: string,
  zoom: number,
  dataset: string = 'modis',
  bbox: number[] | null = null
) {
  if (!isInitialized) {
    throw new Error('Earth Engine is not initialized.');
  }

  return new Promise(async (resolve, reject) => {
    try {
      const point = ee.Geometry.Point([lon, lat]);

      let roi: any;
      if (bbox && Array.isArray(bbox) && bbox.length === 4) {
        roi = ee.Geometry.Rectangle(bbox);
      } else {
        const admin1 = ee.FeatureCollection('WM/geoLab/geoBoundaries/600/ADM1')
          .filterBounds(point);
        const admin2 = ee.FeatureCollection('WM/geoLab/geoBoundaries/600/ADM2')
          .filterBounds(point);
        const fallbackGeom = point.buffer(5000);
        const adm2Feature = admin2.first();
        const adm2Area = ee.Feature(adm2Feature).geometry().area();
        const useAdm2 = admin2.size().gt(0).and(adm2Area.gt(1e8));

        roi = ee.Feature(ee.Algorithms.If(
          useAdm2,
          adm2Feature,
          ee.Algorithms.If(
            admin1.size().gt(0),
            admin1.first(),
            ee.Feature(fallbackGeom)
          )
        )).geometry();
      }

      let image: any;
      let visParams: any = {};
      let fetchStats: any = null;
      let gifCollection: any = null;
      let gifVisParams: any = null;
      let selectedDatasetConfig: any = null;

      if (type === 'landcover_change') {
        const useCorine = dataset === 'corine';

        if (useCorine) {
          const corineConfig = datasetConfig.corine;
          const classNames = corineConfig.classNames;
          const palette = corineConfig.palette;
          const nativeValues = corineConfig.nativeValues;
          const remapTo = corineConfig.remapValues!;
          const N = classNames.length;
          const corineYears = [1990, 2000, 2006, 2012, 2018];
          const startYear = corineYears[0];
          const endYear = corineYears[corineYears.length - 1];

          const corineAll = ee.ImageCollection('COPERNICUS/CORINE/V20/100m')
            .filterBounds(roi)
            .select('landcover')
            .sort('system:time_start', true);

          const imgStart = corineAll.first()
            .remap(nativeValues, remapTo).clip(roi);
          const imgEnd = corineAll.sort('system:time_start', false).first()
            .remap(nativeValues, remapTo).clip(roi);

          image = imgEnd;
          visParams = { min: 0, max: N - 1, palette: palette };

          selectedDatasetConfig = {
            classNames, palette, scale: 100,
            startYear: String(startYear), endYear: String(endYear),
            gifLabels: corineYears, fps: 0.8
          };

          gifCollection = corineAll.map(function (img: any) {
            var remapped = img.remap(nativeValues, remapTo);
            return remapped.visualize({ min: 0, max: N - 1, palette: palette })
              .copyProperties(img, ['system:time_start']);
          });

          gifVisParams = {
            dimensions: 1024, region: roi.bounds(),
            framesPerSecond: 0.8, crs: 'EPSG:3857'
          };

          const areaStartC = ee.Image.pixelArea().addBands(imgStart);
          const areaEndC = ee.Image.pixelArea().addBands(imgEnd);
          const combinedC = imgStart.multiply(1000).add(imgEnd);
          const areaTransC = ee.Image.pixelArea().addBands(combinedC);

          const statsStartC = areaStartC.reduceRegion({
            reducer: ee.Reducer.sum().group({ groupField: 1, groupName: 'label' }),
            geometry: roi, scale: 100, maxPixels: 1e9
          });
          const statsEndC = areaEndC.reduceRegion({
            reducer: ee.Reducer.sum().group({ groupField: 1, groupName: 'label' }),
            geometry: roi, scale: 100, maxPixels: 1e9
          });
          const transitionsC = areaTransC.reduceRegion({
            reducer: ee.Reducer.sum().group({ groupField: 1, groupName: 'label' }),
            geometry: roi, scale: 100, maxPixels: 1e9
          });

          fetchStats = ee.Dictionary({
            yStart: statsStartC.get('groups'),
            yEnd: statsEndC.get('groups'),
            transitions: transitionsC.get('groups')
          });
        } else {
          const modisConfig = datasetConfig.modis;
          const classNames = modisConfig.classNames;
          const palette = modisConfig.palette;
          const N = classNames.length;
          const modisYears = modisConfig.gifYears;
          const startYear = modisYears[0];
          const endYear = modisYears[modisYears.length - 1];

          const modisAll = ee.ImageCollection('MODIS/061/MCD12Q1')
            .filterBounds(roi)
            .select('LC_Type1')
            .sort('system:time_start', true);

          const imgStart = modisAll.first().clip(roi);
          const imgEnd = modisAll.sort('system:time_start', false).first().clip(roi);

          image = imgEnd;
          visParams = { min: 0, max: N - 1, palette: palette };

          selectedDatasetConfig = {
            classNames, palette, scale: 500,
            startYear: String(startYear), endYear: String(endYear),
            gifLabels: modisYears, fps: 3
          };

          gifCollection = modisAll.map(function (img: any) {
            return img.visualize({ min: 0, max: N - 1, palette: palette })
              .copyProperties(img, ['system:time_start']);
          });

          gifVisParams = {
            dimensions: 1024, region: roi.bounds(),
            framesPerSecond: 3, crs: 'EPSG:3857'
          };

          const areaStartM = ee.Image.pixelArea().addBands(imgStart);
          const areaEndM = ee.Image.pixelArea().addBands(imgEnd);
          const combinedM = imgStart.multiply(1000).add(imgEnd);
          const areaTransM = ee.Image.pixelArea().addBands(combinedM);

          const statsStartM = areaStartM.reduceRegion({
            reducer: ee.Reducer.sum().group({ groupField: 1, groupName: 'label' }),
            geometry: roi, scale: 500, maxPixels: 1e9
          });
          const statsEndM = areaEndM.reduceRegion({
            reducer: ee.Reducer.sum().group({ groupField: 1, groupName: 'label' }),
            geometry: roi, scale: 500, maxPixels: 1e9
          });
          const transitionsM = areaTransM.reduceRegion({
            reducer: ee.Reducer.sum().group({ groupField: 1, groupName: 'label' }),
            geometry: roi, scale: 500, maxPixels: 1e9
          });

          fetchStats = ee.Dictionary({
            yStart: statsStartM.get('groups'),
            yEnd: statsEndM.get('groups'),
            transitions: transitionsM.get('groups')
          });
        }
      } else if (type === 'ndvi') {
        const collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
          .filterBounds(roi)
          .filterDate('2023-01-01', '2023-12-31')
          .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));
        const median = collection.median();
        image = median.normalizedDifference(['B8', 'B4']).rename('NDVI').clip(roi);
        visParams = { min: 0, max: 1, palette: ['red', 'yellow', 'green', 'darkgreen'] };
      } else if (type === 'elevation') {
        image = ee.Image('USGS/SRTMGL1_003').clip(roi);
        visParams = { min: 0, max: 3000, palette: ['blue', 'green', 'yellow', 'red', 'white'] };
      } else if (type === 'water') {
        image = ee.Image('JRC/GSW1_4/GlobalSurfaceWater').select('occurrence').clip(roi);
        visParams = { min: 0, max: 100, palette: ['white', 'lightblue', 'blue', 'darkblue'] };
      } else {
        const collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
          .filterBounds(roi)
          .filterDate('2023-01-01', '2023-12-31')
          .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));
        image = collection.median().clip(roi);
        visParams = { bands: ['B4', 'B3', 'B2'], min: 0, max: 3000 };
      }

      const withTimeout = (promise: Promise<any>, ms: number, label: string) => {
        return Promise.race([
          promise,
          new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} timed out after ${ms / 1000}s`)), ms))
        ]);
      };

      const getMapPromise = (img: any, vis: any) => new Promise((res, rej) => {
        console.log("EE: Requesting map tiles...");
        img.getMap(vis, (mapConfig: any, err: any) => {
          if (err) rej(new Error("Map generate failed: " + err));
          else { console.log("EE: Map tiles ready."); res(mapConfig); }
        });
      });

      const getGifPromise = (collection: any, vis: any) => new Promise((res, rej) => {
        console.log("EE: Requesting GIF generation...");
        collection.getVideoThumbURL(vis, (url: any, err: any) => {
          if (err) rej(new Error("GIF generate failed: " + err));
          else { console.log("EE: GIF ready."); res(url); }
        });
      });

      const getBoundsPromise = (geom: any) => new Promise((res, rej) => {
        console.log("EE: Requesting ROI bounds...");
        geom.bounds().coordinates().evaluate((val: any, err: any) => {
          if (err) rej(err);
          else { console.log("EE: ROI bounds ready."); res(val); }
        });
      });

      (async () => {
        try {
          const getStatsPromise = fetchStats ? new Promise((res) => {
            console.log("EE: Requesting stats...");
            fetchStats.evaluate((statsData: any, statErr: any) => {
              if (statErr) {
                console.error("Stats evaluation error:", statErr);
                res(null);
              } else {
                console.log("EE: Stats ready.");
                res(statsData);
              }
            });
          }) : Promise.resolve(null);

          const EE_TIMEOUT = 120000;
          const GIF_TIMEOUT = 90000;

          const [mapConfig, rawBounds, gifUrl, statsData] = await Promise.all([
            withTimeout(getMapPromise(image, visParams), EE_TIMEOUT, 'Map tiles').catch(e => { throw e; }),
            withTimeout(getBoundsPromise(roi), EE_TIMEOUT, 'ROI bounds').catch(e => { console.warn("Failed to generate ROI bounds:", e.message); return null; }),
            gifCollection ? withTimeout(getGifPromise(gifCollection, gifVisParams), GIF_TIMEOUT, 'GIF generation').catch(e => { console.warn("GIF skipped:", e.message); return null; }) : Promise.resolve(null),
            withTimeout(getStatsPromise, EE_TIMEOUT, 'Stats').catch(e => { console.warn("Stats skipped:", e.message); return null; })
          ]) as any[];

          const baseResult: any = {
            layer: { url: mapConfig.urlFormat },
            center: [lat, lon],
            zoom: zoom,
            type: type
          };

          if (selectedDatasetConfig) {
            baseResult.datasetConfig = {
              name: selectedDatasetConfig.scale === 100 ? 'CORINE Land Cover' : 'MODIS Land Cover',
              classNames: selectedDatasetConfig.classNames,
              palette: selectedDatasetConfig.palette,
              gifLabels: selectedDatasetConfig.gifLabels,
              startYear: selectedDatasetConfig.startYear,
              endYear: selectedDatasetConfig.endYear,
              fps: selectedDatasetConfig.fps || 1.5
            };
          }

          if (rawBounds) {
            const coords = rawBounds[0];
            const lons = coords.map((c: number[]) => c[0]);
            const lats = coords.map((c: number[]) => c[1]);
            const sw = [Math.min(...lats), Math.min(...lons)];
            const ne = [Math.max(...lats), Math.max(...lons)];
            baseResult.roiBounds = [sw, ne];
          }

          if (gifUrl) {
            baseResult.gifLayer = { url: gifUrl, bounds: baseResult.roiBounds };
          }

          if (statsData) {
            try {
              const classNames = selectedDatasetConfig.classNames;
              const startYr = baseResult.datasetConfig.startYear;
              const endYr = baseResult.datasetConfig.endYear;
              const formattedStats: any = { [startYr]: {}, [endYr]: {}, transitions: {} };

              if (statsData.yStart && Array.isArray(statsData.yStart)) {
                statsData.yStart.forEach((group: any) => {
                  const key = group.label;
                  const val = group.sum / 10000;
                  if (classNames[key]) formattedStats[startYr][classNames[key]] = val;
                });
              }
              if (statsData.yEnd && Array.isArray(statsData.yEnd)) {
                statsData.yEnd.forEach((group: any) => {
                  const key = group.label;
                  const val = group.sum / 10000;
                  if (classNames[key]) formattedStats[endYr][classNames[key]] = val;
                });
              }
              if (statsData.transitions && Array.isArray(statsData.transitions)) {
                statsData.transitions.forEach((group: any) => {
                  const keyNum = group.label;
                  const val = group.sum / 10000;
                  const yStartClass = Math.floor(keyNum / 1000);
                  const yEndClass = keyNum % 1000;
                  if (classNames[yStartClass] && classNames[yEndClass]) {
                    const transKey = `${classNames[yStartClass]} -> ${classNames[yEndClass]}`;
                    formattedStats.transitions[transKey] = val;
                  }
                });
              }

              baseResult.stats = formattedStats;
            } catch (formatErr) {
              console.error("Stats formatting error:", formatErr);
            }
          }

          resolve(baseResult);
        } catch (e) {
          reject(e);
        }
      })();
    } catch (e: any) {
      reject(new Error("Earth Engine computation failed: " + e.message));
    }
  });
}

// ─── Urban module: analyzeUrbanData ──────────────────────────────────────────

export async function analyzeUrbanData(
  lat: number,
  lon: number,
  metric: string,
  years: number
) {
  if (!isInitialized) {
    throw new Error('Earth Engine is not initialized.');
  }

  const point = ee.Geometry.Point([lon, lat]);
  const region = point.buffer(10000);

  const currentYear = new Date().getFullYear() - 1;
  const startYear = currentYear - years;

  let collection: any;
  let bandName: string;
  let scale: number;

  if (metric.includes('green')) {
    collection = ee.ImageCollection('MODIS/061/MOD13A2').select('NDVI');
    bandName = 'NDVI';
    scale = 1000;
  } else {
    collection = ee.ImageCollection('NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG').select('avg_rad');
    bandName = 'avg_rad';
    scale = 1000;
  }

  const yearlyData: any[] = [];
  for (let i = 0; i <= years; i++) {
    const year = startYear + i;
    const startDate = ee.Date.fromYMD(year, 1, 1);
    const endDate = ee.Date.fromYMD(year, 12, 31);

    const yearlyImg = collection.filterDate(startDate, endDate).mean();
    const stats = yearlyImg.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: region,
      scale: scale,
      maxPixels: 1e9
    });

    const value = await new Promise<any>((resolve, reject) => {
      stats.evaluate((result: any, error: any) => {
        if (error) reject(error);
        else resolve(result[bandName]);
      });
    });

    let finalValue = (value as number) || 0;
    if (metric.includes('green')) {
      finalValue = (finalValue / 10000) * 100;
    } else {
      finalValue = Math.min(100, finalValue * 2);
    }

    yearlyData.push({
      year: year.toString(),
      value: parseFloat(finalValue.toFixed(1)),
      metric: metric.replace('_', ' ')
    });
  }

  const firstVal = yearlyData[0].value;
  const lastVal = yearlyData[yearlyData.length - 1].value;
  const trend = lastVal >= firstVal ? 'increasing' : 'decreasing';

  return {
    data: yearlyData,
    trend,
    summary: `Real GEE data indicates a ${trend} trend in ${metric.replace('_', ' ')} for the location from ${startYear} to ${currentYear}.`
  };
}
