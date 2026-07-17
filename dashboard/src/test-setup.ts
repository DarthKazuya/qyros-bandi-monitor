import '@testing-library/jest-dom/vitest';

// Node 22+ ships its own built-in `globalThis.localStorage` accessor, but Vitest's
// jsdom environment only overrides window properties from a hardcoded allow-list
// that predates this Node feature (see `KEYS` in vitest's environments module), so
// it never replaces Node's native accessor with jsdom's real implementation.
// As a result, `globalThis.localStorage` inside tests resolves to Node's storage
// (unconfigured, since no `--localstorage-file` was passed), not jsdom's — and
// `@supabase/supabase-js`'s GoTrueClient probes it on construction, which trips
// Node's lazy getter and prints:
//   ExperimentalWarning: localStorage is not available because --localstorage-file
//   was not provided.
// Vitest's jsdom setup stashes the real JSDOM instance on `globalThis.jsdom`
// (see the `jsdom` environment's `setup()`), so pull the genuine implementation
// from there and install it before any test (or its imports) can touch storage.
const jsdomWindow = (globalThis as unknown as { jsdom?: { window: Window } }).jsdom?.window;
if (jsdomWindow) {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    enumerable: true,
    value: jsdomWindow.localStorage,
  });
}
