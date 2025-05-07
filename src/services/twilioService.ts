import { Device } from "@twilio/voice-sdk";
import axios from "axios";

const API_URL = "http://localhost:9000/api/twilio";

// Interface for token response
interface TokenResponse {
  token: string;
  identity: string;
}

// Class to handle Twilio Voice SDK integration
class TwilioService {
  private device: Device | null = null;
  private identity: string = "";
  private token: string = "";
  private activeCall: any = null;
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
      const response = await this.getToken(identity);
      this.token = response.token;

      // Create a new Device instance
      this.device = new Device(this.token, {
        codecPreferences: ["opus", "pcmu"],
        fakeLocalDTMF: true,
        enableRingingState: true,
      });

      // Setup device event listeners
      this.setupDeviceListeners();
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

    this.device.on("registered", () => {
      console.log("Twilio device registered");
      if (this.onCallStatusChange) this.onCallStatusChange("ready");
    });

    this.device.on("error", (error) => {
      console.error("Twilio device error:", error);
      if (this.onCallStatusChange) this.onCallStatusChange("error");
    });

    this.device.on("incoming", (call) => {
      this.activeCall = call;
      if (this.onCallStatusChange) this.onCallStatusChange("incoming");

      // Setup call event listeners
      this.setupCallListeners(call);
    });
  }

  // Setup call event listeners
  private setupCallListeners(call: any): void {
    call.on("accept", () => {
      if (this.onCallStatusChange) this.onCallStatusChange("in-progress");
    });

    call.on("disconnect", () => {
      this.activeCall = null;
      if (this.onCallStatusChange) this.onCallStatusChange("disconnected");
    });

    call.on("cancel", () => {
      this.activeCall = null;
      if (this.onCallStatusChange) this.onCallStatusChange("cancelled");
    });

    call.on("reject", () => {
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
      const params = {
        To: to,
      };

      this.activeCall = await this.device.connect({ params });
      this.setupCallListeners(this.activeCall);

      if (this.onCallStatusChange) this.onCallStatusChange("connecting");
    } catch (error) {
      console.error("Error making call:", error);
      throw error;
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
