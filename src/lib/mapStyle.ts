/**
 * Style bản đồ 3D cho màn hình điều phối (MapLibre GL + vector tiles OpenFreeMap).
 * • Không cần API key, không giới hạn lượt xem (OpenFreeMap free, dữ liệu OpenStreetMap).
 * • Có lớp `fill-extrusion` ⇒ toà nhà cao lên 3D thật, nghiêng/ngước/xoay được như app vận tải.
 * • Palette "control room": nền tối, đường phát sáng, nước xanh thẫm → shipper nổi bật.
 */
import type { StyleSpecification } from 'maplibre-gl'

const TILES = 'https://tiles.openfreemap.org/planet'
const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf'

const ROAD_MAJOR = ['motorway', 'trunk', 'primary']
const ROAD_MID = ['secondary', 'tertiary', 'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link']

export function mapStyle3D(dark = true): StyleSpecification {
  const c = dark
    ? {
        bg: '#070d14', water: '#0d2233', park: '#0d2018', landuse: '#0b131c', building: '#16212e',
        buildingTop: '#2b3c53', roadCasing: '#050a11', roadMajor: '#f6b23c', roadMid: '#c98a2e', roadMinor: '#2f4055',
        rail: '#39506b', text: '#dce9f7', halo: '#060b12', boundary: '#26384d',
      }
    : {
        bg: '#eef3ee', water: '#bcd8f0', park: '#d3e8cc', landuse: '#e8eee4', building: '#d8d8d2',
        buildingTop: '#c2c6c0', roadCasing: '#d7d2c8', roadMajor: '#f2a63a', roadMid: '#e8c37e', roadMinor: '#ffffff',
        rail: '#c7c3ba', text: '#243027', halo: '#ffffff', boundary: '#b9c6bb',
      }

  return {
    version: 8,
    glyphs: GLYPHS,
    sources: {
      openmaptiles: { type: 'vector', url: TILES },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': c.bg } },

      // --- tự nhiên -------------------------------------------------------
      { id: 'park', type: 'fill', source: 'openmaptiles', 'source-layer': 'park', paint: { 'fill-color': c.park, 'fill-opacity': 0.85 } },
      { id: 'landuse', type: 'fill', source: 'openmaptiles', 'source-layer': 'landuse', paint: { 'fill-color': c.landuse, 'fill-opacity': 0.6 } },
      { id: 'waterway', type: 'line', source: 'openmaptiles', 'source-layer': 'waterway', paint: { 'line-color': c.water, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 18, 6] } },
      { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water', paint: { 'fill-color': c.water, 'fill-opacity': 1 } },

      // --- toà nhà 3D (đổ khối theo chiều cao) ---------------------------
      {
        id: 'building-2d',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'building',
        minzoom: 13,
        maxzoom: 14.5,
        paint: { 'fill-color': c.building, 'fill-opacity': 0.9, 'fill-outline-color': c.buildingTop },
      },
      {
        id: 'building-3d',
        type: 'fill-extrusion',
        source: 'openmaptiles',
        'source-layer': 'building',
        minzoom: 14,
        paint: {
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], ['get', 'height'], 14],
          'fill-extrusion-color': [
            'interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 10],
            0, c.building, 40, c.buildingTop, 120, dark ? '#3c5877' : '#a9b6c4',
          ],
          'fill-extrusion-opacity': 0.93,
        },
      },

      // --- đường --------------------------------------------------------
      {
        id: 'road-minor', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        minzoom: 13,
        filter: ['in', ['get', 'class'], ['literal', ['service', 'minor', 'path', 'track']]],
        paint: { 'line-color': c.roadMinor, 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.5, 18, 8], 'line-opacity': 0.55 },
      },
      {
        id: 'road-mid-casing', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        minzoom: 9,
        filter: ['in', ['get', 'class'], ['literal', ROAD_MID]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': c.roadCasing, 'line-width': ['interpolate', ['exponential', 1.3], ['zoom'], 9, 0.8, 18, 20] },
      },
      {
        id: 'road-mid', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        minzoom: 9,
        filter: ['in', ['get', 'class'], ['literal', ROAD_MID]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': c.roadMid, 'line-width': ['interpolate', ['exponential', 1.3], ['zoom'], 9, 0.4, 18, 12], 'line-opacity': 0.9 },
      },
      {
        id: 'road-major-casing', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        minzoom: 6,
        filter: ['in', ['get', 'class'], ['literal', ROAD_MAJOR]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': c.roadCasing, 'line-width': ['interpolate', ['exponential', 1.3], ['zoom'], 6, 1.4, 18, 30] },
      },
      {
        id: 'road-major', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        minzoom: 6,
        filter: ['in', ['get', 'class'], ['literal', ROAD_MAJOR]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': c.roadMajor, 'line-width': ['interpolate', ['exponential', 1.3], ['zoom'], 6, 0.8, 18, 18] },
      },
      {
        id: 'rail', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        filter: ['in', ['get', 'class'], ['literal', ['rail', 'transit']]],
        paint: { 'line-color': c.rail, 'line-width': 1.2, 'line-dasharray': [3, 3], 'line-opacity': 0.5 },
      },
      {
        id: 'boundary', type: 'line', source: 'openmaptiles', 'source-layer': 'boundary',
        filter: ['<=', ['get', 'admin_level'], 6],
        paint: { 'line-color': c.boundary, 'line-width': 1, 'line-dasharray': [2, 2], 'line-opacity': 0.7 },
      },

      // --- nhãn ---------------------------------------------------------
      {
        id: 'road-label', type: 'symbol', source: 'openmaptiles', 'source-layer': 'transportation_name',
        minzoom: 14,
        layout: {
          'symbol-placement': 'line',
          'text-field': ['coalesce', ['get', 'name:vi'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': 10,
          'symbol-spacing': 320,
        },
        paint: { 'text-color': c.text, 'text-opacity': 0.55, 'text-halo-color': c.halo, 'text-halo-width': 1.2 },
      },
      {
        id: 'place-suburb', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place',
        filter: ['in', ['get', 'class'], ['literal', ['suburb', 'quarter', 'neighbourhood']]],
        minzoom: 13,
        layout: {
          'text-field': ['coalesce', ['get', 'name:vi'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 13, 11, 18, 14],
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.1,
        },
        paint: { 'text-color': c.text, 'text-opacity': 0.6, 'text-halo-color': c.halo, 'text-halo-width': 1.3 },
      },
      {
        id: 'place-city', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place',
        filter: ['in', ['get', 'class'], ['literal', ['city', 'town']]],
        layout: {
          'text-field': ['coalesce', ['get', 'name:vi'], ['get', 'name']],
          'text-font': ['Noto Sans Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 5, 11, 12, 17],
        },
        paint: { 'text-color': c.text, 'text-halo-color': c.halo, 'text-halo-width': 1.6 },
      },
    ],
  }
}

/** Style raster dự phòng (nếu mạng chặn vector tiles) — vẫn có 3D nghiêng/xoay. */
export function mapStyleRaster(): StyleSpecification {
  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png', 'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png', 'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 19,
        attribution: '© OpenStreetMap',
      },
    },
    layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
  }
}
