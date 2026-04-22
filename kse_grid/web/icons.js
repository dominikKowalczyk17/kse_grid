// Inline lucide-style SVG icons. Used as Vue components.
// All icons are 16x16, currentColor, stroke-based.

const SVG_BASE = 'xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

function makeIcon(name, body) {
    return {
        name,
        template: `<svg ${SVG_BASE} class="icon"><g v-html="body"></g></svg>`,
        data: () => ({ body }),
    };
}

export const IconActivity   = makeIcon('IconActivity',   `<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>`);
export const IconSearch     = makeIcon('IconSearch',     `<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>`);
export const IconRotate     = makeIcon('IconRotate',     `<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>`);
export const IconCable      = makeIcon('IconCable',      `<path d="M4 9a2 2 0 0 1-2-2V5h6v2a2 2 0 0 1-2 2Z"/><path d="M3 5V3"/><path d="M7 5V3"/><path d="M19 15V6.5a3.5 3.5 0 0 0-7 0v11a3.5 3.5 0 0 1-7 0V9"/><path d="M17 21v-2"/><path d="M21 21v-2"/><path d="M22 19h-6v-2a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2Z"/>`);
export const IconZap        = makeIcon('IconZap',        `<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>`);
export const IconCircleDot  = makeIcon('IconCircleDot',  `<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/>`);
export const IconClose      = makeIcon('IconClose',      `<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`);
export const IconBolt       = makeIcon('IconBolt',       `<path d="M13 3 4 14h7l-1 7 9-11h-7l1-7Z"/>`);

export const ALL_ICONS = {
    IconActivity, IconSearch, IconRotate,
    IconCable, IconZap, IconCircleDot,
    IconClose, IconBolt,
};
