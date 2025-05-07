import { useState, useEffect } from "react";
import twilioService from "../services/twilioService";

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

const VoipCall = () => {
  const [identity, setIdentity] = useState<string>("");
  const [destination, setDestination] = useState<string>("");
  const [callStatus, setCallStatus] = useState<CallStatus>("disconnected");
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    return () => twilioService.destroy();
  }, []);

  console.log(error);

  const handleInitialize = async () => {
    if (!identity) {
      setError("Please enter your identity");
      return;
    }

    setError("");
    setCallStatus("initializing");

    try {
      await twilioService.initialize(identity, (status) => {
        if (status.startsWith("error:")) {
          setError(status.substring(7));
          setCallStatus("error");
        } else {
          setCallStatus(status as CallStatus);
          if (status === "ready") setError("");
        }
      });
      setIsInitialized(true);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to initialize Twilio service";
      setError(`Twilio error: ${errorMessage}`);
      setCallStatus("error");
      setIsInitialized(false);
    }
  };

  const handleMakeCall = async () => {
    if (!destination) {
      setError("Please enter a destination client identity");
      return;
    }

    setError("");
    try {
      await twilioService.makeCall(destination);
    } catch (error: unknown) {
      console.error(error);
      setError("Failed to initiate call");
    }
  };

  const handleAnswerCall = () => {
    try {
      twilioService.answerCall();
    } catch (error: unknown) {
      console.error(error);
      setError("Failed to answer call");
    }
  };

  const handleRejectCall = () => {
    try {
      twilioService.rejectCall();
    } catch (error: unknown) {
      console.error(error);
      setError("Failed to reject call");
    }
  };

  const handleEndCall = () => {
    try {
      twilioService.endCall();
    } catch (error: unknown) {
      console.error(error);
      setError("Failed to end call");
    }
  };

  const handleToggleMute = () => {
    try {
      if (isMuted) {
        twilioService.unmute();
      } else {
        twilioService.mute();
      }
      setIsMuted(!isMuted);
    } catch (error: unknown) {
      console.error(error);
      setError("Failed to toggle mute");
    }
  };

  const renderCallControls = () => {
    if (callStatus === "incoming") {
      return (
        <div className="flex space-x-4 mt-4">
          <button
            className="px-4 py-2 bg-white border border-gray-300 text-black rounded"
            onClick={handleAnswerCall}
          >
            Answer
          </button>
          <button
            className="px-4 py-2 bg-white border border-gray-300 text-black rounded"
            onClick={handleRejectCall}
          >
            Reject
          </button>
        </div>
      );
    }

    if (callStatus === "in-progress" || callStatus === "connecting") {
      return (
        <div className="flex flex-col items-center mt-4">
          <div className="text-center mb-2">
            {callStatus === "connecting" ? (
              <div>Connecting...</div>
            ) : (
              <div>In Call with {destination}</div>
            )}
          </div>
          <div className="flex space-x-4">
            <button
              className="px-4 py-2 bg-white border border-gray-300 text-black rounded"
              onClick={handleEndCall}
            >
              End Call
            </button>
            <button
              className="px-4 py-2 bg-white border border-gray-300 text-black rounded"
              onClick={handleToggleMute}
            >
              {isMuted ? "Unmute" : "Mute"}
            </button>
          </div>
        </div>
      );
    }

    if (
      (isInitialized && callStatus === "ready") ||
      callStatus === "disconnected"
    ) {
      return (
        <div className="mt-4">
          <div className="flex flex-col">
            <label className="block text-gray-600 mb-1 text-sm">
              Destination Client Identity:
            </label>
            <div className="flex">
              <input
                type="text"
                className="px-3 py-2 border border-gray-300 rounded w-full"
                placeholder="Enter destination client identity"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />
              <button
                className="ml-2 px-4 py-2 bg-white border border-gray-300 text-black rounded"
                onClick={handleMakeCall}
              >
                Call
              </button>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="max-w-md mx-auto bg-white p-6 border border-gray-200 rounded">
      <h2 className="text-xl font-bold mb-4 text-center">VOIP Client</h2>

      {!isInitialized ? (
        <div className="mb-4">
          <label className="block text-gray-600 mb-1 text-sm">
            Your Identity:
          </label>
          <div className="flex">
            <input
              type="text"
              className="px-3 py-2 border border-gray-300 rounded w-full"
              placeholder="Enter your identity"
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
              disabled={callStatus === "initializing"}
            />
            <button
              className="ml-2 px-4 py-2 bg-white border border-gray-300 text-black rounded disabled:bg-gray-100 disabled:text-gray-400"
              onClick={handleInitialize}
              disabled={callStatus === "initializing"}
            >
              {callStatus === "initializing" ? "Initializing..." : "Initialize"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-4 p-2 border border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <span className="text-gray-600 text-sm">Identity:</span>
            <span className="text-gray-800">{identity}</span>
          </div>
        </div>
      )}

      <div className="mb-4 p-2 border border-gray-200 bg-gray-50">
        <div className="flex justify-between items-center">
          <span className="text-gray-600 text-sm">Status:</span>
          <span>{callStatus}</span>
        </div>
      </div>

      {renderCallControls()}
    </div>
  );
};

export default VoipCall;
