// Polyfill for esbuild's __name helper.
// OpenNext/CF Workers bundles reference __name in Worker context but
// inline scripts served to the browser don't have it defined.
if (typeof __name === "undefined") {
  var __name = function (target, value) {
    try { Object.defineProperty(target, "name", { value: value, configurable: true }); } catch (e) {}
    return target;
  };
}
