/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/quickselect@3.0.0/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
function t(f,a,r=0,h=f.length-1,M=n){for(;h>r;){if(h-r>600){const o=h-r+1,n=a-r+1,c=Math.log(o),e=.5*Math.exp(2*c/3),l=.5*Math.sqrt(c*e*(o-e)/o)*(n-o/2<0?-1:1);t(f,a,Math.max(r,Math.floor(a-n*e/o+l)),Math.min(h,Math.floor(a+(o-n)*e/o+l)),M)}const n=f[a];let c=r,e=h;for(o(f,r,a),M(f[h],n)>0&&o(f,r,h);c<e;){for(o(f,c,e),c++,e--;M(f[c],n)<0;)c++;for(;M(f[e],n)>0;)e--}0===M(f[r],n)?o(f,r,e):(e++,o(f,e,h)),e<=a&&(r=e+1),a<=e&&(h=e-1)}}function o(t,o,n){const f=t[o];t[o]=t[n],t[n]=f}function n(t,o){return t<o?-1:t>o?1:0}export{t as default};
//# sourceMappingURL=/sm/86e06db0b1691a532e04074288c3305bda474179c0e968d7a6ea3b8e36e7116f.map