import { IconClose } from '/icons.js';

export const ErrorModal = {
    components: { IconClose },
    props: {
        error: { type: Object, default: null },
    },
    emits: ['close'],
    template: `
    <transition name="upload-fade">
        <div v-if="error" class="error-backdrop" role="dialog" aria-modal="true" aria-label="Błąd aplikacji" @click.self="$emit('close')">
            <div class="error-modal">
                <div class="error-modal-header">
                    <div>
                        <div class="error-modal-kind">Błąd</div>
                        <div class="error-modal-title">{{ error.title }}</div>
                        <div v-if="error.timestamp" class="error-modal-meta tabular">{{ error.timestamp }}</div>
                    </div>
                    <button class="card-close" type="button" aria-label="Zamknij modal błędu" @click="$emit('close')">
                        <IconClose />
                    </button>
                </div>
                <div class="error-modal-summary">{{ error.message }}</div>
                <pre v-if="error.detail" class="error-modal-detail">{{ error.detail }}</pre>
                <div class="error-modal-actions">
                    <button class="btn btn-primary" type="button" @click="$emit('close')">Zamknij</button>
                </div>
            </div>
        </div>
    </transition>
    `,
};
