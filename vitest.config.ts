import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The same "@/..." shortcut for src/ that the site uses.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
