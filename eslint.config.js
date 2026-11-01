import js from "@eslint/js";
import ts from "typescript-eslint";
import globals from "globals";
export default ts.config(
  { ignores: ["dist/**", "node_modules/**", "output/**", "tmp/**", "face-service/.venv/**"] },
  js.configs.recommended,
  ...ts.configs.recommended,
  { files: ["**/*.{ts,tsx,js,mjs}"], languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: { "@typescript-eslint/no-explicit-any": "warn", "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }] } },
  { files: ["src/domain/**/*.ts"], rules: {
    "no-restricted-imports": ["error", {
      patterns: [{ group: ["react", "react/*", "react-dom", "react-dom/*", "@supabase/*", "**/features/**", "**/services/**", "**/app/**"],
        message: "Keep domain rules independent of UI, cloud clients, and the app controller." }],
    }],
  } },
);
