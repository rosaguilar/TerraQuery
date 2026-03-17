export interface DatasetConfigEntry {
  collection: string;
  band: string;
  scale: number;
  startFilter?: [string, string];
  endFilter?: [string, string];
  gifYears: number[];
  gifLabels: number[];
  nativeValues: number[];
  remapValues?: number[];
  classNames: string[];
  palette: string[];
}

export const datasetConfig: Record<string, DatasetConfigEntry> = {
  dynamicworld: {
    collection: 'GOOGLE/DYNAMICWORLD/V1',
    band: 'label',
    scale: 10,
    startFilter: ['2016-01-01', '2016-12-31'],
    endFilter: ['2023-01-01', '2023-12-31'],
    gifYears: Array.from({ length: 8 }, (_, i) => 2016 + i),
    gifLabels: Array.from({ length: 8 }, (_, i) => 2016 + i),
    nativeValues: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    classNames: [
      'Water', 'Trees', 'Grass', 'Flooded Vegetation', 'Crops',
      'Shrub and Scrub', 'Built', 'Bare', 'Snow and Ice'
    ],
    palette: [
      '419BDF', '397D49', '88B053', '7A87C6', 'E49635',
      'DFC35A', 'C4281B', 'A59B8F', 'B39FE1'
    ]
  },

  modis: {
    collection: 'MODIS/061/MCD12Q1',
    band: 'LC_Type1',
    scale: 500,
    startFilter: ['2001-01-01', '2001-12-31'],
    endFilter: ['2023-01-01', '2024-12-31'],
    gifYears: Array.from({ length: 24 }, (_, i) => 2001 + i),
    gifLabels: Array.from({ length: 24 }, (_, i) => 2001 + i),
    nativeValues: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
    classNames: [
      "Unclassified", "Evergreen Needleleaf Forests", "Evergreen Broadleaf Forests",
      "Deciduous Needleleaf Forests", "Deciduous Broadleaf Forests", "Mixed Forests",
      "Closed Shrublands", "Open Shrublands", "Woody Savannas", "Savannas",
      "Grasslands", "Permanent Wetlands", "Croplands", "Urban and Built-up Lands",
      "Cropland Mosaics", "Snow and Ice", "Barren", "Water Bodies"
    ],
    palette: [
      '000000', '05450a', '086a10', '54a708', '78d203', '009900', 'c6b044', 'dcd159',
      'dade48', 'fbff13', 'b6ff05', '27ff87', 'c24f44', 'a5a5a5', 'ff6d4c', '69fff8',
      'f9ffa4', '1c0dff'
    ]
  },

  corine: {
    collection: 'COPERNICUS/CORINE/V20/100m',
    band: 'landcover',
    scale: 100,
    nativeValues: [
      111, 112, 121, 122, 123, 124, 131, 132, 133, 141, 142, 211, 212, 213, 221, 222, 223,
      231, 241, 242, 243, 244, 311, 312, 313, 321, 322, 323, 324, 331, 332, 333, 334, 335,
      411, 412, 421, 422, 423, 511, 512, 521, 522, 523
    ],
    remapValues: [
      0, 0, 1, 1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 4, 5, 5, 5,
      6, 7, 7, 7, 7, 8, 8, 8, 9, 9, 9, 9, 10, 10, 10, 10, 10,
      11, 11, 12, 12, 12, 13, 13, 14, 14, 14
    ],
    gifYears: [1990, 2000, 2006, 2012, 2018],
    gifLabels: [1990, 2000, 2006, 2012, 2018],
    classNames: [
      'Urban fabric', 'Industrial & commercial', 'Mine, dump & construction',
      'Artificial vegetated areas', 'Arable land', 'Permanent crops',
      'Pastures', 'Heterogeneous agricultural', 'Forests',
      'Scrub & herbaceous vegetation', 'Open spaces',
      'Inland wetlands', 'Maritime wetlands', 'Inland waters', 'Marine waters'
    ],
    palette: [
      'E6004D', 'CC4DF2', 'A600CC', 'FFA6FF', 'FFFFA8', 'E68000',
      'E6E64D', 'FFE64D', '80FF00', 'CCF24D', 'E6E6E6',
      'A6A6FF', 'CCCCFF', '00CCF2', '00FFA6'
    ]
  }
};
