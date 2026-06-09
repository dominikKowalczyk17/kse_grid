import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import hljs from 'highlight.js';

// ── Navigation tree ────────────────────────────────────────────────────────
const NAV = [
    {
        id: 'getting-started', label: 'Getting started',
        children: [
            { id: 'overview',     label: 'Overview' },
            { id: 'quick-start',  label: 'Quick start' },
        ],
    },
    {
        id: 'python-api', label: 'Python API',
        children: [
            {
                id: 'sg-classes', label: 'Classes',
                children: [
                    { id: 'api-ksegrid',          label: 'KSEGrid' },
                    { id: 'api-powerflowrunner',  label: 'PowerFlowRunner' },
                    { id: 'api-switchingsession', label: 'SwitchingSession' },
                ],
            },
            {
                id: 'sg-functions', label: 'Functions',
                children: [
                    { id: 'api-load-matpower', label: 'load_matpower_case' },
                ],
            },
        ],
    },
    {
        id: 'rest-api', label: 'REST API',
        children: [
            { id: 'rest-network',   label: 'Network' },
            { id: 'rest-elements',  label: 'Elements' },
            { id: 'rest-powerflow', label: 'Power flow' },
            { id: 'rest-export',    label: 'Export' },
        ],
    },
    {
        id: 'user-guide', label: 'User guide',
        children: [
            {
                id: 'sg-ui-overview', label: 'Interface',
                children: [
                    { id: 'ui-landing', label: 'Landing page' },
                    { id: 'ui-views',   label: 'View modes' },
                    { id: 'ui-filters', label: 'Sidebar & filters' },
                ],
            },
            {
                id: 'sg-ui-tools', label: 'Analysis tools',
                children: [
                    { id: 'ui-inspector',   label: 'Element inspector' },
                    { id: 'ui-results-bar', label: 'Results bar' },
                ],
            },
            {
                id: 'sg-ui-editing', label: 'Network editing',
                children: [
                    { id: 'ui-grid-builder', label: 'Grid builder' },
                ],
            },
        ],
    },
    {
        id: 'data-formats', label: 'Data formats',
        children: [
            { id: 'fmt-matpower',   label: 'MATPOWER .m' },
            { id: 'fmt-pandapower', label: 'pandapower JSON' },
            { id: 'fmt-geojson',    label: 'GeoJSON sidecar' },
        ],
    },
];

function getLeaves(nodes) {
    const out = [];
    for (const n of nodes) {
        if (n.children) out.push(...getLeaves(n.children));
        else out.push(n);
    }
    return out;
}
const SECTIONS = getLeaves(NAV);

function parseSection(hash) {
    const m = hash.match(/^#\/docs\/(.+)$/);
    return (m && SECTIONS.find(s => s.id === m[1])) ? m[1] : 'overview';
}

function flattenNav(nodes, level = 0) {
    const out = [];
    for (const n of nodes) {
        if (n.children) {
            out.push({ id: n.id, label: n.label, level, isGroup: true });
            out.push(...flattenNav(n.children, level + 1));
        } else {
            out.push({ id: n.id, label: n.label, level, isGroup: false });
        }
    }
    return out;
}

// ── Component ─────────────────────────────────────────────────────────────
export const DocsPage = {
    emits: ['back'],
    setup(_, { emit }) {
        const currentSection = ref(parseSection(window.location.hash));

        let themeObserver;

        // ── Navigation ─────────────────────────────────────────────────────
        const flatNav = flattenNav(NAV);

        function onMenuSelect(key) { window.location.hash = `#/docs/${key}`; }
        function onHashChange()    { currentSection.value = parseSection(window.location.hash); }
        function goBack()          { window.location.hash = ''; emit('back'); }

        // ── Pagination ─────────────────────────────────────────────────────
        const sIdx = () => SECTIONS.findIndex(s => s.id === currentSection.value);
        function prevSection() { const i = sIdx(); return i > 0 ? SECTIONS[i - 1] : null; }
        function nextSection() { const i = sIdx(); return i < SECTIONS.length - 1 ? SECTIONS[i + 1] : null; }

        // ── Highlight.js ───────────────────────────────────────────────────
        function applyHljs() {
            nextTick(() => {
                hljs.configure({ ignoreUnescapedHTML: true });
                document.querySelectorAll('pre.docs-pre > code:not(.hljs)').forEach(el => {
                    hljs.highlightElement(el);
                });
            });
        }

        watch(currentSection, async () => {
            document.querySelector('.docs-content')?.scrollTo({ top: 0, behavior: 'instant' });
            applyHljs();
        });

        onMounted(() => {
            window.addEventListener('hashchange', onHashChange);
            themeObserver = new MutationObserver(() => {
                const dark = document.documentElement.dataset.theme !== 'light';
                const elDark  = document.getElementById('hljs-dark');
                const elLight = document.getElementById('hljs-light');
                if (elDark)  elDark.disabled  = !dark;
                if (elLight) elLight.disabled = dark;
            });
            themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
            applyHljs();
        });

        onBeforeUnmount(() => {
            window.removeEventListener('hashchange', onHashChange);
            themeObserver?.disconnect();
        });

        return {
            currentSection, flatNav, onMenuSelect,
            goBack, prevSection, nextSection,
        };
    },

    template: `
<div class="docs-shell">

  <!-- ── Top bar ──────────────────────────────────────────── -->
  <div class="docs-topbar">
    <span class="docs-topbar-title">PowerFlow</span>
    <span class="docs-topbar-version">kse-grid</span>
    <button class="docs-back-btn" type="button" @click="goBack">← Back to app</button>
  </div>

  <!-- ── Two-column layout ────────────────────────────────── -->
  <div class="docs-body">

    <nav class="docs-sidebar">
      <template v-for="item in flatNav" :key="item.id">
        <div v-if="item.isGroup" class="docs-nav-group" :style="{'padding-left': (item.level * 12 + 12) + 'px'}">{{ item.label }}</div>
        <button v-else class="docs-nav-item" :class="{active: currentSection === item.id}" :style="{'padding-left': (item.level * 12 + 20) + 'px'}" type="button" @click="onMenuSelect(item.id)">{{ item.label }}</button>
      </template>
    </nav>

    <div class="docs-content">
      <div class="docs-content-inner">

    <!-- ════════════════════════════════════ OVERVIEW ══ -->
    <template v-if="currentSection === 'overview'">
      <h1 class="docs-h1">PowerFlow — kse-grid</h1>
      <p class="docs-lead">
        Interactive power-grid analysis and visualisation built on top of
        <strong>pandapower</strong>. Load a MATPOWER case file or build a network from scratch,
        run AC Newton-Raphson load flow, and explore the results in a browser-based dashboard —
        no build step required.
      </p>

      <h2 class="docs-h2">What it does</h2>
      <p class="docs-p">
        PowerFlow wraps pandapower's network model and solver in a lightweight FastAPI server.
        The browser frontend (Vue 3, no bundler) connects to that server and gives you:
        a force-directed graph, a geographic OSM map view, a KSE 2019 reference atlas overlay,
        and a full suite of diagnostics — all updating live as you open switches, edit parameters,
        or create new elements.
      </p>

      <h2 class="docs-h2">Feature overview</h2>
      <ul class="docs-list">
        <li>Load MATPOWER <code class="docs-code">.m</code> and pandapower JSON networks via file upload or CLI argument</li>
        <li>AC Newton-Raphson load flow (configurable algorithm, iteration limit, tolerance)</li>
        <li>Island-aware power flow — correctly handles networks with multiple disconnected components</li>
        <li>Spring-layout graph view rendered with PixiJS — buses coloured by voltage level, lines by loading</li>
        <li>Geographic OSM map view via Plotly when WGS84 coordinates are available</li>
        <li>KSE 2019 atlas overlay for comparison against the real Polish transmission system</li>
        <li>Interactive topology control — open/close switches, edit element parameters in-browser</li>
        <li>Voltage and loading diagnostics with PN-EN 50160 band violation highlighting</li>
        <li>Grid Builder — create buses, lines, transformers, generators element by element</li>
        <li>Export to pandapower JSON and MATPOWER format</li>
        <li>GeoJSON sidecar support for attaching geographic coordinates to any case file</li>
        <li>Dark / light theme with <code class="docs-code">localStorage</code> persistence</li>
      </ul>

      <h2 class="docs-h2">Architecture</h2>
      <table class="docs-table">
        <thead><tr><th>Layer</th><th>Technology</th><th>Role</th></tr></thead>
        <tbody>
          <tr><td>Server</td><td>FastAPI + Uvicorn</td><td>REST API, static file serving, session management</td></tr>
          <tr><td>Network math</td><td>pandapower 3.4+, NumPy, SciPy, pandas</td><td>Load flow, admittance matrix, element modelling</td></tr>
          <tr><td>File parsing</td><td>matpowercaseframes 2.1+</td><td>MATPOWER .m → pandapowerNet conversion</td></tr>
          <tr><td>Frontend</td><td>Vue 3 (ESM CDN), PixiJS 8, Plotly 2.35</td><td>Graph rendering, map view, UI components</td></tr>
          <tr><td>Session state</td><td>SwitchingSession</td><td>Mutable working copy, change staging, recalculation</td></tr>
        </tbody>
      </table>
    </template>

    <!-- ════════════════════════════════════ QUICK START ══ -->
    <template v-else-if="currentSection === 'quick-start'">
      <h1 class="docs-h1">Quick start</h1>

      <h2 class="docs-h2">Requirements</h2>
      <ul class="docs-list">
        <li>Python 3.13 or newer</li>
        <li><code class="docs-code">uv</code> (recommended) or <code class="docs-code">pip</code></li>
        <li>A MATPOWER <code class="docs-code">.m</code> case file or pandapower JSON</li>
      </ul>

      <h2 class="docs-h2">Installation</h2>
      <pre class="docs-pre"><code class="language-bash">git clone https://github.com/your-org/kse-grid.git
cd kse-grid
uv sync          # install all dependencies from pyproject.toml

# Or with pip
pip install -e .</code></pre>

      <h2 class="docs-h2">CLI</h2>
      <p class="docs-p">
        The entry point is <code class="docs-code">main.py</code> in the project root.
        Pass a path to a case file as the only positional argument.
      </p>
      <pre class="docs-pre"><code class="language-bash"># Open a MATPOWER case
uv run python main.py path/to/case.m

# Open a pandapower JSON file
uv run python main.py path/to/network.json

# Start with an empty grid (Grid Builder mode)
uv run python main.py

# Server starts at http://127.0.0.1:8050/ and opens the browser automatically</code></pre>

      <h2 class="docs-h2">Python API — minimal example</h2>
      <pre class="docs-pre"><code class="language-python">import kse_grid

# One-liner: load → solve → open browser
kse_grid.KSEGrid.from_matpower_case("case.m").run_powerflow().serve()

# Step by step
grid = kse_grid.KSEGrid.from_matpower_case("case.m")
grid.run_powerflow(algorithm="nr", tolerance_mva=1e-3)
grid.report()    # print summary to terminal
grid.serve()     # blocks until Ctrl+C</code></pre>

      <h2 class="docs-h2">Accessing pandapower results</h2>
      <pre class="docs-pre"><code class="language-python">grid = kse_grid.KSEGrid.from_matpower_case("case.m").run_powerflow()
net = grid.net   # pandapower.pandapowerNet

# Standard pandapower result tables
print(net.res_bus[["vm_pu", "va_degree"]].head())
print(net.res_line[["p_from_mw", "loading_percent"]].describe())
print(net.res_trafo[["loading_percent"]].max())</code></pre>

      <h2 class="docs-h2">Using data from the examples directory</h2>
      <pre class="docs-pre"><code class="language-bash">uv run python main.py data/examples/sse_summer_peak.m</code></pre>
    </template>

    <!-- ════════════════════════════════════ API: KSEGrid ══ -->
    <template v-else-if="currentSection === 'api-ksegrid'">
      <h1 class="docs-h1">KSEGrid</h1>
      <p class="docs-lead">
        Top-level facade that combines MATPOWER file loading, power flow execution,
        terminal reporting and the web dashboard into a single chainable API.
        This is the primary entry point for interactive use.
      </p>
      <pre class="docs-pre"><code class="language-python">from kse_grid import KSEGrid

# or via the package namespace
import kse_grid
grid = kse_grid.KSEGrid.from_matpower_case("case.m")</code></pre>

      <div class="docs-note">
        <strong>Note:</strong> <code class="docs-code">KSEGrid</code> does not subclass
        <code class="docs-code">pandapowerNet</code>. It holds a reference to the network
        via the <code class="docs-code">.net</code> attribute. All pandapower functions
        work on <code class="docs-code">grid.net</code> directly.
      </div>

      <!-- from_matpower_case -->
      <h2 class="docs-h2">KSEGrid.from_matpower_case()</h2>
      <div class="docs-signature">@classmethod
from_matpower_case(
    case_file: str | pathlib.Path,
    f_hz: int = 50
) -> KSEGrid</div>
      <p class="docs-p">
        Load a MATPOWER <code class="docs-code">.m</code> case file and return a ready-to-use
        <code class="docs-code">KSEGrid</code> instance. This is the most common entry point.
      </p>
      <p class="docs-p">Internally it calls <code class="docs-code">load_matpower_case()</code>,
      which performs the following pipeline:</p>
      <ol class="docs-list" style="list-style:decimal;padding-left:1.5rem;">
        <li style="padding-left:0">Parse the <code class="docs-code">.m</code> file with <code class="docs-code">matpowercaseframes</code></li>
        <li style="padding-left:0">Convert to a <code class="docs-code">pandapowerNet</code> using <code class="docs-code">pandapower.converter.from_mpc()</code></li>
        <li style="padding-left:0">Normalise element names (generate names for empty entries)</li>
        <li style="padding-left:0">Promote voltage-step branches to transformers</li>
        <li style="padding-left:0">Seed operational switches from branch status flags</li>
        <li style="padding-left:0">Attempt to load a GeoJSON sidecar (same directory, same base name, <code class="docs-code">.geojson</code>)</li>
      </ol>
      <table class="docs-table">
        <thead><tr><th>Parameter</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td>case_file</td><td>str | Path</td><td>—</td><td>Path to the MATPOWER <code class="docs-code">.m</code> file.</td></tr>
          <tr><td>f_hz</td><td>int</td><td>50</td><td>System frequency. 50 Hz for Europe, 60 Hz for North America. Affects line susceptance calculation and per-unit base.</td></tr>
        </tbody>
      </table>
      <p class="docs-p"><strong>Returns:</strong> a new <code class="docs-code">KSEGrid</code> instance with <code class="docs-code">.net</code> populated.</p>
      <p class="docs-p"><strong>Raises:</strong> <code class="docs-code">FileNotFoundError</code> if <code class="docs-code">case_file</code> does not exist;
      various <code class="docs-code">matpowercaseframes</code> / pandapower exceptions if the file is malformed.</p>
      <pre class="docs-pre"><code class="language-python">grid = KSEGrid.from_matpower_case("data/examples/sse.m", f_hz=50)
# Loaded: SSE Summer Peak
#    Buses: 83, lines: 97, trafos: 12</code></pre>

      <!-- new_empty -->
      <h2 class="docs-h2">KSEGrid.new_empty()</h2>
      <div class="docs-signature">@classmethod
new_empty(f_hz: int = 50) -> KSEGrid</div>
      <p class="docs-p">
        Create a <code class="docs-code">KSEGrid</code> with an empty pandapower network.
        The returned instance has no buses, lines, or any other elements.
        Use as a starting point for building a network element by element via
        the Grid Builder or programmatically.
      </p>
      <table class="docs-table">
        <thead><tr><th>Parameter</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td>f_hz</td><td>int</td><td>50</td><td>System frequency used for all subsequent calculations.</td></tr>
        </tbody>
      </table>
      <pre class="docs-pre"><code class="language-python">import pandapower as pp

grid = KSEGrid.new_empty()
pp.create_bus(grid.net, vn_kv=400, name="Bus A")
pp.create_bus(grid.net, vn_kv=400, name="Bus B")
pp.create_ext_grid(grid.net, bus=0, vm_pu=1.02)
pp.create_line_from_parameters(
    grid.net, from_bus=0, to_bus=1,
    length_km=100, r_ohm_per_km=0.03, x_ohm_per_km=0.3,
    c_nf_per_km=10, max_i_ka=1.0
)
grid.run_powerflow().serve()</code></pre>

      <!-- run_powerflow -->
      <h2 class="docs-h2">grid.run_powerflow()</h2>
      <div class="docs-signature">run_powerflow(
    algorithm: str = "nr",
    max_iteration: int = 100,
    tolerance_mva: float = 1e-3
) -> KSEGrid</div>
      <p class="docs-p">
        Run AC load flow on the loaded network. Returns <code class="docs-code">self</code>
        to enable method chaining. Internally calls <code class="docs-code">pandapower.runpp()</code>
        with a flat start and stores the convergence options for reuse during interactive recalculation.
      </p>
      <table class="docs-table">
        <thead><tr><th>Parameter</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          <tr>
            <td>algorithm</td><td>str</td><td>"nr"</td>
            <td>
              Solver algorithm:<br>
              <code class="docs-code">"nr"</code> — Newton-Raphson (default, most networks)<br>
              <code class="docs-code">"bfsw"</code> — backward/forward sweep (radial networks)<br>
              <code class="docs-code">"gs"</code> — Gauss-Seidel (slow, rarely needed)<br>
              <code class="docs-code">"dc"</code> — DC approximation (active power only, always converges)
            </td>
          </tr>
          <tr>
            <td>max_iteration</td><td>int</td><td>100</td>
            <td>Maximum Newton-Raphson iterations before declaring non-convergence.</td>
          </tr>
          <tr>
            <td>tolerance_mva</td><td>float</td><td>1e-3</td>
            <td>
              Convergence tolerance. <strong>Important:</strong> pandapower uses this value as
              per-unit (base = 100 MVA), not in physical MVA.
              <code class="docs-code">1e-3</code> corresponds to a 0.1 kVA mismatch per 100 MVA base —
              appropriate for transmission networks. Using <code class="docs-code">1.0</code> would allow
              a 100 MVA mismatch which is far too loose.
            </td>
          </tr>
        </tbody>
      </table>
      <p class="docs-p"><strong>Returns:</strong> <code class="docs-code">self</code> (for chaining).</p>
      <p class="docs-p"><strong>Raises:</strong> <code class="docs-code">RuntimeError</code> if called before a network is loaded.</p>
      <pre class="docs-pre"><code class="language-python"># Chained usage
grid = KSEGrid.from_matpower_case("case.m").run_powerflow()

# With custom parameters
grid.run_powerflow(algorithm="nr", max_iteration=50, tolerance_mva=1e-4)

# Check convergence on net directly
print(grid.net.converged)  # True / False</code></pre>

      <!-- report -->
      <h2 class="docs-h2">grid.report()</h2>
      <div class="docs-signature">report() -> KSEGrid</div>
      <p class="docs-p">
        Print a formatted load-flow summary to the terminal. Returns
        <code class="docs-code">self</code> for chaining. Has no effect if load flow did not converge —
        prints a warning instead.
      </p>
      <p class="docs-p">The report consists of four sections:</p>
      <table class="docs-table">
        <thead><tr><th>Section</th><th>Content</th></tr></thead>
        <tbody>
          <tr><td>POWER BALANCE</td><td>Total generation (PV buses), slack injection, total load, total losses in MW.</td></tr>
          <tr><td>VOLTAGES — largest deviations</td><td>Top 10 buses sorted by |U − 1.0| p.u., showing voltage magnitude and angle. Buses outside ±5 % are flagged with ⚠️.</td></tr>
          <tr><td>LINES — TOP 10</td><td>Top 10 lines by loading percent, with active power flow and thermal loading. Lines over 80 % flagged.</td></tr>
          <tr><td>TRANSFORMERS</td><td>Top 10 trafos by loading percent.</td></tr>
          <tr><td>SUMMARY</td><td>Count of lines and trafos overloaded beyond 80 %. If none: ✅ No overloads.</td></tr>
        </tbody>
      </table>
      <p class="docs-p">After the table sections, <code class="docs-code">report()</code> also
      calls <code class="docs-code">voltage_violations()</code> and prints up to 20 buses outside ±5 % Un.</p>
      <pre class="docs-pre"><code class="language-python">grid.run_powerflow().report()
# ═══════════════════════════════════════════════════════════════════
#   Network model – SSE Summer Peak
# ═══════════════════════════════════════════════════════════════════
# 📊 POWER BALANCE:
#    Generation (PV):   4210.3 MW
#    Import/Slack:       312.7 MW
#    Load:              4480.1 MW
#    Losses:              42.9 MW
# ...</code></pre>

      <!-- serve -->
      <h2 class="docs-h2">grid.serve()</h2>
      <div class="docs-signature">serve(
    host: str = "127.0.0.1",
    port: int = 8050,
    auto_open: bool = True
) -> None</div>
      <p class="docs-p">
        Start the FastAPI / Uvicorn web server and optionally open the browser.
        This call <strong>blocks</strong> until the server is stopped with
        <code class="docs-code">Ctrl+C</code>.
      </p>
      <table class="docs-table">
        <thead><tr><th>Parameter</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td>host</td><td>str</td><td>"127.0.0.1"</td><td>Bind address. Use <code class="docs-code">"0.0.0.0"</code> to expose on all interfaces (e.g. in Docker).</td></tr>
          <tr><td>port</td><td>int</td><td>8050</td><td>TCP port. Must be free.</td></tr>
          <tr><td>auto_open</td><td>bool</td><td>True</td><td>Open the default browser to <code class="docs-code">http://host:port/</code> after the server starts.</td></tr>
        </tbody>
      </table>
      <p class="docs-p"><strong>Raises:</strong> <code class="docs-code">RuntimeError</code> if called before a network is loaded.</p>

      <!-- Properties -->
      <h2 class="docs-h2">Properties</h2>
      <table class="docs-table">
        <thead><tr><th>Name</th><th>Type</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td>net</td><td>pandapowerNet | None</td><td>The underlying pandapower network. <code class="docs-code">None</code> until <code class="docs-code">from_matpower_case()</code> or <code class="docs-code">new_empty()</code> is called. All standard pandapower functions (runpp, create_bus, etc.) operate on this object.</td></tr>
          <tr><td>_converged</td><td>bool</td><td>True if the last <code class="docs-code">run_powerflow()</code> call converged. Read-only by convention.</td></tr>
          <tr><td>_runner</td><td>PowerFlowRunner | None</td><td>The PowerFlowRunner instance created by <code class="docs-code">run_powerflow()</code>. Exposes low-level result access if needed.</td></tr>
        </tbody>
      </table>

      <!-- Full example -->
      <h2 class="docs-h2">Full example</h2>
      <pre class="docs-pre"><code class="language-python">import kse_grid, pandapower as pp

# Load, solve, report, serve
grid = (
    kse_grid.KSEGrid
    .from_matpower_case("data/examples/sse_summer_peak.m")
    .run_powerflow(algorithm="nr", tolerance_mva=1e-3)
)
grid.report()

# Access pandapower results directly
net = grid.net
print(net.res_bus.sort_values("vm_pu").head(5))
print(net.res_line[["loading_percent"]].describe())

# Modify and re-run
net.load.at[0, "p_mw"] *= 1.10   # increase load at bus 0 by 10 %
pp.runpp(net)
print(f"Losses after increase: {net.res_line.pl_mw.sum():.1f} MW")

grid.serve(port=8050)</code></pre>
    </template>

    <!-- ════════════════════════════════════ API: PowerFlowRunner ══ -->
    <template v-else-if="currentSection === 'api-powerflowrunner'">
      <h1 class="docs-h1">PowerFlowRunner</h1>
      <p class="docs-lead">
        Low-level facade that wraps the island-aware power flow engine and the terminal reporter.
        Use this when you already have a <code class="docs-code">pandapowerNet</code> object and
        don't need the full <code class="docs-code">KSEGrid</code> pipeline, or when you want to
        access convergence results programmatically.
      </p>
      <pre class="docs-pre"><code class="language-python">from kse_grid import PowerFlowRunner
import pandapower as pp

net = pp.from_json("network.json")
runner = PowerFlowRunner(net)

if runner.run():
    runner.summary()
    violations = runner.voltage_violations()
    print(f"{len(violations)} buses outside ±5 % Un")</code></pre>

      <h2 class="docs-h2">PowerFlowRunner(net)</h2>
      <div class="docs-signature">__init__(net: pandapowerNet) -> None</div>
      <p class="docs-p">Attach the runner to an existing pandapower network. The network object is stored by reference — results are written back into <code class="docs-code">net.res_bus</code>, <code class="docs-code">net.res_line</code>, etc. after <code class="docs-code">run()</code>.</p>

      <h2 class="docs-h2">runner.run()</h2>
      <div class="docs-signature">run(
    algorithm: str = "nr",
    max_iteration: int = 100,
    tolerance_mva: float = 1e-6
) -> bool</div>
      <p class="docs-p">Execute the island-aware load flow. The solver decomposes the network into connected islands, runs a separate power flow on each energised island (one with an ext_grid), and aggregates the results. Returns <code class="docs-code">True</code> if <em>all</em> energised islands converged.</p>
      <table class="docs-table">
        <thead><tr><th>Parameter</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td>algorithm</td><td>str</td><td>"nr"</td><td>Same as <code class="docs-code">KSEGrid.run_powerflow()</code>.</td></tr>
          <tr><td>max_iteration</td><td>int</td><td>100</td><td>Per-island iteration limit.</td></tr>
          <tr><td>tolerance_mva</td><td>float</td><td>1e-6</td><td>Convergence tolerance (per-unit). Note the tighter default here vs KSEGrid.</td></tr>
        </tbody>
      </table>
      <p class="docs-p"><strong>Returns:</strong> <code class="docs-code">True</code> if all energised islands converged, <code class="docs-code">False</code> otherwise. Prints a warning message on non-convergence.</p>

      <h2 class="docs-h2">runner.summary()</h2>
      <div class="docs-signature">summary() -> None</div>
      <p class="docs-p">Print a human-readable load-flow summary to the terminal. Equivalent to calling <code class="docs-code">grid.report()</code> on a <code class="docs-code">KSEGrid</code>. Requires that <code class="docs-code">run()</code> was called first and returned <code class="docs-code">True</code>.</p>

      <h2 class="docs-h2">runner.voltage_violations()</h2>
      <div class="docs-signature">voltage_violations() -> pandas.DataFrame</div>
      <p class="docs-p">Return a DataFrame of buses whose voltage magnitude is outside the ±5 % nominal band (0.95 – 1.05 p.u.).</p>
      <p class="docs-p"><strong>Columns returned:</strong></p>
      <table class="docs-table">
        <thead><tr><th>Column</th><th>Type</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td>vm_pu</td><td>float</td><td>Voltage magnitude in per-unit.</td></tr>
          <tr><td>name</td><td>str</td><td>Bus name from <code class="docs-code">net.bus["name"]</code>.</td></tr>
          <tr><td>vn_kv</td><td>float</td><td>Nominal voltage in kV.</td></tr>
        </tbody>
      </table>
      <pre class="docs-pre"><code class="language-python">violations = runner.voltage_violations()
if not violations.empty:
    print(violations.sort_values("vm_pu"))
    # Index = bus id, vm_pu column shows the violating voltage</code></pre>
    </template>

    <!-- ════════════════════════════════════ API: SwitchingSession ══ -->
    <template v-else-if="currentSection === 'api-switchingsession'">
      <h1 class="docs-h1">SwitchingSession</h1>
      <p class="docs-lead">
        Stateful session that manages an interactive working copy of the network.
        The web server creates one session per loaded network and routes every
        topology-mutating request through it.
      </p>

      <h2 class="docs-h2">Working model</h2>
      <p class="docs-p">
        <code class="docs-code">SwitchingSession</code> maintains two copies of the network:
      </p>
      <table class="docs-table">
        <thead><tr><th>Attribute</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code class="docs-code">base_net</code></td><td>Read-only baseline — the network as imported. Reset reverts the working copy to this state.</td></tr>
          <tr><td><code class="docs-code">working_net</code></td><td>Mutable copy on which all changes (switch toggles, parameter edits, element creation/deletion) are staged.</td></tr>
        </tbody>
      </table>
      <div class="docs-note">
        Every mutation is applied to a <code class="docs-code">deepcopy</code> of
        <code class="docs-code">working_net</code>. If the mutator raises an exception
        the original <code class="docs-code">working_net</code> is left untouched.
        Results are cleared after each change and re-computed only on an explicit
        <code class="docs-code">recalculate()</code> call.
      </div>
      <pre class="docs-pre"><code class="language-python">from kse_grid import SwitchingSession, load_matpower_case

net = load_matpower_case("case.m")
session = SwitchingSession(net)</code></pre>

      <!-- build_payload -->
      <h2 class="docs-h2">session.build_payload()</h2>
      <div class="docs-signature">build_payload() -> dict</div>
      <p class="docs-p">Return the full serialised network state consumed by the frontend.
      Includes buses, lines, trafos, switches, loads, generators, ext_grids, shunts,
      graph positions, power-flow results (if available), power balance totals, diagnostics,
      and the session state flags.</p>

      <!-- get_element_params -->
      <h2 class="docs-h2">session.get_element_params()</h2>
      <div class="docs-signature">get_element_params(kind: str, element_id: int) -> dict</div>
      <p class="docs-p">Return current editable parameters for one element, formatted
      for the frontend edit form (field name, label, type, current value, unit, allowed options).</p>
      <pre class="docs-pre"><code class="language-python">params = session.get_element_params("line", 0)
# {"fields": [{"name": "max_i_ka", "label": "I max", "type": "float", ...}, ...]}</code></pre>

      <!-- update_element -->
      <h2 class="docs-h2">session.update_element()</h2>
      <div class="docs-signature">update_element(
    kind: str,
    element_id: int,
    fields: dict[str, Any]
) -> dict</div>
      <p class="docs-p">Stage a parameter change. Clears load flow results and sets the pending-recalc flag.
      Returns a slim topology-update payload that includes a <code class="docs-code">changedElement</code>
      key so the frontend can patch its local state without a full reload.</p>
      <pre class="docs-pre"><code class="language-python">update = session.update_element("line", 0, {"max_i_ka": 1.5, "name": "Line 400A"})
# Returns: {"topology": {..., "pendingRecalc": True}, "changedElement": {...}}</code></pre>

      <!-- create_element -->
      <h2 class="docs-h2">session.create_element()</h2>
      <div class="docs-signature">create_element(kind: str, fields: dict[str, Any]) -> dict</div>
      <p class="docs-p">Add a new element to the working network. Validates required fields before mutating.
      For lines and transformers, also re-seeds operational switches from branch status.
      The base network is updated immediately (the element persists through Reset).
      Graph layout is recomputed.</p>
      <p class="docs-p"><strong>Returns:</strong> <code class="docs-code">{"newElementId": int, "topologyUpdate": dict}</code></p>
      <p class="docs-p"><strong>Raises:</strong> <code class="docs-code">ValueError</code> if required fields are missing or have invalid values.</p>

      <!-- delete_element -->
      <h2 class="docs-h2">session.delete_element()</h2>
      <div class="docs-signature">delete_element(kind: str, element_id: int) -> dict</div>
      <p class="docs-p">Remove an element from the working network. The base network is updated
      immediately. Graph layout is recomputed.</p>
      <p class="docs-p"><strong>Raises:</strong> <code class="docs-code">KeyError</code> if the element does not exist.</p>

      <!-- set_switch_state -->
      <h2 class="docs-h2">session.set_switch_state()</h2>
      <div class="docs-signature">set_switch_state(switch_id: int, closed: bool) -> dict</div>
      <p class="docs-p">Open or close a single switch. Clears load flow results and sets the pending-recalc flag.
      Returns a slim topology-update payload.</p>
      <pre class="docs-pre"><code class="language-python">update = session.set_switch_state(3, closed=False)  # open switch #3</code></pre>

      <!-- recalculate -->
      <h2 class="docs-h2">session.recalculate()</h2>
      <div class="docs-signature">recalculate() -> dict</div>
      <p class="docs-p">Run load flow on the current working network. Uses the same algorithm / tolerance /
      max_iteration stored from the last <code class="docs-code">run_powerflow()</code> call.
      Returns the full updated network payload.</p>

      <!-- is_pending -->
      <h2 class="docs-h2">session.is_pending()</h2>
      <div class="docs-signature">is_pending() -> bool</div>
      <p class="docs-p">Return <code class="docs-code">True</code> if any topology change has been staged
      since the last load flow run, meaning the displayed results may be stale.
      The frontend uses this flag to show the "pending recalc" indicator in the header.
      Returns <code class="docs-code">False</code>.</p>

      <!-- reset -->
      <h2 class="docs-h2">session.reset()</h2>
      <div class="docs-signature">reset() -> dict</div>
      <p class="docs-p">Restore the working network to <code class="docs-code">base_net</code>
      (reversing all switch toggles and parameter changes since the last
      <code class="docs-code">create_element</code> / <code class="docs-code">delete_element</code> call)
      and re-run load flow. Returns the full network payload.</p>

      <!-- field_schema -->
      <h2 class="docs-h2">SwitchingSession.field_schema()</h2>
      <div class="docs-signature">@staticmethod
field_schema() -> dict[str, list[dict]]</div>
      <p class="docs-p">Return the schema of editable fields for every element kind.
      Each field entry has: <code class="docs-code">name</code>, <code class="docs-code">label</code>,
      <code class="docs-code">type</code> (str/float/int/bool/enum), <code class="docs-code">unit</code>,
      <code class="docs-code">options</code> (enum only), <code class="docs-code">description</code>.</p>

      <!-- build_update_payload -->
      <h2 class="docs-h2">session.build_update_payload()</h2>
      <div class="docs-signature">build_update_payload(
    changed_element: tuple[str, int] | None = None
) -> dict</div>
      <p class="docs-p">Return a slim payload after a switch toggle or parameter change.
      Omits graph-layout data so the frontend can patch its existing state without
      discarding manual node positions or line breakpoints.
      Optionally includes re-serialised data for a single changed element.</p>

      <h2 class="docs-h2">Element kinds</h2>
      <table class="docs-table">
        <thead><tr><th>kind</th><th>pandapower table</th><th>Creatable</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td>bus</td><td>net.bus</td><td>✓</td><td>Buses / busbars</td></tr>
          <tr><td>line</td><td>net.line</td><td>✓</td><td>Transmission lines and cables</td></tr>
          <tr><td>trafo</td><td>net.trafo</td><td>✓</td><td>Two-winding transformers</td></tr>
          <tr><td>gen</td><td>net.gen</td><td>✓</td><td>Synchronous generators (PV buses)</td></tr>
          <tr><td>load</td><td>net.load</td><td>✓</td><td>Constant-power loads (PQ)</td></tr>
          <tr><td>sgen</td><td>net.sgen</td><td>✓</td><td>Static generators (wind, PV)</td></tr>
          <tr><td>ext_grid</td><td>net.ext_grid</td><td>✓</td><td>External grid / slack bus (PQ-ref)</td></tr>
          <tr><td>shunt</td><td>net.shunt</td><td>✓</td><td>Shunt capacitors / reactors</td></tr>
          <tr><td>switch</td><td>net.switch</td><td>✗</td><td>Breakers / disconnectors (auto-seeded from line/trafo status)</td></tr>
        </tbody>
      </table>
    </template>

    <!-- ════════════════════════════════════ API: load_matpower_case ══ -->
    <template v-else-if="currentSection === 'api-load-matpower'">
      <h1 class="docs-h1">load_matpower_case</h1>
      <p class="docs-lead">
        Standalone function that converts a MATPOWER <code class="docs-code">.m</code> file
        directly into a <code class="docs-code">pandapowerNet</code>. Use this when you want
        the raw pandapower object without the <code class="docs-code">KSEGrid</code> wrapper.
      </p>
      <div class="docs-signature">load_matpower_case(
    case_file: str | pathlib.Path,
    f_hz: int = 50
) -> pandapowerNet</div>

      <h2 class="docs-h2">Pipeline</h2>
      <p class="docs-p">The function executes the following steps in order:</p>
      <ol class="docs-list" style="list-style:decimal;padding-left:1.5rem;">
        <li style="padding-left:0"><strong>Parse</strong> — <code class="docs-code">matpowercaseframes</code> reads and tokenises the MATLAB function syntax of the <code class="docs-code">.m</code> file.</li>
        <li style="padding-left:0"><strong>Convert</strong> — <code class="docs-code">pandapower.converter.from_mpc()</code> converts <code class="docs-code">mpc.bus</code>, <code class="docs-code">mpc.gen</code>, <code class="docs-code">mpc.branch</code> tables into pandapower DataFrames.</li>
        <li style="padding-left:0"><strong>Normalise names</strong> — buses, lines and trafos with empty names get generated labels based on voltage level and index (e.g. <code class="docs-code">Bus_400_0</code>).</li>
        <li style="padding-left:0"><strong>Promote branches</strong> — MATPOWER branches connecting buses at different nominal voltages are re-classified as transformers.</li>
        <li style="padding-left:0"><strong>Seed switches</strong> — operational switches are created from branches with <code class="docs-code">status=0</code>, enabling topological control in the session.</li>
        <li style="padding-left:0"><strong>Load GeoJSON sidecar</strong> — if a <code class="docs-code">.geojson</code> file with the same base name exists next to the <code class="docs-code">.m</code> file, its coordinates are written into <code class="docs-code">net.bus_geodata</code>.</li>
      </ol>

      <h2 class="docs-h2">Parameters</h2>
      <table class="docs-table">
        <thead><tr><th>Parameter</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td>case_file</td><td>str | Path</td><td>—</td><td>Path to the MATPOWER <code class="docs-code">.m</code> file.</td></tr>
          <tr><td>f_hz</td><td>int</td><td>50</td><td>System frequency in Hz.</td></tr>
        </tbody>
      </table>
      <p class="docs-p"><strong>Returns:</strong> a fully-populated <code class="docs-code">pandapowerNet</code>.
      <code class="docs-code">net.bus_geodata</code> is populated if a sidecar was found.</p>
    </template>

    <!-- ════════════════════════════════════ REST: Network ══ -->
    <template v-else-if="currentSection === 'rest-network'">
      <h1 class="docs-h1">REST API — Network</h1>

      <div class="docs-endpoint">
        <div class="docs-endpoint-header">
          <span class="docs-badge docs-badge-get">GET</span>
          <span class="docs-endpoint-url">/api/network</span>
          <span class="docs-endpoint-desc">Full network state</span>
        </div>
        <div class="docs-endpoint-body">
          <p class="docs-p">Returns the complete serialised network payload. This is the same object the frontend fetches on startup.</p>
          <pre class="docs-pre"><code class="language-bash">curl http://127.0.0.1:8050/api/network</code></pre>
          <table class="docs-table">
            <thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td>name</td><td>string</td><td>Case name from net.name</td></tr>
              <tr><td>isEmpty</td><td>bool</td><td>True if no buses exist</td></tr>
              <tr><td>hasResults</td><td>bool</td><td>True if a load flow has been run</td></tr>
              <tr><td>buses</td><td>array</td><td>Serialised bus list with optional load flow results (vmPu, vaDeg)</td></tr>
              <tr><td>lines</td><td>array</td><td>Serialised lines with loading percent</td></tr>
              <tr><td>trafos</td><td>array</td><td>Serialised transformers with loading percent</td></tr>
              <tr><td>switches</td><td>array</td><td>Operational switches with closed/open state</td></tr>
              <tr><td>loads / gens / extGrids / shunts / sgens</td><td>array</td><td>Other element lists</td></tr>
              <tr><td>stats</td><td>object</td><td>Counts: nBus, nLine, nTrafo, nSwitch, …</td></tr>
              <tr><td>totals</td><td>object</td><td>Power balance: loadMw, generationMw, slackMw, lossesMw, lossPct, qLoadMvar, …</td></tr>
              <tr><td>diagnostics</td><td>object</td><td>voltage.{minPu, maxPu, minBusName, maxBusName}, loading.{maxPct, maxName, maxId, maxKind}</td></tr>
              <tr><td>topology</td><td>object</td><td>islands, lastRunSucceeded, pendingRecalc, pendingChangeCount, powerflowOptions</td></tr>
              <tr><td>positions</td><td>object</td><td>Graph positions: {"0": [x, y], "1": [x, y], …}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="docs-endpoint">
        <div class="docs-endpoint-header">
          <span class="docs-badge docs-badge-post">POST</span>
          <span class="docs-endpoint-url">/api/network/upload</span>
          <span class="docs-endpoint-desc">Upload and load a network file</span>
        </div>
        <div class="docs-endpoint-body">
          <p class="docs-p">Upload a <code class="docs-code">.m</code> (MATPOWER) or <code class="docs-code">.json</code> (pandapower JSON) file. Format is auto-detected from content. On success, creates a new session and returns the full network payload.</p>
          <pre class="docs-pre"><code class="language-bash">curl -X POST http://127.0.0.1:8050/api/network/upload \
  -F "file=@path/to/case.m"</code></pre>
        </div>
      </div>

      <div class="docs-endpoint">
        <div class="docs-endpoint-header">
          <span class="docs-badge docs-badge-post">POST</span>
          <span class="docs-endpoint-url">/api/network/new</span>
          <span class="docs-endpoint-desc">Reset to empty network</span>
        </div>
        <div class="docs-endpoint-body">
          <p class="docs-p">Discards the current session and creates a fresh empty network. Returns the full network payload (isEmpty: true).</p>
          <pre class="docs-pre"><code class="language-bash">curl -X POST http://127.0.0.1:8050/api/network/new</code></pre>
        </div>
      </div>

      <div class="docs-endpoint">
        <div class="docs-endpoint-header">
          <span class="docs-badge docs-badge-post">POST</span>
          <span class="docs-endpoint-url">/api/topology/reset</span>
          <span class="docs-endpoint-desc">Revert all topology changes</span>
        </div>
        <div class="docs-endpoint-body">
          <p class="docs-p">Restores the working network to the baseline state (reverting switch changes and parameter edits since the last create/delete) and re-runs load flow. Returns full payload.</p>
          <pre class="docs-pre"><code class="language-bash">curl -X POST http://127.0.0.1:8050/api/topology/reset</code></pre>
        </div>
      </div>
    </template>

    <!-- ════════════════════════════════════ REST: Elements ══ -->
    <template v-else-if="currentSection === 'rest-elements'">
      <h1 class="docs-h1">REST API — Elements</h1>

      <div class="docs-endpoint">
        <div class="docs-endpoint-header">
          <span class="docs-badge docs-badge-get">GET</span>
          <span class="docs-endpoint-url">/api/elements/{kind}/{id}</span>
          <span class="docs-endpoint-desc">Get editable parameters</span>
        </div>
        <div class="docs-endpoint-body">
          <pre class="docs-pre"><code class="language-bash">curl http://127.0.0.1:8050/api/elements/line/0</code></pre>
        </div>
      </div>

      <div class="docs-endpoint">
        <div class="docs-endpoint-header">
          <span class="docs-badge docs-badge-patch">PATCH</span>
          <span class="docs-endpoint-url">/api/elements/{kind}/{id}</span>
          <span class="docs-endpoint-desc">Update element parameters</span>
        </div>
        <div class="docs-endpoint-body">
          <p class="docs-p">Body: <code class="docs-code">{"fields": {"column_name": value, …}}</code>. Marks load flow as pending.</p>
          <pre class="docs-pre"><code class="language-bash">curl -X PATCH http://127.0.0.1:8050/api/elements/line/0 \
  -H "Content-Type: application/json" \
  -d '{"fields": {"max_i_ka": 1.2, "name": "Line 400 kV NW"}}'</code></pre>
        </div>
      </div>

      <div class="docs-endpoint">
        <div class="docs-endpoint-header">
          <span class="docs-badge docs-badge-post">POST</span>
          <span class="docs-endpoint-url">/api/elements/{kind}?format=pandapower</span>
          <span class="docs-endpoint-desc">Create element</span>
        </div>
        <div class="docs-endpoint-body">
          <p class="docs-p"><code class="docs-code">format</code> query param: <code class="docs-code">pandapower</code> (default) or <code class="docs-code">matpower</code>.</p>
          <pre class="docs-pre"><code class="language-bash">curl -X POST "http://127.0.0.1:8050/api/elements/bus?format=pandapower" \
  -H "Content-Type: application/json" \
  -d '{"fields": {"name": "Bus 400 kV", "vn_kv": 400, "type": "b"}}'</code></pre>
        </div>
      </div>

      <div class="docs-endpoint">
        <div class="docs-endpoint-header">
          <span class="docs-badge docs-badge-delete">DELETE</span>
          <span class="docs-endpoint-url">/api/elements/{kind}/{id}</span>
          <span class="docs-endpoint-desc">Delete element</span>
        </div>
        <div class="docs-endpoint-body">
          <pre class="docs-pre"><code class="language-bash">curl -X DELETE http://127.0.0.1:8050/api/elements/load/2</code></pre>
        </div>
      </div>

      <div class="docs-endpoint">
        <div class="docs-endpoint-header">
          <span class="docs-badge docs-badge-get">GET</span>
          <span class="docs-endpoint-url">/api/elements/schema</span>
          <span class="docs-endpoint-desc">Editable field schema</span>
        </div>
        <div class="docs-endpoint-body">
          <p class="docs-p">Returns the complete editable-field schema for every element kind. Used by the element inspector to build forms.</p>
          <pre class="docs-pre"><code class="language-bash">curl http://127.0.0.1:8050/api/elements/schema</code></pre>
        </div>
      </div>

      <div class="docs-endpoint">
        <div class="docs-endpoint-header">
          <span class="docs-badge docs-badge-get">GET</span>
          <span class="docs-endpoint-url">/api/elements/create-schema</span>
          <span class="docs-endpoint-desc">Creation field schema</span>
        </div>
        <div class="docs-endpoint-body">
          <p class="docs-p">Returns required and optional fields for creating each element type, in both pandapower and MATPOWER format variants. Used by Grid Builder.</p>
          <pre class="docs-pre"><code class="language-bash">curl http://127.0.0.1:8050/api/elements/create-schema</code></pre>
        </div>
      </div>

      <div class="docs-endpoint">
        <div class="docs-endpoint-header">
          <span class="docs-badge docs-badge-patch">PATCH</span>
          <span class="docs-endpoint-url">/api/switches/{id}</span>
          <span class="docs-endpoint-desc">Toggle switch state</span>
        </div>
        <div class="docs-endpoint-body">
          <pre class="docs-pre"><code class="language-bash">curl -X PATCH http://127.0.0.1:8050/api/switches/0 \
  -H "Content-Type: application/json" \
  -d '{"closed": false}'</code></pre>
        </div>
      </div>
    </template>

    <!-- ════════════════════════════════════ REST: Power flow ══ -->
    <template v-else-if="currentSection === 'rest-powerflow'">
      <h1 class="docs-h1">REST API — Power flow</h1>

      <div class="docs-endpoint">
        <div class="docs-endpoint-header">
          <span class="docs-badge docs-badge-post">POST</span>
          <span class="docs-endpoint-url">/api/powerflow/recalculate</span>
          <span class="docs-endpoint-desc">Re-run load flow</span>
        </div>
        <div class="docs-endpoint-body">
          <p class="docs-p">Executes the island-aware AC load flow on the current working network.
          Uses the same algorithm and tolerance as the initial run.
          Returns the full updated network payload with fresh <code class="docs-code">res_bus</code>,
          <code class="docs-code">res_line</code>, <code class="docs-code">res_trafo</code> results.</p>
          <pre class="docs-pre"><code class="language-bash">curl -X POST http://127.0.0.1:8050/api/powerflow/recalculate</code></pre>
          <p class="docs-p">On failure the response still has <code class="docs-code">200 OK</code> but
          <code class="docs-code">topology.lastRunSucceeded</code> is <code class="docs-code">false</code>
          and <code class="docs-code">topology.lastRunMessage</code> describes the problem.</p>
        </div>
      </div>
    </template>

    <!-- ════════════════════════════════════ REST: Export ══ -->
    <template v-else-if="currentSection === 'rest-export'">
      <h1 class="docs-h1">REST API — Export</h1>

      <div class="docs-endpoint">
        <div class="docs-endpoint-header">
          <span class="docs-badge docs-badge-get">GET</span>
          <span class="docs-endpoint-url">/api/network/export/json</span>
          <span class="docs-endpoint-desc">Export as pandapower JSON</span>
        </div>
        <div class="docs-endpoint-body">
          <p class="docs-p">Triggers a file download of the current working network in pandapower JSON format. The file can be re-uploaded to the app or loaded with <code class="docs-code">pandapower.from_json()</code>.</p>
          <pre class="docs-pre"><code class="language-bash">curl http://127.0.0.1:8050/api/network/export/json -o network.json</code></pre>
        </div>
      </div>

      <div class="docs-endpoint">
        <div class="docs-endpoint-header">
          <span class="docs-badge docs-badge-get">GET</span>
          <span class="docs-endpoint-url">/api/network/export/matpower</span>
          <span class="docs-endpoint-desc">Export as MATPOWER .m</span>
        </div>
        <div class="docs-endpoint-body">
          <p class="docs-p">Triggers a file download in MATPOWER case format with aligned columns. Compatible with MATPOWER, PowerWorld, PSS/E import scripts, and other tools that accept the MATPOWER format.</p>
          <pre class="docs-pre"><code class="language-bash">curl http://127.0.0.1:8050/api/network/export/matpower -o case_out.m</code></pre>
        </div>
      </div>
    </template>

    <!-- ════════════════════════════════════ UI: Landing ══ -->
    <template v-else-if="currentSection === 'ui-landing'">
      <h1 class="docs-h1">Landing page</h1>
      <p class="docs-lead">
        The landing page is the first screen when the app starts. It appears whenever the network
        is reset to empty and offers three entry points.
      </p>

      <h2 class="docs-h2">Wczytaj plik — Load a case file</h2>
      <p class="docs-p">Click the tile to open the native file picker.
      Accepted formats: <code class="docs-code">.m</code> (MATPOWER) and
      <code class="docs-code">.json</code> (pandapower JSON).
      The format is auto-detected from file content, not extension.</p>
      <p class="docs-p">After the file is selected:</p>
      <ol class="docs-list" style="list-style:decimal;padding-left:1.5rem;">
        <li style="padding-left:0">The file is uploaded to the server via <code class="docs-code">POST /api/network/upload</code>.</li>
        <li style="padding-left:0">The server parses the file, normalises the network, and attempts AC load flow.</li>
        <li style="padding-left:0">On success, the app transitions to the graph view.</li>
        <li style="padding-left:0">A progress overlay shows the upload and processing phases.</li>
      </ol>
      <p class="docs-p">If load flow fails (non-convergence), the graph view still opens and shows the network topology without result colours. An error message appears in the header area.</p>

      <h2 class="docs-h2">Nowa sieć — Grid Builder</h2>
      <p class="docs-p">Opens the Grid Builder with an empty pandapower network.
      No file is required. You can build the network element by element and switch to
      the graph view at any time using <strong>Przelicz i pokaż graf</strong>.</p>

      <h2 class="docs-h2">Dokumentacja</h2>
      <p class="docs-p">Opens this documentation page. The app state is preserved — clicking
      <strong>Back to app</strong> returns exactly where you left off.</p>

      <h2 class="docs-h2">Theme toggle</h2>
      <p class="docs-p">The sun / moon button in the top-right corner switches between the dark
      (default) and light theme. The choice is persisted in
      <code class="docs-code">localStorage</code> and restored on the next visit.</p>
    </template>

    <!-- ════════════════════════════════════ UI: View modes ══ -->
    <template v-else-if="currentSection === 'ui-views'">
      <h1 class="docs-h1">View modes</h1>
      <p class="docs-lead">
        Three view modes are available from the toggle in the top bar:
        <strong>Graf</strong>, <strong>OSM</strong>, and <strong>Atlas</strong>.
        The active mode is underlined. Switching modes preserves the selected element and all filters.
      </p>

      <h2 class="docs-h2">Graf — Topological graph</h2>
      <p class="docs-p">Rendered with PixiJS using the Fruchterman-Reingold spring-layout algorithm.
      Buses at the same voltage level connected by a transformer are grouped and placed close together.
      The layout is computed once when the network loads and is stable — it does not change on switch toggles.</p>
      <table class="docs-table">
        <thead><tr><th>Visual encoding</th><th>Meaning</th></tr></thead>
        <tbody>
          <tr><td>Bus colour</td><td>Voltage level (400 kV = red, 220 kV = orange, 110 kV = blue, other = grey)</td></tr>
          <tr><td>Bus size</td><td>Fixed, slightly larger for buses with load flow violations</td></tr>
          <tr><td>Line colour</td><td>Loading: green &lt; 60 %, yellow 60–80 %, orange 80–100 %, red &gt; 100 %</td></tr>
          <tr><td>Line thickness</td><td>Thicker for higher voltage levels</td></tr>
          <tr><td>Open switch</td><td>Gap in the line at the switch location</td></tr>
        </tbody>
      </table>
      <p class="docs-p"><strong>Mouse / touch interaction:</strong></p>
      <ul class="docs-list">
        <li>Click a bus or line/trafo to select it and open the element inspector.</li>
        <li>Scroll or pinch to zoom. Drag the canvas to pan.</li>
        <li>In <em>Edit mode</em> (Edycja WŁ), drag a bus to reposition it — positions persist in the session.</li>
        <li>Press <code class="docs-code">R</code> to reset the viewport to fit all elements.</li>
        <li>Press <code class="docs-code">Esc</code> to deselect the active element.</li>
      </ul>

      <h2 class="docs-h2">OSM — Geographic map</h2>
      <div class="docs-note">
        <strong>Requires a GeoJSON sidecar.</strong> The OSM button is disabled unless the loaded
        network has WGS84 coordinates in <code class="docs-code">net.bus_geodata</code>.
        For MATPOWER <code class="docs-code">.m</code> files (which carry no geographic data),
        you must supply a <code class="docs-code">.geojson</code> sidecar with the same base name
        placed next to the <code class="docs-code">.m</code> file — see
        <strong>Data formats → GeoJSON sidecar</strong> for the format and naming convention.
        pandapower JSON files may already contain coordinates if they were exported with
        <code class="docs-code">bus_geodata</code> populated.
      </div>
      <p class="docs-p">Renders the network on an OpenStreetMap base layer using Plotly's
      <code class="docs-code">scattermapbox</code>. Pan and zoom work natively. Clicking a bus
      or line opens the same element inspector as the graph view.</p>

      <h2 class="docs-h2">Atlas — KSE 2019 overlay</h2>
      <p class="docs-p">Renders the loaded network on top of the KSE 2019 reference atlas
      (embedded GeoJSON snapshot of the Polish transmission and distribution system).
      Useful for verifying that a model's topology matches the real network or for locating
      substations geographically.</p>
      <p class="docs-p">Atlas layers can be toggled in the sidebar:</p>
      <table class="docs-table">
        <thead><tr><th>Layer</th><th>Coverage</th><th>Default colour</th></tr></thead>
        <tbody>
          <tr><td>HV transmission (OSP)</td><td>400 kV and 220 kV TSO lines</td><td>Red</td></tr>
          <tr><td>110 kV distribution (OSD)</td><td>110 kV DSO lines</td><td>Blue</td></tr>
          <tr><td>JW / unit lines</td><td>Generator connection lines</td><td>Grey</td></tr>
        </tbody>
      </table>
    </template>

    <!-- ════════════════════════════════════ UI: Filters ══ -->
    <template v-else-if="currentSection === 'ui-filters'">
      <h1 class="docs-h1">Sidebar &amp; filters</h1>
      <p class="docs-lead">
        The left sidebar collapses and expands with the chevron buttons.
        It hosts all filters, diagnostics, and the bus search. Changes are
        applied instantly and persisted in <code class="docs-code">localStorage</code>.
      </p>

      <h2 class="docs-h2">Bus search</h2>
      <p class="docs-p">Type a bus name or partial ID into the search field.
      The graph pans and zooms to the matching bus and selects it.
      Useful in large networks (100+ buses) where clicking directly is impractical.</p>

      <h2 class="docs-h2">Voltage levels</h2>
      <p class="docs-p">One checkbox per nominal voltage present in the network.
      Deselecting a voltage level hides all buses at that level <em>and</em> all
      lines/trafos connected exclusively to hidden buses.
      Two preset buttons speed up common views:</p>
      <ul class="docs-list">
        <li><strong>Core 400/220</strong> — show only 400 kV and 220 kV elements.</li>
        <li><strong>All</strong> — show all voltage levels.</li>
      </ul>

      <h2 class="docs-h2">Element types</h2>
      <p class="docs-p">Toggle visibility of specific element categories:
      Lines, Transformers, Buses, Breakers (switches).
      Independent of the voltage-level filter.</p>

      <h2 class="docs-h2">Power / loading filters</h2>
      <table class="docs-table">
        <thead><tr><th>Filter</th><th>Effect</th></tr></thead>
        <tbody>
          <tr><td>Min. line / trafo loading %</td><td>Hides lines and transformers whose loading is <em>below</em> the threshold. Use to declutter and focus on overloaded branches. Requires power flow results.</td></tr>
          <tr><td>Min. bus power MW</td><td>Hides buses whose peak injected power (max of P load, P gen) is below the threshold. Lines connected to hidden buses also disappear.</td></tr>
        </tbody>
      </table>

      <h2 class="docs-h2">Atlas categories (Atlas mode only)</h2>
      <p class="docs-p">When the Atlas view mode is active, additional toggles appear for
      the three KSE 2019 atlas layers (HV transmission, 110 kV distribution, JW unit lines).
      These are independent of the main element-type toggles.</p>

      <h2 class="docs-h2">Diagnostics panels</h2>
      <p class="docs-p">The sidebar has four diagnostic panels accessible via the nav list at the bottom.
      Clicking one opens it in the right panel:</p>
      <table class="docs-table">
        <thead><tr><th>Panel</th><th>Content</th></tr></thead>
        <tbody>
          <tr><td>Bilans mocy</td><td>Power balance chart: generation, load, slack injection, losses.</td></tr>
          <tr><td>Profil napięciowy</td><td>Voltage magnitude histogram of all buses by voltage level.</td></tr>
          <tr><td>Obciążenie gałęzi</td><td>Branch loading histogram. Overloaded branches highlighted.</td></tr>
          <tr><td>Łączenia / wyspy</td><td>Island detection results: which buses are in each island, which are unsupplied.</td></tr>
        </tbody>
      </table>
    </template>

    <!-- ════════════════════════════════════ UI: Inspector ══ -->
    <template v-else-if="currentSection === 'ui-inspector'">
      <h1 class="docs-h1">Element inspector</h1>
      <p class="docs-lead">
        Clicking any element on the graph opens the inspector card on the right side of the screen.
        It shows load-flow results, allows editing parameters, and controls switches.
      </p>

      <h2 class="docs-h2">Bus inspector</h2>
      <p class="docs-p">Shows: nominal voltage, bus type, voltage magnitude (p.u.) and angle (°) after load flow,
      P load / Q load totals, list of connected generators, loads, static generators, ext_grids, shunts
      — each with its own sub-card. Clicking a connected element navigates to its inspector.</p>
      <p class="docs-p">Editable fields: name, Un (kV), bus type, zone, U max / U min (p.u.), in_service.</p>

      <h2 class="docs-h2">Line inspector</h2>
      <p class="docs-p">Shows: from/to buses, voltage level, line length, parameters (R', X', C', max I ka).
      After load flow: P and Q at sending and receiving end, current (kA), loading (%).
      Switches on this line are listed with open/close buttons.</p>
      <p class="docs-p">Editable fields: name, length_km, r_ohm_per_km, x_ohm_per_km, c_nf_per_km, g_us_per_km, max_i_ka, derating factor, parallel circuits, in_service.</p>

      <h2 class="docs-h2">Transformer inspector</h2>
      <p class="docs-p">Shows: HV and LV bus names and voltages, rated power (MVA), tap settings.
      After load flow: P HV / P LV, loading (%). Disconnect / connect button toggles all switches
      on this transformer at once.</p>
      <p class="docs-p">Editable fields: name, sn_mva, vn_hv_kv, vn_lv_kv, vk_percent, vkr_percent, pfe_kw, i0_percent, shift_degree, tap_side, tap_step_percent, tap_min/max, in_service.</p>

      <h2 class="docs-h2">Switch inspector</h2>
      <p class="docs-p">Shows: switch name, state (Closed / Open), type (breaker / disconnector), connected element, remote bus. Toggle button immediately recalculates topology and runs load flow.</p>

      <h2 class="docs-h2">Editing workflow</h2>
      <ol class="docs-list" style="list-style:decimal;padding-left:1.5rem;">
        <li style="padding-left:0">Click <strong>Edytuj</strong> to open the edit form in the inspector card.</li>
        <li style="padding-left:0">Modify fields. Required fields are marked <code class="docs-code">*</code>. Each field has a <code class="docs-code">?</code> icon with a description tooltip.</li>
        <li style="padding-left:0">Click <strong>Zapisz</strong> to apply. The server stages the change and the pending-recalc indicator appears in the header.</li>
        <li style="padding-left:0">Click <strong>Przelicz rozpływ</strong> in the header to re-run load flow and update all results.</li>
        <li style="padding-left:0">Multiple changes can be batched before recalculating.</li>
      </ol>
    </template>

    <!-- ════════════════════════════════════ UI: Results bar ══ -->
    <template v-else-if="currentSection === 'ui-results-bar'">
      <h1 class="docs-h1">Results bar</h1>
      <p class="docs-lead">
        The results bar runs across the bottom of the screen after a successful load flow.
        It provides an at-a-glance summary of the most critical system conditions.
        Click it to open the full report modal.
      </p>

      <h2 class="docs-h2">Summary strip</h2>
      <table class="docs-table">
        <thead><tr><th>KPI</th><th>Description</th><th>Warning condition</th></tr></thead>
        <tbody>
          <tr><td>Straty</td><td>Total active power losses in MW and as % of total generation.</td><td>—</td></tr>
          <tr><td>U min</td><td>Minimum bus voltage in p.u. and the bus name.</td><td>Amber if &lt; 0.95 p.u.</td></tr>
          <tr><td>U max</td><td>Maximum bus voltage in p.u. and the bus name.</td><td>Amber if &gt; 1.05 p.u.</td></tr>
          <tr><td>L max</td><td>Maximum branch loading in % and the branch name.</td><td>Amber if &gt; 80 %.</td></tr>
        </tbody>
      </table>

      <h2 class="docs-h2">Full report modal</h2>
      <p class="docs-p">The modal has three columns:</p>
      <table class="docs-table">
        <thead><tr><th>Column</th><th>Content</th></tr></thead>
        <tbody>
          <tr><td>Bilans mocy</td><td>Total load (MW), total generation (MW), slack injection (MW), active losses (MW + %), reactive load / generation / slack / losses (Mvar).</td></tr>
          <tr><td>Ranking napięć</td><td>All buses sorted by ID. Shows voltage level badge, bus name, voltage in p.u. coloured by level, angle in degrees. Buses outside ±5 % are highlighted in red.</td></tr>
          <tr><td>Ranking obciążeń</td><td>Top 30 branches sorted by loading %. Shows type badge (Linia / Trafo), name, and loading %. Branches over 100 % highlighted red, over 80 % amber.</td></tr>
        </tbody>
      </table>
      <p class="docs-p">Clicking a row in the voltage or loading table selects that element in the graph and closes the modal.</p>
    </template>

    <!-- ════════════════════════════════════ UI: Grid builder ══ -->
    <template v-else-if="currentSection === 'ui-grid-builder'">
      <h1 class="docs-h1">Grid builder</h1>
      <p class="docs-lead">
        Build a power network from scratch directly in the browser.
        Access it from <strong>Nowa sieć</strong> on the landing page,
        or from <strong>Edytuj sieć</strong> in the app header.
      </p>

      <h2 class="docs-h2">Format modes</h2>
      <p class="docs-p">Two tabs at the top of the form switch the field convention:</p>
      <table class="docs-table">
        <thead><tr><th>Mode</th><th>Field names</th><th>When to use</th></tr></thead>
        <tbody>
          <tr><td>pandapower</td><td>Native pandapower names: <code class="docs-code">vn_kv</code>, <code class="docs-code">max_i_ka</code>, <code class="docs-code">sn_mva</code>, …</td><td>When you know pandapower's data model or are reading from its documentation.</td></tr>
          <tr><td>MATPOWER</td><td>MATPOWER per-unit convention: <code class="docs-code">baseKV</code>, <code class="docs-code">r_pu</code>, <code class="docs-code">rateA</code>, …</td><td>When working from MATPOWER data sheets, textbooks, or PSS/E data.</td></tr>
        </tbody>
      </table>

      <h2 class="docs-h2">Building a network — recommended order</h2>
      <ol class="docs-list" style="list-style:decimal;padding-left:1.5rem;">
        <li style="padding-left:0"><strong>Add buses</strong> — every element connects to a bus. At minimum: one bus per voltage level.</li>
        <li style="padding-left:0"><strong>Add an external grid</strong> (<code class="docs-code">ext_grid</code>) — the slack bus. Every network needs exactly one slack bus for load flow to be solvable.</li>
        <li style="padding-left:0"><strong>Add loads and generators</strong> — connect to existing bus IDs.</li>
        <li style="padding-left:0"><strong>Add lines and transformers</strong> — connect pairs of bus IDs.</li>
        <li style="padding-left:0">Click <strong>Przelicz i pokaż graf</strong> to run load flow and switch to the graph view.</li>
      </ol>

      <h2 class="docs-h2">Element tab hints</h2>
      <p class="docs-p">Each element tab shows a description card explaining the element's role in the network model, which fields are required, and how it interacts with load flow. Required fields are marked with <code class="docs-code">*</code>.</p>

      <h2 class="docs-h2">Existing elements table</h2>
      <p class="docs-p">The table above the form shows all elements of the currently selected type.
      Use the <strong>Delete</strong> button to remove an element.
      Click the element's row to select it and view it in the inspector (if you are in graph view).</p>

      <h2 class="docs-h2">Export</h2>
      <p class="docs-p">Use the export buttons in the header to download the current network:</p>
      <ul class="docs-list">
        <li><strong>Export JSON</strong> — pandapower JSON format, loadable by <code class="docs-code">pandapower.from_json()</code> or re-uploaded to the app.</li>
        <li><strong>Export MATPOWER</strong> — MATPOWER <code class="docs-code">.m</code> format, compatible with MATPOWER and other tools.</li>
      </ul>
    </template>

    <!-- ════════════════════════════════════ FORMAT: MATPOWER ══ -->
    <template v-else-if="currentSection === 'fmt-matpower'">
      <h1 class="docs-h1">Format — MATPOWER .m</h1>
      <p class="docs-lead">
        MATPOWER case files are the primary input format. The standard case structure is
        supported: <code class="docs-code">mpc.bus</code>, <code class="docs-code">mpc.gen</code>,
        <code class="docs-code">mpc.branch</code>. <code class="docs-code">mpc.gencost</code> is
        recognised but ignored.
      </p>

      <h2 class="docs-h2">Loading</h2>
      <pre class="docs-pre"><code class="language-bash">uv run python main.py path/to/case.m</code></pre>
      <pre class="docs-pre"><code class="language-python"># Python
from kse_grid import load_matpower_case
net = load_matpower_case("case.m")

# Or via KSEGrid
import kse_grid
grid = kse_grid.KSEGrid.from_matpower_case("case.m")</code></pre>

      <h2 class="docs-h2">Supported MATPOWER columns</h2>
      <table class="docs-table">
        <thead><tr><th>Table</th><th>Columns used</th></tr></thead>
        <tbody>
          <tr><td>mpc.bus</td><td>bus_i, type, Pd, Qd, Gs, Bs, area, Vm, Va, baseKV, zone, Vmax, Vmin</td></tr>
          <tr><td>mpc.gen</td><td>bus, Pg, Qg, Qmax, Qmin, Vg, mBase, status, Pmax, Pmin</td></tr>
          <tr><td>mpc.branch</td><td>fbus, tbus, r, x, b, rateA, rateB, rateC, tap, shift, status, angmin, angmax</td></tr>
        </tbody>
      </table>

      <h2 class="docs-h2">Automatic normalisation applied on import</h2>
      <ul class="docs-list">
        <li>Empty bus, line, and transformer names are auto-generated from voltage level and index.</li>
        <li>Branches with <code class="docs-code">tap ≠ 0</code> or connecting buses at different <code class="docs-code">baseKV</code> values are promoted to transformers.</li>
        <li>If no slack bus (MATPOWER type 3) exists, the first active generator is promoted to ext_grid.</li>
        <li>Branches with <code class="docs-code">status = 0</code> generate open operational switches.</li>
        <li>A <code class="docs-code">.geojson</code> sidecar with the same base name is loaded automatically if found.</li>
      </ul>

      <h2 class="docs-h2">Exporting back to MATPOWER</h2>
      <p class="docs-p">Via the UI: <strong>Export MATPOWER</strong> button in Grid Builder.</p>
      <p class="docs-p">Via REST: <code class="docs-code">GET /api/network/export/matpower</code>.</p>
      <p class="docs-p">The exporter writes aligned columns for human-readable diffs:</p>
      <pre class="docs-pre"><code class="language-matlab">function mpc = exported_network
mpc.version = '2';
mpc.baseMVA = 100;

mpc.bus = [
%%  bus_i  type   Pd     Qd   Gs   Bs  area  Vm    Va  baseKV  zone  Vmax  Vmin
    1      3      0.0    0.0  0.0  0.0  1   1.050  0.0  400     1   1.05  0.95
    ...];</code></pre>
    </template>

    <!-- ════════════════════════════════════ FORMAT: pandapower JSON ══ -->
    <template v-else-if="currentSection === 'fmt-pandapower'">
      <h1 class="docs-h1">Format — pandapower JSON</h1>
      <p class="docs-lead">
        pandapower JSON is the native serialisation format of pandapower. It preserves every
        element table, parameter, load-flow result, and network metadata in a single file.
      </p>

      <h2 class="docs-h2">Saving from pandapower</h2>
      <pre class="docs-pre"><code class="language-python">import pandapower as pp

net = pp.from_json("network.json")   # load
pp.runpp(net)
pp.to_json(net, "network_solved.json")  # save with results</code></pre>

      <h2 class="docs-h2">Loading in the app</h2>
      <p class="docs-p">Upload a <code class="docs-code">.json</code> file via the landing page or
      <code class="docs-code">POST /api/network/upload</code>. The format is detected from the file content
      (pandapower JSON has a <code class="docs-code">"_module"</code> key at the root).</p>
      <div class="docs-note">
        If the JSON file already contains valid load-flow results (non-empty
        <code class="docs-code">res_bus</code>, <code class="docs-code">net.converged = True</code>),
        the app displays them immediately without re-running load flow.
      </div>

      <h2 class="docs-h2">Key top-level keys in pandapower JSON</h2>
      <table class="docs-table">
        <thead><tr><th>Key</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td>bus, line, trafo, gen, load, …</td><td>Element DataFrames serialised as records</td></tr>
          <tr><td>res_bus, res_line, res_trafo, …</td><td>Load-flow result DataFrames</td></tr>
          <tr><td>bus_geodata</td><td>Geographic coordinates (x/y or lon/lat)</td></tr>
          <tr><td>_module, _class</td><td>pandapower version metadata</td></tr>
          <tr><td>converged</td><td>bool — whether the last load flow converged</td></tr>
        </tbody>
      </table>
    </template>

    <!-- ════════════════════════════════════ FORMAT: GeoJSON ══ -->
    <template v-else-if="currentSection === 'fmt-geojson'">
      <h1 class="docs-h1">Format — GeoJSON sidecar</h1>
      <p class="docs-lead">
        A GeoJSON sidecar attaches WGS84 geographic coordinates to buses, enabling the OSM map view.
        It is a standard GeoJSON <code class="docs-code">FeatureCollection</code> of Point features.
      </p>

      <div class="docs-note">
        <strong>The OSM view will not work without this file.</strong>
        MATPOWER <code class="docs-code">.m</code> files contain no geographic data.
        To unlock the OSM map view for a <code class="docs-code">.m</code> case, you must create a
        <code class="docs-code">.geojson</code> sidecar with WGS84 coordinates for each bus
        and place it in the same directory with the same base name.
        Without it, the <strong>OSM</strong> button in the top bar stays disabled.
      </div>

      <h2 class="docs-h2">File naming convention</h2>
      <p class="docs-p">Place the sidecar next to the <code class="docs-code">.m</code> file with
      the same base name and the <code class="docs-code">.geojson</code> extension. It is loaded
      automatically on import — no extra steps needed.</p>
      <pre class="docs-pre"><code class="language-plaintext">data/
  sse_summer_peak.m
  sse_summer_peak.geojson   ← loaded automatically</code></pre>

      <h2 class="docs-h2">Feature properties</h2>
      <p class="docs-p">Each feature must be a <code class="docs-code">Point</code> with
      <code class="docs-code">[longitude, latitude]</code> coordinates.
      Bus matching uses either:</p>
      <ul class="docs-list">
        <li><code class="docs-code">"id"</code> (integer) — direct match against the MATPOWER bus number.</li>
        <li><code class="docs-code">"name"</code> (string) — fuzzy match against bus names (Levenshtein distance).</li>
      </ul>
      <pre class="docs-pre"><code class="language-json">{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [21.01, 52.23] },
      "properties": { "id": 1, "name": "Warszawa Rozna 400" }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [16.93, 52.41] },
      "properties": { "id": 2, "name": "Poznan Plewiska 400" }
    }
  ]
}</code></pre>

      <h2 class="docs-h2">Generating sidecars</h2>
      <table class="docs-table">
        <thead><tr><th>Script</th><th>Input</th><th>Output</th></tr></thead>
        <tbody>
          <tr><td><code class="docs-code">python -m kse_grid.converters.tamu_geo</code></td><td>TAMU PowerWorld <code class="docs-code">.EPC</code></td><td>GeoJSON sidecar from TAMU geo data</td></tr>
          <tr><td><code class="docs-code">python -m kse_grid.converters.kse_kmz</code></td><td>MATPOWER <code class="docs-code">.m</code> + KSE KMZ atlas</td><td>GeoJSON sidecar via fuzzy name matching</td></tr>
        </tbody>
      </table>
      <p class="docs-p">You can also create sidecars manually or from any tool that produces GeoJSON — QGIS, geojson.io, custom scripts.</p>
    </template>

    <!-- ── Prev / Next ────────────────────────────────────── -->
    <div class="docs-pagination">
      <button v-if="prevSection()" class="docs-pagination-btn" type="button" @click="onMenuSelect(prevSection().id)">
        ← {{ prevSection().label }}
      </button>
      <span v-else></span>
      <button v-if="nextSection()" class="docs-pagination-btn docs-pagination-btn--next" type="button" @click="onMenuSelect(nextSection().id)">
        {{ nextSection().label }} →
      </button>
    </div>

        </div>
      </div>
    </div>

  </div>
</div>
`,
};
