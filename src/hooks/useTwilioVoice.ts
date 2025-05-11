import { useState, useCallback, useEffect, useRef } from "react";
import { Device, Call } from "@twilio/voice-sdk";
import apiClient from "../utils/apiClient";
import type { CallStatus, ConferenceState, CallParticipant } from "../types";

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

// Define a more specific type for Twilio Call that includes the 'on' method
interface TwilioCall extends Call {
  on(
    event: "accept" | "disconnect" | "cancel" | "reject",
    listener: () => void
  ): this;
  customParameters: Map<string, string>;
}

interface IncomingInvite {
  inviteId: string;
  from: string;
  to: string;
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
    conferenceState: ConferenceState;
    incomingInvite: IncomingInvite | null;
  }>({
    identity: "",
    callStatus: "closed",
    error: "",
    isMuted: false,
    isInitialized: false,
    conferenceState: {
      isConference: false,
      participants: [],
      pendingInvites: [],
    },
    incomingInvite: null,
  });

  const deviceRef = useRef<Device | null>(null);
  const activeCallRef = useRef<TwilioCall | null>(null);
  const callParamsRef = useRef<Record<string, string>>({});
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
    (call: TwilioCall, customParams?: Record<string, string>) => {
      // Store custom parameters
      if (customParams) {
        callParamsRef.current = customParams;
      }

      call.on("accept", () => {
        // Use our stored parameters or get them from the call if available
        const params = callParamsRef.current || {};
        const isConference = params.isConference === "true";

        if (isConference) {
          // This is a conference call
          const participantsString = params.participants || "";
          const participants: CallParticipant[] = participantsString
            ? JSON.parse(participantsString)
            : [];

          updateState({
            callStatus: "conference",
            conferenceState: {
              isConference: true,
              participants,
              pendingInvites: [],
            },
          });
        } else {
          // This is a regular 1:1 call
          updateCallStatus("open");

          // Reset conference state for normal calls
          updateState({
            conferenceState: {
              isConference: false,
              participants: [],
              pendingInvites: [],
            },
          });
        }
      });

      ["disconnect", "cancel", "reject"].forEach((event) => {
        call.on(event as "disconnect" | "cancel" | "reject", () => {
          activeCallRef.current = null;
          callParamsRef.current = {};
          updateCallStatus("closed");
          updateState({
            isMuted: false,
            conferenceState: {
              isConference: false,
              participants: [],
              pendingInvites: [],
            },
          });
        });
      });
    },
    [updateCallStatus, updateState]
  );

  const handleIncomingConferenceInvite = useCallback(
    (invite: IncomingInvite) => {
      console.log("Received incoming conference invite:", invite);

      // Always show the conference invite UI regardless of current call status
      updateState({
        incomingInvite: invite,
      });

      // Sound notification for incoming conference call
      // We'll create a simple notification sound using Web Audio API
      try {
        // Use proper type for AudioContext
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const audioContext = new AudioContextClass();

        // Create oscillator for notification sound
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4 note

        // Control volume
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(
          0.01,
          audioContext.currentTime + 1
        );

        // Connect nodes
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Play sound
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 1); // Stop after 1 second

        console.log(
          "Playing notification sound for incoming conference invite"
        );

        // Vibrate if supported on mobile
        if ("vibrate" in navigator) {
          navigator.vibrate([200, 100, 200]);
        }
      } catch (err) {
        console.log("Could not play notification sound", err);
      }
    },
    [updateState]
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
          // Get the call as a TwilioCall to access the on method
          const twilioCall = incomingCall as TwilioCall;

          // Check if this is a conference invite or regular call
          const params =
            twilioCall.customParameters || new Map<string, string>();
          const customParams: Record<string, string> = {};

          // Convert Map to Record
          params.forEach((value, key) => {
            customParams[key] = value;
          });

          if (customParams.inviteId) {
            // This is a conference invite
            handleIncomingConferenceInvite({
              inviteId: customParams.inviteId,
              from: customParams.from || "unknown",
              to: userIdentity,
            });
          } else {
            // Regular incoming call
            activeCallRef.current = twilioCall;
            updateCallStatus("pending");
            setupCallListeners(twilioCall, customParams);
          }
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
    [
      getToken,
      setupCallListeners,
      updateCallStatus,
      updateState,
      handleIncomingConferenceInvite,
    ]
  );

  const makeCall = useCallback(
    async (to: string) => {
      if (!deviceRef.current) throw new Error("Twilio device not initialized");

      try {
        console.log(`Making call to: ${to} from: ${state.identity}`);

        // Make sure 'to' is properly formatted as client:identity
        const formattedTo = to.startsWith("client:") ? to : `client:${to}`;

        const call = await deviceRef.current.connect({
          params: {
            To: formattedTo,
            From: `client:${state.identity}`,
          },
        });

        console.log(`Call initiated successfully`);

        // Cast to TwilioCall to get access to the 'on' method
        activeCallRef.current = call as TwilioCall;
        const customParams = {
          to: formattedTo,
          from: `client:${state.identity}`,
        };
        setupCallListeners(activeCallRef.current, customParams);

        updateCallStatus("connecting");
      } catch (error) {
        console.error("Call failed:", error);
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
      callParamsRef.current = {};
    } catch (error) {
      handleError(error, "Failed to reject call");
    }
  }, [checkActiveCall, handleError]);

  const endCall = useCallback(() => {
    try {
      const call = checkActiveCall();
      call.disconnect();
      activeCallRef.current = null;
      callParamsRef.current = {};
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

  // Accept a conference invite
  const acceptConferenceInvite = useCallback(async () => {
    if (!state.incomingInvite) {
      handleError(
        new Error("No active conference invite"),
        "Failed to accept invite"
      );
      return;
    }

    try {
      if (!deviceRef.current) throw new Error("Twilio device not initialized");

      const { inviteId } = state.incomingInvite;
      console.log(`Accepting conference invite: ${inviteId}`);

      // Connect to the conference through the Twilio voice response
      const call = await deviceRef.current.connect({
        params: {
          inviteId,
          action: "accept",
          From: state.identity,
        },
      });

      // Cast to TwilioCall to get access to the 'on' method
      activeCallRef.current = call as TwilioCall;
      const customParams = {
        inviteId,
        from: state.identity,
        isConference: "true",
      };
      setupCallListeners(activeCallRef.current, customParams);
      updateCallStatus("connecting");

      // Reset the incoming invite
      updateState({ incomingInvite: null });
      console.log("Conference invite accepted");
    } catch (error) {
      handleError(error, "Failed to join conference");
    }
  }, [
    state.incomingInvite,
    state.identity,
    setupCallListeners,
    updateCallStatus,
    updateState,
    handleError,
  ]);

  // Reject a conference invite
  const rejectConferenceInvite = useCallback(async () => {
    if (!state.incomingInvite) {
      handleError(
        new Error("No active conference invite"),
        "Failed to reject invite"
      );
      return;
    }

    try {
      const { inviteId } = state.incomingInvite;
      console.log(`Rejecting conference invite: ${inviteId}`);

      // Send the reject action to the server
      await apiClient.post("/voice", {
        inviteId,
        action: "reject",
        identity: state.identity,
      });

      // Reset the incoming invite
      updateState({
        incomingInvite: null,
      });
      console.log("Conference invite rejected");
    } catch (error) {
      handleError(error, "Failed to reject conference invite");
    }
  }, [state.incomingInvite, state.identity, updateState, handleError]);

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

  // Poll for incoming invites
  const pollForInvites = useCallback(async () => {
    if (!state.isInitialized || !state.identity) return;

    try {
      const { data } = await apiClient.get(
        `/check-invites?identity=${state.identity}`
      );

      if (data.hasInvites && data.invites.length > 0) {
        // Take the first invite (we'll handle one at a time)
        const invite = data.invites[0];
        console.log(
          `Received conference invite via polling: ${JSON.stringify(invite)}`
        );

        // Only update if we don't already have this invite
        if (
          !state.incomingInvite ||
          state.incomingInvite.inviteId !== invite.inviteId
        ) {
          console.log("Updating state with new conference invite");
          handleIncomingConferenceInvite({
            inviteId: invite.inviteId,
            from: invite.from,
            to: invite.to,
          });
        }
      }
    } catch (error) {
      console.error("Error polling for invites:", error);
    }
  }, [
    state.isInitialized,
    state.identity,
    state.incomingInvite,
    handleIncomingConferenceInvite,
  ]);

  // Set up polling interval when initialized
  useEffect(() => {
    if (!state.isInitialized) return;

    // Poll immediately on init
    pollForInvites();

    // Poll more frequently (every 1.5 seconds) when in a call to ensure quick response to join requests
    const pollInterval = ["open", "conference"].includes(state.callStatus)
      ? 1500
      : 3000;

    console.log(`Setting up polling interval: ${pollInterval}ms`);
    const interval = setInterval(pollForInvites, pollInterval);

    return () => clearInterval(interval);
  }, [state.isInitialized, state.callStatus, pollForInvites]);

  return {
    ...state,
    initialize,
    makeCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    destroy,
    acceptConferenceInvite,
    rejectConferenceInvite,
  };
};
