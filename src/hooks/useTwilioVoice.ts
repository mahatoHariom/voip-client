import { useState, useCallback, useEffect, useRef } from "react";
import { Device, Call } from "@twilio/voice-sdk";
import axios from "axios";
import { config } from "../config/env";

type CallStatus =
  | "disconnected"
  | "initializing"
  | "ready"
  | "connecting"
  | "in-progress"
  | "incoming"
  | "error"
  | "cancelled"
  | "rejected";

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

interface TwilioDevice extends Device {
  on(
    event: "registered" | "unregistered" | "tokenWillExpire" | "tokenExpired",
    listener: () => void
  ): this;
  on(event: "error", listener: (error: TwilioError) => void): this;
  on(event: "incoming", listener: (call: Call) => void): this;
}

interface TwilioCall extends Call {
  on(
    event: "accept" | "disconnect" | "cancel" | "reject",
    listener: () => void
  ): this;
}

enum Codec {
  Opus = "opus",
  PCMU = "pcmu",
}

export const useTwilioVoice = () => {
  // State management
  const [identity, setIdentity] = useState<string>("");
  const [callStatus, setCallStatus] = useState<CallStatus>("disconnected");
  const [error, setError] = useState<string>("");
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // References
  const deviceRef = useRef<Device | null>(null);
  const activeCallRef = useRef<Call | null>(null);
  const tokenRef = useRef<string>("");

  // Helper functions
  const handleError = useCallback(
    (error: unknown, prefix: string) =>
      `${prefix}: ${error instanceof Error ? error.message : String(error)}`,
    []
  );

  const updateCallStatus = useCallback((status: string) => {
    if (status.startsWith("error:")) {
      setError(status.substring(7));
      setCallStatus("error");
    } else {
      setCallStatus(status as CallStatus);
      if (status === "ready") setError("");
    }
  }, []);

  const checkActiveCall = useCallback((errorMessage = "No active call") => {
    if (!activeCallRef.current) throw new Error(errorMessage);
    return activeCallRef.current;
  }, []);

  // API interaction
  const getToken = useCallback(
    async (userIdentity: string): Promise<TokenResponse> => {
      try {
        const { data } = await axios.post(`${config.api.baseUrl}/token`, {
          identity: userIdentity,
        });
        return data;
      } catch (error) {
        throw new Error(handleError(error, "Failed to fetch token"));
      }
    },
    [handleError]
  );

  // Event handlers
  const setupCallListeners = useCallback(
    (call: Call) => {
      const twilioCall = call as unknown as TwilioCall;

      twilioCall.on("accept", () => updateCallStatus("in-progress"));

      twilioCall.on("disconnect", () => {
        activeCallRef.current = null;
        updateCallStatus("disconnected");
      });

      twilioCall.on("cancel", () => {
        activeCallRef.current = null;
        updateCallStatus("cancelled");
      });

      twilioCall.on("reject", () => {
        activeCallRef.current = null;
        updateCallStatus("rejected");
      });
    },
    [updateCallStatus]
  );

  // Core functions
  const initialize = useCallback(
    async (userIdentity: string) => {
      setIdentity(userIdentity);
      setError("");
      setCallStatus("initializing");

      try {
        const { token } = await getToken(userIdentity);
        tokenRef.current = token;

        deviceRef.current = new Device(token, {
          codecPreferences: [Codec.Opus, Codec.PCMU] as Codec[],
          logLevel: "error",
        });

        const device = deviceRef.current as TwilioDevice;

        device.on("registered", () => updateCallStatus("ready"));
        device.on("unregistered", () => updateCallStatus("disconnected"));
        device.on("tokenWillExpire", () => {});
        device.on("tokenExpired", () => updateCallStatus("disconnected"));
        device.on("error", (twilioError: TwilioError) => {
          const errorMessage = twilioError.message || "Unknown Twilio error";
          updateCallStatus(
            `error: ${errorMessage}${
              twilioError.code ? ` (Error code: ${twilioError.code})` : ""
            }`
          );
        });
        device.on("incoming", (incomingCall: Call) => {
          activeCallRef.current = incomingCall;
          updateCallStatus("incoming");
          setupCallListeners(incomingCall);
        });

        device.register();
        setIsInitialized(true);
      } catch (error) {
        setError(
          `Twilio error: ${
            error instanceof Error
              ? error.message
              : "Failed to initialize Twilio service"
          }`
        );
        setCallStatus("error");
        setIsInitialized(false);
      }
    },
    [getToken, setupCallListeners, updateCallStatus]
  );

  const makeCall = useCallback(
    async (to: string) => {
      if (!deviceRef.current) throw new Error("Twilio device not initialized");

      try {
        activeCallRef.current = await deviceRef.current.connect({
          params: { To: to, From: identity },
        });
        setupCallListeners(activeCallRef.current);
        updateCallStatus("connecting");
      } catch (error) {
        throw new Error(handleError(error, "Failed to initiate call"));
      }
    },
    [identity, setupCallListeners, updateCallStatus, handleError]
  );

  // Call control functions
  const answerCall = useCallback(
    () => checkActiveCall("No active incoming call").accept(),
    [checkActiveCall]
  );

  const rejectCall = useCallback(() => {
    const call = checkActiveCall("No active incoming call");
    call.reject();
    activeCallRef.current = null;
  }, [checkActiveCall]);

  const endCall = useCallback(() => {
    const call = checkActiveCall();
    call.disconnect();
    activeCallRef.current = null;
  }, [checkActiveCall]);

  const mute = useCallback(() => {
    checkActiveCall().mute(true);
    setIsMuted(true);
  }, [checkActiveCall]);

  const unmute = useCallback(() => {
    checkActiveCall().mute(false);
    setIsMuted(false);
  }, [checkActiveCall]);

  const destroy = useCallback(() => {
    if (deviceRef.current) {
      deviceRef.current.destroy();
      deviceRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => () => destroy(), [destroy]);

  return {
    identity,
    callStatus,
    error,
    isMuted,
    isInitialized,
    initialize,
    makeCall,
    answerCall,
    rejectCall,
    endCall,
    mute,
    unmute,
    destroy,
  };
};
