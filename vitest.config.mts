import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` exists to fail a *build* that pulls a server module into
      // a client bundle. Under vitest there is no bundle and no client, so the
      // package throws on import and makes otherwise-pure server logic
      // untestable. Stubbing it here keeps the guard doing its real job in
      // `next build` while letting units like the token crypto be tested
      // directly — the alternative is code that drops the guard to be testable,
      // which trades a real protection for a test convenience.
      "server-only": fileURLToPath(new URL("./tests/unit/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
