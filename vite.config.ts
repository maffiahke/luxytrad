import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 3001,
    proxy: {
      // forward admin API calls to the Express + Prisma server (npm run api:dev)
      "/admin/api": { target: "http://localhost:4000", changeOrigin: true },
      // forward public M-Pesa STK push / callback / status to the same server
      "/api": { target: "http://localhost:4000", changeOrigin: true },
    },
  },
});
