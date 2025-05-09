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
  const [state, setState] = useState<{
    identity: string;
    callStatus: CallStatus;
    error: string;
    isMuted: boolean;
    isInitialized: boolean;
  }>({
    identity: "",
    callStatus: "closed",
    error: "",
    isMuted: false,
    isInitialized: false,
  });

  const deviceRef = useRef<Device | null>(null);
  const activeCallRef = useRef<Call | null>(null);
  const tokenRef = useRef<string>("");

  const updateState = useCallback((updates: Partial<typeof state>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleError = useCallback(
    (error: unknown, prefix: string) => {
      const errorMessage = `${prefix}: ${
        error instanceof Error ? error.message : String(error)
      }`;
      updateState({ error: errorMessage, callStatus: "error" });
      return errorMessage;
    },
    [updateState]
  );

  const updateCallStatus = useCallback(
    (status: string) => {
      if (status.startsWith("error:")) {
        updateState({
          error: status.substring(7),
          callStatus: "error",
        });
      } else {
        updateState({
          callStatus: status as CallStatus,
          ...(status === "ready" ? { error: "" } : {}),
        });
      }
    },
    [updateState]
  );

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
        throw new Error(
          `Failed to fetch token: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    },
    []
  );

  const setupCallListeners = useCallback(
    (call: Call) => {
      const twilioCall = call as TwilioCall;

      twilioCall.on("accept", () => updateCallStatus("open"));

      ["disconnect", "cancel", "reject"].forEach((event) => {
        twilioCall.on(event as "disconnect" | "cancel" | "reject", () => {
          activeCallRef.current = null;
          updateCallStatus("closed");
          updateState({ isMuted: false });
        });
      });
    },
    [updateCallStatus, updateState]
  );

  const initialize = useCallback(
    async (userIdentity: string) => {
      updateState({
        identity: userIdentity,
        error: "",
        callStatus: "initializing",
      });

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
        updateState({ isInitialized: true });
      } catch (error) {
        const errorMsg = `Twilio error: ${
          error instanceof Error ? error.message : "Failed to initialize"
        }`;
        updateState({
          error: errorMsg,
          callStatus: "error",
          isInitialized: false,
        });
      }
    },
    [getToken, setupCallListeners, updateCallStatus, updateState]
  );

  const makeCall = useCallback(
    async (to: string) => {
      if (!deviceRef.current) throw new Error("Twilio device not initialized");

      try {
        activeCallRef.current = await deviceRef.current.connect({
          params: { To: to, From: state.identity },
        });
        setupCallListeners(activeCallRef.current);

        updateCallStatus("connecting");
      } catch (error) {
        throw new Error(
          `Failed to initiate call: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    },
    [state.identity, setupCallListeners, updateCallStatus]
  );

  const answerCall = useCallback(() => {
    try {
      checkActiveCall().accept();
    } catch (error) {
      handleError(error, "Failed to answer call");
    }
  }, [checkActiveCall, handleError]);

  const rejectCall = useCallback(() => {
    try {
      const call = checkActiveCall();
      call.reject();
      activeCallRef.current = null;
    } catch (error) {
      handleError(error, "Failed to reject call");
    }
  }, [checkActiveCall, handleError]);

  const endCall = useCallback(() => {
    try {
      const call = checkActiveCall();
      call.disconnect();
      activeCallRef.current = null;
    } catch (error) {
      handleError(error, "Failed to end call");
    }
  }, [checkActiveCall, handleError]);

  const toggleMute = useCallback(() => {
    try {
      const call = checkActiveCall();
      const newMuteState = !state.isMuted;
      call.mute(newMuteState);
      updateState({ isMuted: newMuteState });
    } catch (error) {
      handleError(error, "Failed to toggle mute");
    }
  }, [checkActiveCall, handleError, state.isMuted, updateState]);

  const destroy = useCallback(() => {
    if (deviceRef.current) {
      deviceRef.current.destroy();
      deviceRef.current = null;
      updateState({
        callStatus: "closed",
        isInitialized: false,
        isMuted: false,
      });
    }
  }, [updateState]);

  useEffect(() => () => destroy(), [destroy]);

  return {
    ...state,
    initialize,
    makeCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    destroy,
  };
};
