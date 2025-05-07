import { Device, Call } from "@twilio/voice-sdk";
import axios from "axios";

// Use the ngrok URL if available, otherwise fallback to localhost
const USE_NGROK = true; // Set to true when you want to use ngrok URL
const NGROK_URL = "https://532d-45-64-161-36.ngrok-free.app";
const LOCAL_URL = "http://localhost:9000";

const API_URL = USE_NGROK
  ? `${NGROK_URL}/api/twilio`
  : `${LOCAL_URL}/api/twilio`;

console.log("Using Twilio API URL:", API_URL);

// Interface for token response
interface TokenResponse {
  token: string;
  identity: string;
}

// Interface for Twilio errors
interface TwilioError extends Error {
  code?: number | string;
  info?: string;
  explanation?: string;
  description?: string;
  status?: number;
}

enum Codec {
  Opus = "opus",
  PCMU = "pcmu",
}

// Extend Device and Call to include their event emitter methods
interface TwilioDevice extends Device {
  on(event: "registered", listener: () => void): this;
  on(event: "error", listener: (error: TwilioError) => void): this;
  on(event: "incoming", listener: (call: Call) => void): this;
  on(event: "unregistered", listener: () => void): this;
  on(event: "tokenWillExpire", listener: () => void): this;
  on(event: "tokenExpired", listener: () => void): this;
}

interface TwilioCall extends Call {
  on(event: "accept", listener: () => void): this;
  on(event: "disconnect", listener: () => void): this;
  on(event: "cancel", listener: () => void): this;
  on(event: "reject", listener: () => void): this;
}

// Class to handle Twilio Voice SDK integration
class TwilioService {
  private device: Device | null = null;
  private identity: string = "";
  private token: string = "";
  private activeCall: Call | null = null;
  private onCallStatusChange: ((status: string) => void) | null = null;

  // Initialize the Twilio device with a token
  async initialize(
    identity: string,
    onCallStatusChange: (status: string) => void
  ): Promise<void> {
    this.identity = identity;
    this.onCallStatusChange = onCallStatusChange;

    try {
      // Get a token from the server
      console.log("Getting token for identity:", identity);
      const response = await this.getToken(identity);
      this.token = response.token;
      console.log("Token received successfully");

      // Create a new Device instance with proper options
      console.log("Creating new Twilio Device...");
      this.device = new Device(this.token, {
        // Cast codecPreferences to any to avoid TypeScript errors
        // This follows the Twilio documentation which specifies string[] for codecPreferences
        codecPreferences: [Codec.Opus, Codec.PCMU] as Codec[],
        // Add log level for more verbose debugging
        logLevel: "debug",
      });

      console.log("Twilio Device created", this.device);

      // Setup device event listeners
      this.setupDeviceListeners();

      // Explicitly register the device
      if (this.device) {
        console.log("Explicitly registering device...");
        this.device.register();
      }
    } catch (error) {
      console.error("Error initializing Twilio device:", error);
      throw error;
    }
  }

  // Get a token from the server
  private async getToken(identity: string): Promise<TokenResponse> {
    try {
      const response = await axios.post(`${API_URL}/token`, { identity });
      return response.data;
    } catch (error) {
      console.error("Error getting token:", error);
      throw error;
    }
  }

  // Setup device event listeners
  private setupDeviceListeners(): void {
    if (!this.device) return;

    // Cast device to our interface to access event methods
    const twilioDevice = this.device as unknown as TwilioDevice;

    console.log("Setting up Twilio device event listeners...");

    twilioDevice.on("registered", () => {
      console.log("👍 SUCCESS: Twilio device registered successfully");
      if (this.onCallStatusChange) this.onCallStatusChange("ready");
    });

    twilioDevice.on("error", (twilioError: TwilioError) => {
      console.error("❌ ERROR: Twilio device error:", twilioError);
      // Get more specific information about the error
      let errorMessage = "Unknown Twilio error";
      if (twilioError.message) {
        errorMessage = twilioError.message;
      }
      if (twilioError.code) {
        errorMessage += ` (Error code: ${twilioError.code})`;
      }

      // Log detailed error information for debugging
      console.error("Detailed error information:", {
        message: twilioError.message,
        code: twilioError.code,
        info: twilioError.info,
        explanation: twilioError.explanation,
        description: twilioError.description,
        stack: twilioError.stack,
      });

      if (this.onCallStatusChange)
        this.onCallStatusChange(`error: ${errorMessage}`);
    });

    // Add listeners for other relevant device events
    twilioDevice.on("unregistered", () => {
      console.warn("⚠️ Twilio device unregistered");
      if (this.onCallStatusChange) this.onCallStatusChange("disconnected");
    });

    twilioDevice.on("tokenWillExpire", () => {
      console.warn("⚠️ Twilio token will expire soon");
      // Optionally refresh the token here
    });

    twilioDevice.on("tokenExpired", () => {
      console.error("❌ Twilio token expired");
      if (this.onCallStatusChange) this.onCallStatusChange("disconnected");
    });

    twilioDevice.on("incoming", (incomingCall) => {
      console.log("📞 Incoming call received", incomingCall);
      this.activeCall = incomingCall;
      if (this.onCallStatusChange) this.onCallStatusChange("incoming");

      // Setup call event listeners
      this.setupCallListeners(incomingCall);
    });
  }

  // Setup call event listeners
  private setupCallListeners(call: Call): void {
    // Cast call to our interface to access event methods
    const twilioCall = call as unknown as TwilioCall;

    twilioCall.on("accept", () => {
      if (this.onCallStatusChange) this.onCallStatusChange("in-progress");
    });

    twilioCall.on("disconnect", () => {
      this.activeCall = null;
      if (this.onCallStatusChange) this.onCallStatusChange("disconnected");
    });

    twilioCall.on("cancel", () => {
      this.activeCall = null;
      if (this.onCallStatusChange) this.onCallStatusChange("cancelled");
    });

    twilioCall.on("reject", () => {
      this.activeCall = null;
      if (this.onCallStatusChange) this.onCallStatusChange("rejected");
    });
  }

  // Make an outgoing call
  async makeCall(to: string): Promise<void> {
    if (!this.device) {
      throw new Error("Twilio device not initialized");
    }

    try {
      console.log(`Attempting to call ${to}...`);
      // Make sure the 'To' parameter is correctly formatted
      // This must match exactly what the server expects in the voiceResponse function
      const params = {
        To: to,
        From: this.identity, // Add the 'From' parameter to identify who is calling
      };

      console.log("Call params:", params);
      this.activeCall = await this.device.connect({ params });
      console.log("Call initiated successfully:", this.activeCall);
      this.setupCallListeners(this.activeCall);

      if (this.onCallStatusChange) this.onCallStatusChange("connecting");
    } catch (error) {
      console.error("Error making call:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to initiate call: ${errorMessage}`);
    }
  }

  // Answer an incoming call
  answerCall(): void {
    if (!this.activeCall) {
      throw new Error("No active incoming call");
    }

    try {
      this.activeCall.accept();
    } catch (error) {
      console.error("Error answering call:", error);
      throw error;
    }
  }

  // Reject an incoming call
  rejectCall(): void {
    if (!this.activeCall) {
      throw new Error("No active incoming call");
    }

    try {
      this.activeCall.reject();
      this.activeCall = null;
    } catch (error) {
      console.error("Error rejecting call:", error);
      throw error;
    }
  }

  // End the current call
  endCall(): void {
    if (!this.activeCall) {
      throw new Error("No active call");
    }

    try {
      this.activeCall.disconnect();
      this.activeCall = null;
    } catch (error) {
      console.error("Error ending call:", error);
      throw error;
    }
  }

  // Mute the current call
  mute(): void {
    if (!this.activeCall) {
      throw new Error("No active call");
    }

    try {
      this.activeCall.mute(true);
    } catch (error) {
      console.error("Error muting call:", error);
      throw error;
    }
  }

  // Unmute the current call
  unmute(): void {
    if (!this.activeCall) {
      throw new Error("No active call");
    }

    try {
      this.activeCall.mute(false);
    } catch (error) {
      console.error("Error unmuting call:", error);
      throw error;
    }
  }

  // Check if the current call is muted
  isMuted(): boolean {
    if (!this.activeCall) {
      return false;
    }

    return this.activeCall.isMuted();
  }

  // Cleanup resources
  destroy(): void {
    if (this.device) {
      this.device.destroy();
      this.device = null;
    }
  }
}

export default new TwilioService();
