import { useState, useCallback, useRef, useEffect } from "react";
import { Device, Call } from "@twilio/voice-sdk";
import apiClient from "../utils/apiClient";
import type { CallStatus } from "../types";

interface TokenResponse {
  token: string;
  identity: string;
}

// Define a more specific type for Twilio Call that includes the 'on' method
interface TwilioCall extends Call {
  on(
    event:
      | "accept"
      | "disconnect"
      | "cancel"
      | "reject"
      | "error"
      | "warning"
      | "reconnecting"
      | "reconnected",
    listener: (arg?: unknown) => void
  ): this;
  parameters: Record<string, string>;
}

// Add proper type for Device with event handlers
interface TwilioDevice extends Device {
  on(
    event: "registered" | "unregistered" | "tokenWillExpire" | "tokenExpired",
    listener: () => void
  ): this;
  on(event: "error", listener: (error: Error) => void): this;
  on(event: "incoming", listener: (call: Call) => void): this;
}

// Audio settings for better call quality
const AUDIO_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: false,
};

// Token refresh interval in milliseconds (refresh token 1 minute before expiry)
const TOKEN_REFRESH_INTERVAL = 59 * 60 * 1000; // 59 minutes

export const useTwilioVoice = () => {
  const [state, setState] = useState<{
    identity: string;
    callStatus: CallStatus;
    error: string;
    isMuted: boolean;
    isInitialized: boolean;
    callInfo: string;
    remoteIdentity: string;
  }>({
    identity: "",
    callStatus: "closed",
    error: "",
    isMuted: false,
    isInitialized: false,
    callInfo: "",
    remoteIdentity: "",
  });

  const deviceRef = useRef<TwilioDevice | null>(null);
  const activeCallRef = useRef<TwilioCall | null>(null);
  const tokenRef = useRef<string>("");
  const tokenRefreshTimerRef = useRef<number | null>(null);

  // Enhanced function to properly clean up call resources
  const cleanupCallResources = useCallback(() => {
    if (activeCallRef.current) {
      try {
        console.log("Cleaning up call resources");

        // Make sure the call is properly disconnected
        if (activeCallRef.current.status() !== "closed") {
          activeCallRef.current.disconnect();
        }

        // Force release of audio resources
        if (deviceRef.current) {
          try {
            // Attempt to release audio resources
            deviceRef.current.audio?.outgoing(false);
            deviceRef.current.audio?.incoming(false);

            // Additional cleanup for any active audio elements
            console.log("Audio resources released");
          } catch (err) {
            console.warn("Error releasing device audio:", err);
          }
        }
      } catch (err) {
        // Ignore errors during cleanup
        console.log("Error during call cleanup:", err);
      }

      // Clear the active call reference
      activeCallRef.current = null;
    }

    // Reset mute state and remote identity
    updateState({ isMuted: false, remoteIdentity: "" });
  }, []);

  // Cleanup resources when component unmounts
  useEffect(() => {
    return () => {
      // Clear any token refresh timer
      if (tokenRefreshTimerRef.current) {
        window.clearTimeout(tokenRefreshTimerRef.current);
        tokenRefreshTimerRef.current = null;
      }

      // Clean up call resources
      cleanupCallResources();

      // Destroy device if it exists
      if (deviceRef.current) {
        try {
          deviceRef.current.destroy();
          deviceRef.current = null;
        } catch (err) {
          console.warn("Error destroying device:", err);
        }
      }
    };
  }, [cleanupCallResources]);

  const updateState = useCallback((updates: Partial<typeof state>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleError = useCallback(
    (error: unknown, prefix: string) => {
      const errorMessage = `${prefix}: ${
        error instanceof Error ? error.message : String(error)
      }`;
      console.error(errorMessage);
      updateState({ error: errorMessage, callStatus: "error" });
      return errorMessage;
    },
    [updateState]
  );

  const updateCallStatus = useCallback(
    (status: CallStatus, info: string = "") => {
      updateState({
        callStatus: status,
        callInfo: info,
        ...(status === "ready" ? { error: "" } : {}),
      });
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

  // Setup token refresh mechanism
  const setupTokenRefresh = useCallback(
    (identity: string) => {
      // Clear any existing timer
      if (tokenRefreshTimerRef.current) {
        window.clearTimeout(tokenRefreshTimerRef.current);
      }

      // Set up a timer to refresh the token before it expires
      tokenRefreshTimerRef.current = window.setTimeout(async () => {
        try {
          console.log("Refreshing Twilio token...");
          const { token } = await getToken(identity);
          tokenRef.current = token;

          // Update the device with the new token
          if (deviceRef.current) {
            await deviceRef.current.updateToken(token);
            console.log("Token refreshed successfully");
          }

          // Set up the next refresh
          setupTokenRefresh(identity);
        } catch (error) {
          console.error("Failed to refresh token:", error);
          // Try again in 1 minute if failed
          tokenRefreshTimerRef.current = window.setTimeout(() => {
            setupTokenRefresh(identity);
          }, 60000);
        }
      }, TOKEN_REFRESH_INTERVAL);
    },
    [getToken]
  );

  // Helper function to extract client identity from Twilio parameters
  const extractClientIdentity = useCallback(
    (parameters: Record<string, string>) => {
      // Extract the caller's identity from the From parameter
      // Format is typically "client:identity"
      const from = parameters.From || "";
      if (from.startsWith("client:")) {
        return from.substring(7); // Remove "client:" prefix
      }
      return from || "unknown";
    },
    []
  );

  const setupCallListeners = useCallback(
    (call: TwilioCall) => {
      // Call accepted
      call.on("accept", () => {
        console.log("Call accepted");
        updateCallStatus("open");
      });

      // Call error
      call.on("error", (error) => {
        console.error("Call error:", error);
        handleError(error, "Call error");
        cleanupCallResources();
      });

      // Call warning
      call.on("warning", (warning) => {
        console.warn("Call warning:", warning);
        updateState({ callInfo: `Warning: ${warning}` });
      });

      // Call reconnecting
      call.on("reconnecting", (error) => {
        console.warn("Call reconnecting due to:", error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        updateCallStatus("reconnecting", `Reconnecting: ${errorMsg}`);
      });

      // Call reconnected
      call.on("reconnected", () => {
        console.log("Call reconnected successfully");
        updateCallStatus("open", "Reconnected");
      });

      // Call ended
      ["disconnect", "cancel", "reject"].forEach((event) => {
        call.on(event as "disconnect" | "cancel" | "reject", () => {
          console.log(`Call ${event} event received`);

          // First update the status to ensure UI reflects the change
          updateCallStatus(
            "closed",
            event === "disconnect" ? "Call ended" : "Call rejected"
          );

          // Then clean up resources
          cleanupCallResources();
        });
      });
    },
    [updateCallStatus, updateState, handleError, cleanupCallResources]
  );

  const initialize = useCallback(
    async (userIdentity: string) => {
      updateState({
        identity: userIdentity,
        error: "",
        callStatus: "initializing",
      });

      try {
        // Clean up existing device if any
        if (deviceRef.current) {
          console.log("Destroying existing device");
          deviceRef.current.destroy();
          deviceRef.current = null;
        }

        // Clean up any existing call
        cleanupCallResources();

        // Get token from server
        const { token } = await getToken(userIdentity);
        tokenRef.current = token;

        // Create new device with improved settings
        const device = new Device(token, {
          logLevel: "warn",
          maxAverageBitrate: 16000, // Set max bitrate for better audio quality
        }) as TwilioDevice;

        deviceRef.current = device;

        // Set up device event listeners
        device.on("registered", () => {
          console.log("Device registered successfully");
          updateCallStatus("ready");
        });

        device.on("error", (error: Error) => {
          console.error("Device error:", error);
          updateCallStatus("error", `Error: ${error.message}`);
        });

        device.on("incoming", (incomingCall: Call) => {
          console.log("Incoming call received");

          // Clean up any existing call first
          cleanupCallResources();

          activeCallRef.current = incomingCall as TwilioCall;

          // Extract caller identity from parameters
          const callerIdentity = extractClientIdentity(
            (incomingCall as TwilioCall).parameters
          );
          console.log("Incoming call from:", callerIdentity);

          // Store the caller's identity
          updateState({ remoteIdentity: callerIdentity });

          updateCallStatus("pending", `From: ${callerIdentity}`);
          setupCallListeners(activeCallRef.current);
        });

        // Set up token refresh
        setupTokenRefresh(userIdentity);

        // Register the device
        await device.register();
        updateState({ isInitialized: true });
      } catch (error) {
        const errorMsg = `Initialization error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`;
        console.error(errorMsg);
        updateState({
          error: errorMsg,
          callStatus: "error",
          isInitialized: false,
        });
      }
    },
    [
      getToken,
      setupCallListeners,
      updateCallStatus,
      updateState,
      cleanupCallResources,
      extractClientIdentity,
      setupTokenRefresh,
    ]
  );

  const makeCall = useCallback(
    async (to: string) => {
      if (!deviceRef.current) throw new Error("Device not initialized");

      try {
        // Clean up any existing call first
        cleanupCallResources();

        console.log(`Making call to: ${to}`);

        // Store the destination identity
        updateState({ remoteIdentity: to });

        // Format destination
        const formattedTo = to.startsWith("client:") ? to : `client:${to}`;

        // Make the call with improved settings
        const call = await deviceRef.current.connect({
          params: {
            To: formattedTo,
            From: `client:${state.identity}`,
            // Add status callback URL for better call monitoring
            StatusCallback: `${apiClient.defaults.baseURL}/status`,
            StatusCallbackEvent: [
              "initiated",
              "ringing",
              "answered",
              "completed",
            ].join(" "),
            StatusCallbackMethod: "POST",
          },
        });

        // Set up call listeners
        activeCallRef.current = call as TwilioCall;
        setupCallListeners(activeCallRef.current);
        updateCallStatus("connecting", `Calling ${to}...`);
      } catch (error) {
        console.error("Call failed:", error);
        handleError(error, "Failed to make call");
        cleanupCallResources();
      }
    },
    [
      state.identity,
      setupCallListeners,
      updateCallStatus,
      handleError,
      cleanupCallResources,
      updateState,
    ]
  );

  const answerCall = useCallback(() => {
    try {
      console.log("Answering call");

      // Accept the call
      checkActiveCall().accept();
    } catch (error) {
      handleError(error, "Failed to answer call");
      cleanupCallResources();
    }
  }, [checkActiveCall, handleError, cleanupCallResources]);

  const rejectCall = useCallback(() => {
    try {
      console.log("Rejecting call");
      checkActiveCall().reject();
      // Let the event handlers handle cleanup
    } catch (error) {
      handleError(error, "Failed to reject call");
      cleanupCallResources();
    }
  }, [checkActiveCall, handleError, cleanupCallResources]);

  const endCall = useCallback(() => {
    try {
      console.log("Ending call");
      checkActiveCall().disconnect();
      // Let the event handlers handle cleanup
    } catch (error) {
      handleError(error, "Failed to end call");
      cleanupCallResources();
    }
  }, [checkActiveCall, handleError, cleanupCallResources]);

  const toggleMute = useCallback(() => {
    try {
      const call = checkActiveCall();
      const newMuteState = !state.isMuted;
      call.mute(newMuteState);
      console.log(`Call ${newMuteState ? "muted" : "unmuted"}`);
      updateState({ isMuted: newMuteState });
    } catch (error) {
      handleError(error, "Failed to toggle mute");
    }
  }, [checkActiveCall, handleError, state.isMuted, updateState]);

  return {
    identity: state.identity,
    callStatus: state.callStatus,
    error: state.error,
    isMuted: state.isMuted,
    isInitialized: state.isInitialized,
    callInfo: state.callInfo,
    remoteIdentity: state.remoteIdentity,
    initialize,
    makeCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
  };
};
