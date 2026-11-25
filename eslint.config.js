// Self-contained flat config (no @eslint/js or globals imports): rules are listed explicitly.
const browser = Object.fromEntries(['window', 'document', 'location', 'localStorage', 'navigator', 'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'URL', 'Blob', 'FormData', 'HashChangeEvent', 'KeyboardEvent', 'IntersectionObserver', 'matchMedia', 'requestAnimationFrame', 'fetch', 'scrollY', 'addEventListener', 'performance'].map(k => [k, 'readonly']));
const node = Object.fromEntries(['process', 'console', 'setTimeout', 'URL', 'fetch', 'WebSocket', 'AbortController'].map(k => [k, 'readonly']));

const rules = {
  'no-undef': 'error', 'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }], 'no-var': 'error', 'prefer-const': 'error',
  eqeqeq: ['error', 'always', { null: 'ignore' }], 'no-redeclare': 'error', 'no-dupe-keys': 'error', 'no-unreachable': 'error',
  'no-empty': ['error', { allowEmptyCatch: true }], 'no-self-assign': 'error', 'no-fallthrough': 'error', 'no-cond-assign': 'error',
  'no-prototype-builtins': 'error', 'no-useless-escape': 'error', 'no-unsafe-finally': 'error', 'no-const-assign': 'error',
};
const opts = { ecmaVersion: 2023, sourceType: 'module' };

export default [
  { ignores: ['node_modules/**', 'docs/**'] },
  { files: ['app/js/**/*.js', 'site/js/**/*.js'], languageOptions: { ...opts, globals: browser }, rules },
  { files: ['*.mjs', '*.config.js', 'scripts/**/*.mjs', 'tests/**/*.mjs'], languageOptions: { ...opts, globals: node }, rules },
];
