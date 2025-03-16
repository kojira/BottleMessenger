import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: "file:/app/data/bottlemessenger.db"
  },
  verbose: true,
  strict: true,
});
