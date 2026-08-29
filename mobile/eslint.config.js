// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // lib/bindings is written by ts-rs from ferry's Rust types
    // (`cargo test export_bindings`). Linting generated output only
    // produces warnings nobody can act on without editing a file whose
    // header says not to.
    ignores: ["dist/*", "lib/bindings/*"],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // `any` opts a value out of type-checking entirely — every one of
      // these is a hole strict tsconfig settings can't see through.
      "@typescript-eslint/no-explicit-any": "error",
      // `!` tells the compiler "trust me, this isn't null/undefined" with
      // no runtime check behind it — the exact class of bug strictNullChecks
      // exists to catch. Narrow (`if (x)`, optional chaining) instead.
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "no-var": "error",
      "prefer-const": "error",
      eqeqeq: ["error", "always"],
      curly: ["error", "multi-line"],
    },
  },
]);
