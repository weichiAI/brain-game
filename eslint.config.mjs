import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
  globalIgnores([
    "node_modules/**",
    "dist/**",
    ".next/**",
    "build/**",
    "coverage/**",
  ]),
]);

export default eslintConfig;
