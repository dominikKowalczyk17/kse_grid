export class AppError extends Error {
    constructor(message, options = {}) {
        super(message);
        this.name = options.name || 'AppError';
        this.title = options.title || 'Błąd aplikacji';
        this.status = options.status ?? null;
        this.method = options.method || null;
        this.url = options.url || null;
        this.detail = options.detail || '';
        this.traceback = options.traceback || '';
        this.body = options.body || '';
        this.info = options.info || '';
        this.timestamp = options.timestamp || new Date().toISOString();
        this.cause = options.cause;
    }
}

function stringifyUnknown(value) {
    if (typeof value === 'string') return value;
    if (value instanceof Error) return value.message || value.name || 'Nieznany błąd';
    try {
        return JSON.stringify(value, null, 2);
    } catch (_) {
        return String(value);
    }
}

export function formatError(error, fallbackTitle = 'Błąd aplikacji') {
    const err = error instanceof AppError
        ? error
        : error instanceof Error
            ? error
            : new AppError(stringifyUnknown(error), { title: fallbackTitle, cause: error });

    const title = err.title || fallbackTitle;
    const message = err.message || stringifyUnknown(err);

    // One-line HTTP context shown beneath the message
    const contextParts = [
        err.status != null ? `HTTP ${err.status}` : null,
        err.method || null,
        err.url || null,
    ].filter(Boolean);
    const detail = contextParts.join(' · ');

    // Full technical content for the expandable section
    // Priority: explicit traceback from server, then JS stack
    const tracebackParts = [];
    if (err.info) tracebackParts.push(String(err.info));
    if (err.traceback) {
        tracebackParts.push(err.traceback);
    } else if (err.stack) {
        tracebackParts.push(err.stack);
    }

    return {
        title,
        message,
        detail,
        traceback: tracebackParts.filter(Boolean).join('\n\n').trim(),
        timestamp: err.timestamp || new Date().toISOString(),
    };
}

export function emitRuntimeError(error, detail = {}) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('kse-grid:error', {
        detail: {
            title: detail.title || 'Błąd aplikacji',
            info: detail.info || '',
            error,
        },
    }));
}
