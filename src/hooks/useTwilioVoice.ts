import { useState, useCallback, useEffect, useRef } from "react";
import { Device, Call } from "@twilio/voice-sdk";
import apiClient from "../utils/apiClient";
import type { CallStatus } from "../types";

interface TokenResponse {
  token: string;
  identity: string;
}

interface TwilioError extends Error {
  code?: number | string;
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
  const [identity, setIdentity] = useState<string>("");
  const [callStatus, setCallStatus] = useState<CallStatus>("closed");
  const [error, setError] = useState<string>("");
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  const deviceRef = useRef<Device | null>(null);
  const activeCallRef = useRef<Call | null>(null);
  const tokenRef = useRef<string>("");

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

  const checkActiveCall = useCallback(() => {
    if (!activeCallRef.current) throw new Error("No active call");
    return activeCallRef.current;
  }, []);

  const getToken = useCallback(
    async (userIdentity: string): Promise<TokenResponse> => {
      try {
        const { data } = await apiClient.post("/token", {
          identity: userIdentity,
        });
        return data;
      } catch (error) {
        throw new Error(handleError(error, "Failed to fetch token"));
      }
    },
    [handleError]
  );

  const setupCallListeners = useCallback(
    (call: Call) => {
      const twilioCall = call as TwilioCall;

      twilioCall.on("accept", () => updateCallStatus("open"));

      ["disconnect", "cancel", "reject"].forEach((event) => {
        twilioCall.on(event as "disconnect" | "cancel" | "reject", () => {
          activeCallRef.current = null;
          updateCallStatus("closed");
        });
      });
    },
    [updateCallStatus]
  );

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
        device.on("unregistered", () => updateCallStatus("closed"));
        device.on("tokenExpired", () => updateCallStatus("closed"));
        device.on("error", (twilioError: TwilioError) => {
          updateCallStatus(
            `error: ${twilioError.message || "Unknown Twilio error"}`
          );
        });
        device.on("incoming", (incomingCall: Call) => {
          activeCallRef.current = incomingCall;
          updateCallStatus("pending");
          setupCallListeners(incomingCall);
        });

        device.register();
        setIsInitialized(true);
      } catch (error) {
        setError(
          `Twilio error: ${
            error instanceof Error ? error.message : "Failed to initialize"
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

  const answerCall = useCallback(
    () => checkActiveCall().accept(),
    [checkActiveCall]
  );

  const rejectCall = useCallback(() => {
    const call = checkActiveCall();
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
