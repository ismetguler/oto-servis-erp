import nextCoreWebVitals from "eslint-config-next/core-web-vitals"
import nextTypescript from "eslint-config-next/typescript"

/**
 * ESLint yapilandirmasi (flat config).
 * eslint-config-next 16 hazir flat config verdigi icin FlatCompat katmanina
 * gerek yok; dogrudan iceri aliniyor.
 */
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "src/generated/**",
    ],
  },
]

export default eslintConfig
