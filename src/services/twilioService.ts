import { Device, Call } from "@twilio/voice-sdk";
import axios from "axios";
import { config } from "../config/env";

// Core types
interface TokenResponse {
  token: string;
  identity: string;
}

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

class TwilioService {
  private device: Device | null = null;
  private identity: string = "";
  private token: string = "";
  private activeCall: Call | null = null;
  private onCallStatusChange: ((status: string) => void) | null = null;

  async initialize(
    identity: string,
    onCallStatusChange: (status: string) => void
  ): Promise<void> {
    this.identity = identity;
    this.onCallStatusChange = onCallStatusChange;

    try {
      const response = await this.getToken(identity);
      this.token = response.token;

      this.device = new Device(this.token, {
        codecPreferences: [Codec.Opus, Codec.PCMU] as Codec[],
        logLevel: "error",
      });

      this.setupDeviceListeners();

      if (this.device) {
        this.device.register();
      }
    } catch (error) {
      throw new Error(
        `Failed to initialize Twilio: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private async getToken(identity: string): Promise<TokenResponse> {
    try {
      const response = await axios.post(`${config.api.baseUrl}/token`, {
        identity,
      });
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to fetch token: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private setupDeviceListeners(): void {
    if (!this.device) return;

    const twilioDevice = this.device as TwilioDevice;

    twilioDevice.on("registered", () => {
      this.updateCallStatus("ready");
    });

    twilioDevice.on("error", (twilioError: TwilioError) => {
      let errorMessage = twilioError.message || "Unknown Twilio error";
      if (twilioError.code) {
        errorMessage += ` (Error code: ${twilioError.code})`;
      }
      this.updateCallStatus(`error: ${errorMessage}`);
    });

    twilioDevice.on("unregistered", () => {
      this.updateCallStatus("disconnected");
    });

    twilioDevice.on("tokenWillExpire", () => {});

    twilioDevice.on("tokenExpired", () => {
      this.updateCallStatus("disconnected");
    });

    twilioDevice.on("incoming", (incomingCall) => {
      this.activeCall = incomingCall;
      this.updateCallStatus("incoming");
      this.setupCallListeners(incomingCall);
    });
  }

  private setupCallListeners(call: Call): void {
    const twilioCall = call as unknown as TwilioCall;

    twilioCall.on("accept", () => {
      this.updateCallStatus("in-progress");
    });

    twilioCall.on("disconnect", () => {
      this.activeCall = null;
      this.updateCallStatus("disconnected");
    });

    twilioCall.on("cancel", () => {
      this.activeCall = null;
      this.updateCallStatus("cancelled");
    });

    twilioCall.on("reject", () => {
      this.activeCall = null;
      this.updateCallStatus("rejected");
    });
  }

  private updateCallStatus(status: string): void {
    if (this.onCallStatusChange) {
      this.onCallStatusChange(status);
    }
  }

  async makeCall(to: string): Promise<void> {
    this.checkDeviceInitialized();

    try {
      const params = { To: to, From: this.identity };
      this.activeCall = await this.device!.connect({ params });
      this.setupCallListeners(this.activeCall);
      this.updateCallStatus("connecting");
    } catch (error) {
      throw new Error(
        `Failed to initiate call: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  answerCall(): void {
    this.checkActiveIncomingCall();
    this.activeCall!.accept();
  }

  rejectCall(): void {
    this.checkActiveIncomingCall();
    this.activeCall!.reject();
    this.activeCall = null;
  }

  endCall(): void {
    this.checkActiveCall();
    this.activeCall!.disconnect();
    this.activeCall = null;
  }

  mute(): void {
    this.checkActiveCall();
    this.activeCall!.mute(true);
  }

  unmute(): void {
    this.checkActiveCall();
    this.activeCall!.mute(false);
  }

  isMuted(): boolean {
    return this.activeCall ? this.activeCall.isMuted() : false;
  }

  destroy(): void {
    if (this.device) {
      this.device.destroy();
      this.device = null;
    }
  }

  private checkDeviceInitialized(): void {
    if (!this.device) {
      throw new Error("Twilio device not initialized");
    }
  }

  private checkActiveCall(): void {
    if (!this.activeCall) {
      throw new Error("No active call");
    }
  }

  private checkActiveIncomingCall(): void {
    if (!this.activeCall) {
      throw new Error("No active incoming call");
    }
  }
}

export default new TwilioService();
