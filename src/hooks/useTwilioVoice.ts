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
      | "reconnected"
      | "ringing",
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
  const cleanupCallResourcesRef = useRef<() => void>(() => {});

  const updateState = useCallback((updates: Partial<typeof state>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  // Enhanced function to properly clean up call resources
  const cleanupCallResources = useCallback(() => {
    console.log("Cleaning up call resources");

    if (activeCallRef.current) {
      try {
        // Make sure the call is properly disconnected
        if (activeCallRef.current.status() !== "closed") {
          console.log("Disconnecting active call");
          activeCallRef.current.disconnect();
        } else {
          console.log("Call already closed, no need to disconnect");
        }

        // Force release of audio resources
        if (deviceRef.current) {
          try {
            // Attempt to release audio resources
            console.log("Releasing audio resources");
            deviceRef.current.audio?.outgoing(false);
            deviceRef.current.audio?.incoming(false);
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
      console.log("Clearing active call reference");
      activeCallRef.current = null;
    } else {
      console.log("No active call to clean up");
    }

    // Reset mute state and remote identity
    updateState({ isMuted: false, remoteIdentity: "" });
  }, [updateState]);

  // Store the cleanup function in a ref
  cleanupCallResourcesRef.current = cleanupCallResources;

  // Cleanup resources when component unmounts
  useEffect(() => {
    return () => {
      // Clear any token refresh timer
      if (tokenRefreshTimerRef.current) {
        window.clearTimeout(tokenRefreshTimerRef.current);
        tokenRefreshTimerRef.current = null;
      }

      // Clean up call resources
      cleanupCallResourcesRef.current();

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
      console.log("Setting up call listeners for call:", call);

      // Call ringing
      call.on("ringing", () => {
        console.log("Remote device is ringing");
        updateCallStatus("ringing", "Ringing...");
      });

      // Call accepted
      call.on("accept", () => {
        console.log("Call accepted");
        updateCallStatus("open", "Connected");
      });

      // Call error
      call.on("error", (error) => {
        console.error("Call error:", error);
        handleError(error, "Call error");
        cleanupCallResources();
        // Reset to ready state
        setTimeout(() => updateCallStatus("ready", ""), 500);
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
        updateCallStatus("open", "Call reconnected");
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

          // Reset status back to ready after a small delay
          setTimeout(() => {
            updateCallStatus("ready", "");
          }, 300);
        });
      });
    },
    [updateCallStatus, updateState, handleError, cleanupCallResources]
  );

  const initialize = useCallback(
    async (userIdentity: string) => {
      console.log("Starting device initialization for identity:", userIdentity);
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
        console.log("Requesting token from server...");
        const { token } = await getToken(userIdentity);

        if (!token) {
          throw new Error("Received empty token from server");
        }

        console.log("Token received successfully");
        tokenRef.current = token;

        // Create new device with improved settings and handle browser permissions
        console.log("Creating new Twilio device...");

        // First request permissions to ensure microphone access
        try {
          console.log("Requesting microphone permissions...");
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          console.log(
            "Microphone permission granted:",
            stream.getAudioTracks()
          );
          // Release the stream immediately as Twilio will request it again
          stream.getTracks().forEach((track) => track.stop());
        } catch (err) {
          console.error("Error requesting microphone permission:", err);
          throw new Error(
            "Microphone access is required. Please allow access and try again."
          );
        }

        const device = new Device(token, {
          logLevel: "debug", // Set to debug for more verbose logs
          maxAverageBitrate: 16000, // Set max bitrate for better audio quality
          // Allow local audio devices to connect immediately
          allowIncomingWhileBusy: true,
        }) as TwilioDevice;

        console.log("Device created, setting up event listeners...");
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
        console.log("Registering device with Twilio...");

        try {
          await device.register();
          console.log("Device registration completed successfully");
          updateState({ isInitialized: true });
        } catch (regError) {
          console.error("Device registration error:", regError);
          throw new Error(
            `Failed to register device: ${
              regError instanceof Error ? regError.message : "Unknown error"
            }`
          );
        }
      } catch (error) {
        const errorMsg = `Initialization error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`;
        console.error(errorMsg);
        // Log more details about the error
        console.error("Error details:", error);

        updateState({
          error: errorMsg,
          callStatus: "error",
          isInitialized: false,
        });

        // Try to recover by resetting device state
        if (deviceRef.current) {
          try {
            deviceRef.current.destroy();
          } catch (e) {
            console.warn("Error destroying device during recovery:", e);
          }
          deviceRef.current = null;
        }

        // Re-throw the error to allow the component to handle it
        throw error;
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
    async (to: string, callType: "direct" | "conference" = "direct") => {
      if (!deviceRef.current) throw new Error("Device not initialized");

      try {
        // Clean up any existing call first
        cleanupCallResources();

        console.log(`Making ${callType} call to: ${to}`);

        // First update the UI to show we're connecting
        if (callType === "conference") {
          updateCallStatus("connecting", `Joining conference ${to}...`);
        } else {
          updateCallStatus("connecting", `Calling ${to}...`);
        }

        // Store the destination identity
        updateState({ remoteIdentity: to });

        // Format destination based on call type
        let formattedTo;
        if (callType === "conference") {
          formattedTo = `conference:${to}`;
          console.log(`Formatted conference destination: ${formattedTo}`);
        } else {
          // Direct call
          formattedTo = to.startsWith("client:") ? to : `client:${to}`;
          console.log(`Formatted 1:1 call destination: ${formattedTo}`);
        }

        // Make the call with improved settings
        console.log("Calling Twilio Device.connect()...");
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

        console.log("Call initiated successfully, setting up call object");

        // Set up call listeners
        activeCallRef.current = call as TwilioCall;
        setupCallListeners(activeCallRef.current);

        // For direct calls, update to ringing state
        if (callType !== "conference") {
          updateCallStatus("ringing", `Calling ${to}...`);
        }

        return activeCallRef.current;
      } catch (error) {
        console.error("Call failed:", error);
        handleError(error, "Failed to make call");
        cleanupCallResources();
        // Reset status to ready
        updateCallStatus("ready", "");
        throw error;
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

  // Fetch available conferences
  const fetchConferences = useCallback(async () => {
    try {
      const { data } = await apiClient.get("/conferences");
      return data.conferences || [];
    } catch (error) {
      console.error("Error fetching conferences:", error);
      return [];
    }
  }, []);

  // Join a specific conference
  const joinConference = useCallback(
    (conferenceName: string) => {
      if (!deviceRef.current) {
        console.error("Cannot join conference - device not initialized");
        return Promise.reject(new Error("Device not initialized"));
      }

      if (!conferenceName.trim()) {
        console.error("Cannot join conference - empty conference name");
        return Promise.reject(new Error("Conference name cannot be empty"));
      }

      console.log(`Joining conference: ${conferenceName}`);

      // Update state immediately to provide user feedback
      updateCallStatus("connecting", `Joining conference ${conferenceName}...`);

      // Make the actual call
      try {
        return makeCall(conferenceName, "conference");
      } catch (error) {
        console.error("Failed to join conference:", error);
        // Reset state after a short delay
        setTimeout(() => {
          updateCallStatus("ready", "");
        }, 500);

        return Promise.reject(error);
      }
    },
    [makeCall, updateCallStatus, deviceRef]
  );

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
    fetchConferences,
    joinConference,
  };
};
