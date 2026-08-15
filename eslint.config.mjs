import coreWebVitals from 'eslint-config-next/core-web-vitals';

const config = [
  {
    // Generated Emscripten output and build artefacts are not ours to lint.
    ignores: ['.next/**', 'node_modules/**', 'out/**', 'public/wasm_keygen.js'],
  },
  ...coreWebVitals,
];

export default config;
