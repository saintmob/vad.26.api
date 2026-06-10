import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src/client")
    }
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    hmr: false
  },
  build: {
    outDir: "dist/client",
    emptyOutDir: true
  }
});
