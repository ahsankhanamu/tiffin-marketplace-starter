import adapterNode from "@sveltejs/adapter-node";
import adapterVercel from "@sveltejs/adapter-vercel";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

// Use Vercel adapter when deploying to Vercel, otherwise use Node adapter
const adapter = process.env.VERCEL 
  ? adapterVercel({
      runtime: 'nodejs20.x'
    })
  : adapterNode({
      out: 'build',
      precompress: false,
      envPrefix: 'VITE_'
    });

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter,
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
