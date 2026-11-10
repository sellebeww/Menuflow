// Tiny action registry: any element with data-act="name" calls actions.name(el.dataset, event).
export const actions = {};
export const go = hash => { if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = hash; };
