import "@testing-library/jest-dom";

(globalThis as any).__DEV__ = true;

if (typeof window !== 'undefined') {
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});

document.elementFromPoint = document.elementFromPoint ?? (() => null);
}
