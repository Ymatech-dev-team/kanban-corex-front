import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

// Lint flat (ESLint 9) via eslint-config-next (core-web-vitals + typescript). [hardening T3]
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  { ignores: [".next/**", "node_modules/**", "vendor/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // args/vars com prefixo _ são intencionalmente não usados (ex.: `{ quiet: _quiet, ...input }`)
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
];

export default config;
