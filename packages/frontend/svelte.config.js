import adapter from "@sveltejs/adapter-node";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      out: 'build',
      precompress: false,
      envPrefix: 'VITE_'
    }),
    alias: {
      "@ui": "./src/lib/components/ui",
    },
  },
  vitePlugin: {
    // only in development mode
    ...(process.env.NODE_ENV === "development" && {
      inspector: {
        toggleKeyCombo: "meta-shift", // Key combination to open the inspector
        holdMode: false, // Enable or disable hold mode
        showToggleButton: "always", // Show toggle button ('always', 'active', 'never')
        toggleButtonPos: "bottom-right", // Position of the toggle button
      },
    }),
  },
  onwarn: (warning, handler) => {
    const { code } = warning;
    if (code === "css-unused-selector") return;

    handler(warning);
  },
};

export default config;
