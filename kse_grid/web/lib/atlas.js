export const ATLAS_DEFAULT_VIEW = {
    center: { lon: 19.5, lat: 52.0 },
    zoom: 5.4,
    focusZoom: 8,
};

export const ATLAS_LINE_STYLES = {
    osp: { color: 'rgba(255, 80,  80,  0.95)', width: 2.4 },
    osd: { color: 'rgba(120, 200, 255, 0.85)', width: 1.2 },
    jw: { color: 'rgba(255, 220, 120, 0.85)', width: 1.0, dash: '4,3' },
};

export const ATLAS_POINT_STYLES = {
    osp: { color: 'rgba(255, 80,  80,  1.0)', radius: 4.5, stroke: { color: 'rgba(20, 20, 20, 0.9)', radius: 5.6 } },
    osd: { color: 'rgba(120, 200, 255, 1.0)', radius: 3.0, stroke: { color: 'rgba(20, 20, 20, 0.9)', radius: 3.9 } },
    jw: { color: 'rgba(255, 220, 120, 1.0)', radius: 3.2, stroke: { color: 'rgba(20, 20, 20, 0.9)', radius: 4.1 } },
};

export const ATLAS_CATEGORIES = ['osd', 'osp', 'jw'];

let atlasCache = null;

export async function loadAtlas () {
    if (atlasCache) return atlasCache;

    const [points, lines] = await Promise.all([
        fetch('/kse_atlas_points.geojson').then(response => response.json()),
        fetch('/kse_atlas_lines.geojson').then(response => response.json()),
    ]);

    const splitByCategory = (featureCollection) => {
        const groups = { osp: [], osd: [], jw: [] };
        for (const feature of featureCollection.features || []) {
            const category = feature.properties?.category;
            if (groups[category]) groups[category].push(feature);
        }
        const wrap = (features) => ({ type: 'FeatureCollection', features });
        return { osp: wrap(groups.osp), osd: wrap(groups.osd), jw: wrap(groups.jw) };
    };

    atlasCache = {
        points: splitByCategory(points),
        lines: splitByCategory(lines),
    };
    return atlasCache;
}
