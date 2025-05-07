import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Allow the frontend to be accessed from any device on the network for testing
    host: "0.0.0.0",
    port: 5173,
    cors: true,
  },
});
