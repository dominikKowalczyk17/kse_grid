export function coordKeys (viewMode) {
    return isMapMode(viewMode)
        ? { x: 'lon', y: 'lat' }
        : { x: 'x', y: 'y' };
}

export function isGraphMode (viewMode) {
    return viewMode === 'graph';
}

export function isGeoMode (viewMode) {
    return viewMode === 'geo';
}

export function isAtlasMode (viewMode) {
    return viewMode === 'atlas';
}

export function isMapMode (viewMode) {
    return viewMode === 'geo' || viewMode === 'atlas';
}
