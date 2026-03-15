import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      // Prevent tests from starting an embedded Verdaccio instance
      VERDACCIO_URL: "http://localhost:4873",
    },
  },
});
