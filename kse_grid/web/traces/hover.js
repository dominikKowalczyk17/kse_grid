/**
 * Generatory tekstów hover dla różnych typów elementów sieci.
 */

import { fmt } from '/traces/formatters.js';

export function lineHover(line, hasResults) {
    const lines = [
        `<b>${line.name}</b>`,
        `Napięcie: ${line.voltage.toFixed(0)} kV`,
        `Długość: ${fmt(line.lengthKm)} km${line.lengthSource === 'model' ? ' (model)' : ''}`,
    ];
    if (hasResults) {
        lines.push(`Obciążenie: ${fmt(line.loading)}%`);
        lines.push(`P od strony początkowej: ${fmt(line.pFromMw)} MW`);
    }
    return lines.join('<br>');
}

export function trafoHover(trafo, hasResults) {
    const lines = [
        `<b>${trafo.name}</b>`,
        `Trafo ${trafo.vnHvKv.toFixed(0)}/${trafo.vnLvKv.toFixed(0)} kV`,
        `Moc znamionowa: ${fmt(trafo.snMva, 0)} MVA`,
    ];
    if (hasResults) {
        lines.push(`Obciążenie: ${fmt(trafo.loading)}%`);
        lines.push(`P po stronie HV: ${fmt(trafo.pHvMw)} MW`);
    }
    return lines.join('<br>');
}

export function busHover(bus, hasResults) {
    const lines = [
        `<b>${bus.name}</b>`,
        `Napięcie znamionowe: ${bus.vn_kv.toFixed(0)} kV`,
    ];
    if (hasResults) {
        lines.push(`Um: ${fmt(bus.vmPu, 4)} p.u.`);
        lines.push(`Kąt: ${fmt(bus.vaDeg, 2)}°`);
    }
    if (bus.genMw > 0) lines.push(`Generacja: ${fmt(bus.genMw)} MW`);
    if (bus.loadMw > 0) lines.push(`Obciążenie: ${fmt(bus.loadMw)} MW`);
    return lines.join('<br>');
}

export function switchHover(sw) {
    const lines = [
        `<b>${sw.name}</b>`,
        `Stan: ${sw.closed ? 'zamknięty' : 'otwarty'}`,
        `Element: ${sw.elementName}`,
        `Bus: ${sw.busName}`,
    ];
    if (sw.remoteBusName) lines.push(`Drugi koniec: ${sw.remoteBusName}`);
    if (sw.sideLabel) lines.push(`Strona: ${sw.sideLabel}`);
    return lines.join('<br>');
}
