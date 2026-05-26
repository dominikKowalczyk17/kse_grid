import { IconMoon, IconSun } from '/icons.js';

export const LandingPage = {
    components: { IconMoon, IconSun },
    props: {
        theme: { type: String, default: 'dark' },
    },
    emits: ['upload', 'new-grid', 'toggle-theme'],
    template: `
<div class="landing">
    <button class="btn btn-icon theme-toggle landing-theme-btn"
            type="button"
            :aria-label="theme === 'dark' ? 'Włącz jasny motyw' : 'Włącz ciemny motyw'"
            :title="theme === 'dark' ? 'Jasny motyw' : 'Ciemny motyw'"
            @click="$emit('toggle-theme')">
        <IconSun v-if="theme === 'dark'" />
        <IconMoon v-else />
    </button>

    <div class="landing-inner">
        <div class="landing-hero">
            <div class="landing-logo">PowerFlow</div>
            <p class="landing-tagline">Analiza i wizualizacja sieci elektroenergetycznej</p>
        </div>

        <div class="landing-cards">
            <button class="landing-card" type="button" @click="$emit('upload')">
                <div class="landing-card-icon-wrap">
                    <span class="landing-card-icon">↑</span>
                </div>
                <div class="landing-card-content">
                    <div class="landing-card-title">Wczytaj plik</div>
                    <div class="landing-card-body">
                        Otwórz istniejący case — plik MATPOWER lub JSON pandapower.
                        Sieć zostanie przeliczona i wyświetlona na grafie.
                    </div>
                    <div class="landing-card-meta">.m &nbsp;·&nbsp; .json</div>
                </div>
            </button>

            <button class="landing-card" type="button" @click="$emit('new-grid')">
                <div class="landing-card-icon-wrap">
                    <span class="landing-card-icon">+</span>
                </div>
                <div class="landing-card-content">
                    <div class="landing-card-title">Nowa sieć</div>
                    <div class="landing-card-body">
                        Zbuduj sieć od zera w Grid Builderze — dodawaj szyny, linie,
                        transformatory i generatory element po elemencie.
                    </div>
                    <div class="landing-card-meta">Grid Builder</div>
                </div>
            </button>
        </div>
    </div>
</div>
`,
};
