import { ref } from 'vue';
import { IconClose } from '/icons.js';

export const ErrorModal = {
    components: { IconClose },
    props: {
        error: { type: Object, default: null },
    },
    emits: ['close'],
    setup() {
        const traceExpanded = ref(false);
        function toggleTrace() { traceExpanded.value = !traceExpanded.value; }
        return { traceExpanded, toggleTrace };
    },
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
                <div v-if="error.detail" class="error-modal-http-meta">{{ error.detail }}</div>

                <div v-if="error.traceback" class="error-traceback-section">
                    <button
                        type="button"
                        class="error-traceback-toggle"
                        :aria-expanded="traceExpanded"
                        @click="toggleTrace"
                    >
                        <span class="error-traceback-arrow">{{ traceExpanded ? '▼' : '▶' }}</span>
                        Szczegóły techniczne
                    </button>
                    <pre v-if="traceExpanded" class="error-modal-detail">{{ error.traceback }}</pre>
                </div>

                <div class="error-modal-actions">
                    <button class="btn btn-primary" type="button" @click="$emit('close')">Zamknij</button>
                </div>
            </div>
        </div>
    </transition>
    `,
};
