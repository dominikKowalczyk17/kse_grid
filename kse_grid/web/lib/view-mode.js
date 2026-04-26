export function coordKeys (viewMode) {
    return (viewMode === 'geo' || viewMode === 'atlas')
        ? { x: 'lon', y: 'lat' }
        : { x: 'x', y: 'y' };
}
