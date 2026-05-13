import { createApp } from 'vue';
import { App } from '/components/app-root.js';
import { emitRuntimeError } from '/lib/errors.js';

const app = createApp(App);

app.config.errorHandler = (error, _instance, info) => {
    emitRuntimeError(error, {
        title: 'Błąd Vue',
        info,
    });
};

app.mount('#app');
