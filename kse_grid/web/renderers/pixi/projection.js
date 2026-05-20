/**
 * Web Mercator projection — lon/lat to world pixel space at tile-zoom 0.
 *
 * World coords: a single 256x256 px tile covers the whole world.
 * - x in [0, 256), y in [0, 256)
 * - x = ((lon + 180) / 360) * 256
 * - y = (1 - asinh(tan(lat)) / pi) / 2 * 256
 *
 * Viewport.scale relates pixel-per-world-unit:
 *   effective tile zoom = log2(scale)
 * (when scale == 2^z, a tile drawn at its native size of 256 world-units
 *  occupies 256 screen pixels — i.e. z is the matching XYZ tile zoom).
 *
 * Static helpers `tileBounds` / `worldToTile` are used by the tile layer.
 */

export const TILE_SIZE = 256;
const MAX_LAT = 85.05112878; // mercator clamp

export function projectLonLat (lon, lat) {
    const clampedLat = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
    const x = ((lon + 180) / 360) * TILE_SIZE;
    const latRad = clampedLat * Math.PI / 180;
    const y = (1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * TILE_SIZE;
    return { x, y };
}

export function projectBus (bus) {
    if (!bus || bus.lon == null || bus.lat == null) return null;
    return projectLonLat(bus.lon, bus.lat);
}

export function unprojectXY (x, y) {
    const lon = (x / TILE_SIZE) * 360 - 180;
    const n = Math.PI * (1 - 2 * (y / TILE_SIZE));
    const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
    return { lon, lat };
}

/**
 * World bounds of one XYZ tile.
 *  - tile_world_size = TILE_SIZE / 2^z
 *  - origin at (tx * tile_world_size, ty * tile_world_size)
 */
export function tileBounds (tx, ty, z) {
    const size = TILE_SIZE / Math.pow(2, z);
    return {
        x: tx * size,
        y: ty * size,
        size,
    };
}

export function worldToTile (worldX, worldY, z) {
    const n = Math.pow(2, z);
    return {
        tx: Math.floor((worldX / TILE_SIZE) * n),
        ty: Math.floor((worldY / TILE_SIZE) * n),
    };
}

export function pickTileZoom (viewportScale) {
    // viewport.scale = 2^z when one tile (256 world units) maps to 256 screen px
    const z = Math.log2(viewportScale);
    return Math.max(0, Math.min(19, Math.round(z)));
}
