// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  {
    ignores: [
      "dist/*",
      "coverage/*",
      ".expo/*",
      "web-build/*",
      // Deno製のEdge Functions。URLインポートなどランタイム/モジュール系が
      // React Native / Node 用のこの設定とは別物なので対象外にする。
      "supabase/functions/**",
    ],
  },
  expoConfig,
  {
    // react-hooks プラグインは eslint-config-expo が全ファイルに対して登録している。
    rules: {
      // このリポジトリのデータ取得フックは「マウント時 + 依存変化時に refetch する」
      // という形で統一されており(refetch内でsetLoading等を呼ぶ)、大規模な作り直しに
      // なるため error ではなく warn 扱いにする。新規コードでは避けること。
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    // @typescript-eslint プラグインは *.ts / *.tsx にのみ登録されている。
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // 画像などの静的アセットは require() で読み込むのがReact Nativeの標準。
      "@typescript-eslint/no-require-imports": "off",
      // _ 始まりの引数・変数・catch句は「意図的に未使用」とみなす。
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
]);
