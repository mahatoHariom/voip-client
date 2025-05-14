const parseBooleanEnv = (
  value: string | undefined,
  defaultValue: boolean
): boolean => {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === "true";
};

export const config = {
  api: {
    useNgrok: parseBooleanEnv(import.meta.env.VITE_USE_NGROK, false),
    ngrokUrl: import.meta.env.VITE_NGROK_URL || "",
    localUrl: import.meta.env.VITE_LOCAL_URL || "http://localhost:9000",
    get baseUrl(): string {
      console.log(
        `Using ${this.useNgrok ? "NGROK" : "local"} URL for API calls`
      );
      return this.useNgrok
        ? `${this.ngrokUrl}/api/twilio`
        : `${this.localUrl}/api/twilio`;
    },
  },
  features: {
    debug: parseBooleanEnv(import.meta.env.VITE_ENABLE_DEBUG, true),
  },
};

// Log configuration in development mode
if (import.meta.env.DEV) {
  console.log("App Configuration:", config);
}
