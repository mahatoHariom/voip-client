const parseBooleanEnv = (
  value: string | undefined,
  defaultValue: boolean
): boolean => {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === "true";
};

export const config = {
  api: {
    useNgrok: parseBooleanEnv(import.meta.env.VITE_USE_NGROK, true),
    ngrokUrl:
      import.meta.env.VITE_NGROK_URL ||
      "https://37af-45-64-161-36.ngrok-free.app",
    localUrl: import.meta.env.VITE_LOCAL_URL || "http://localhost:9000",
    get baseUrl(): string {
      return this.useNgrok
        ? `${this.ngrokUrl}/api/twilio`
        : `${this.localUrl}/api/twilio`;
    },
  },
  features: {
    debug: parseBooleanEnv(import.meta.env.VITE_ENABLE_DEBUG, false),
  },
};

if (import.meta.env.DEV && config.features.debug) {
  console.log("App Configuration:", config);
}
