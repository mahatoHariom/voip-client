const parseBooleanEnv = (
  value: string | undefined,
  defaultValue: boolean
): boolean => {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === "true";
};

export const config = {
  api: {
    useNgrok: true,
    ngrokUrl: "https://ae68-43-231-211-233.ngrok-free.app",
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
