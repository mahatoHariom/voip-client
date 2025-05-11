import { useState, useEffect } from "react";
import { useTwilioVoice } from "../hooks/useTwilioVoice";

// Common button styles for consistency
const buttonClass =
  "px-4 py-2 bg-white border border-gray-300 text-black rounded hover:bg-gray-50";
const disabledButtonClass =
  "px-4 py-2 bg-gray-100 border border-gray-300 text-gray-400 rounded cursor-not-allowed";
const actionButtonClass = "px-4 py-2 rounded text-white font-medium";

const VoipCall = () => {
  const [identityInput, setIdentityInput] = useState<string>("");
  const [destination, setDestination] = useState<string>("");
  const [callAttempts, setCallAttempts] = useState<number>(0);
  const [lastCalledDestination, setLastCalledDestination] =
    useState<string>("");

  const {
    identity,
    callStatus,
    error,
    isMuted,
    isInitialized,
    callInfo,
    remoteIdentity,
    initialize,
    makeCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
  } = useTwilioVoice();

  // Log state changes for debugging
  useEffect(() => {
    console.log("Call status:", callStatus);
    console.log("Call info:", callInfo);
    console.log("Remote identity:", remoteIdentity);
  }, [callStatus, callInfo, remoteIdentity]);

  // Reset call attempts when destination changes
  useEffect(() => {
    if (destination !== lastCalledDestination) {
      setCallAttempts(0);
    }
  }, [destination, lastCalledDestination]);

  const handleInitialize = async () => {
    if (!identityInput) return;
    try {
      await initialize(identityInput);
    } catch (error) {
      console.error("Initialization error:", error);
    }
  };

  const handleMakeCall = async () => {
    if (!destination) return;
    try {
      setCallAttempts((prev) => prev + 1);
      setLastCalledDestination(destination);
      await makeCall(destination);
    } catch (error) {
      console.error("Call error:", error);
    }
  };

  const renderClientInitializer = () => (
    <div className="mb-4">
      <label className="block text-gray-600 mb-1 text-sm">Your Identity:</label>
      <div className="flex">
        <input
          type="text"
          className="px-3 py-2 border border-gray-300 rounded w-full"
          placeholder="Enter your identity"
          value={identityInput}
          onChange={(e) => setIdentityInput(e.target.value)}
          disabled={callStatus === "initializing"}
        />
        <button
          className={
            callStatus === "initializing" ? disabledButtonClass : buttonClass
          }
          onClick={handleInitialize}
          disabled={callStatus === "initializing"}
        >
          {callStatus === "initializing" ? "Initializing..." : "Initialize"}
        </button>
      </div>
    </div>
  );

  const renderCallControls = () => {
    switch (callStatus) {
      case "pending":
        return (
          <div className="flex flex-col items-center mt-4">
            <div className="text-center mb-4 font-medium">
              Incoming call...
              {callInfo && (
                <div className="text-sm text-gray-500 mt-1">{callInfo}</div>
              )}
            </div>
            <div className="flex space-x-4">
              <button
                className={`${actionButtonClass} bg-green-500 hover:bg-green-600`}
                onClick={answerCall}
              >
                Answer
              </button>
              <button
                className={`${actionButtonClass} bg-red-500 hover:bg-red-600`}
                onClick={rejectCall}
              >
                Reject
              </button>
            </div>
          </div>
        );

      case "open":
      case "connecting":
      case "reconnecting":
        return (
          <div className="flex flex-col items-center mt-4">
            <div className="text-center mb-2">
              {callStatus === "connecting" ? (
                <div className="font-medium">Connecting...</div>
              ) : callStatus === "reconnecting" ? (
                <div className="font-medium text-yellow-600">
                  Reconnecting...
                </div>
              ) : (
                <div className="font-medium">
                  In Call with {remoteIdentity || "..."}
                </div>
              )}

              {callInfo && (
                <div className="text-xs text-gray-500 mt-1">{callInfo}</div>
              )}
            </div>

            <div className="flex space-x-4">
              <button
                className={`${actionButtonClass} bg-red-500 hover:bg-red-600`}
                onClick={endCall}
              >
                End Call
              </button>
              <button
                className={`${buttonClass} ${isMuted ? "bg-yellow-50" : ""}`}
                onClick={toggleMute}
              >
                {isMuted ? "Unmute" : "Mute"}
              </button>
            </div>
          </div>
        );

      case "ready":
      case "closed":
      case "ringing":
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
                  className={
                    destination
                      ? `${actionButtonClass} bg-blue-500 hover:bg-blue-600`
                      : disabledButtonClass
                  }
                  onClick={handleMakeCall}
                  disabled={!destination}
                >
                  Call
                </button>
              </div>
              {callInfo && callStatus === "closed" ? (
                <div className="mt-2 text-sm text-gray-600">{callInfo}</div>
              ) : (
                callAttempts > 0 &&
                callStatus === "closed" &&
                destination === lastCalledDestination && (
                  <div className="mt-2 text-sm text-red-600">
                    Call attempt failed. Please check that the destination
                    client is online and try again.
                  </div>
                )
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const StatusIndicator = () => (
    <div
      className={`px-2 py-1 rounded-full text-xs font-medium inline-flex items-center ${
        callStatus === "ready"
          ? "bg-green-100 text-green-800"
          : callStatus === "error"
          ? "bg-red-100 text-red-800"
          : callStatus === "open"
          ? "bg-blue-100 text-blue-800"
          : callStatus === "connecting"
          ? "bg-blue-100 text-blue-800"
          : callStatus === "reconnecting"
          ? "bg-yellow-100 text-yellow-800"
          : callStatus === "pending"
          ? "bg-yellow-100 text-yellow-800"
          : "bg-gray-100 text-gray-800"
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full mr-1 ${
          callStatus === "ready"
            ? "bg-green-500"
            : callStatus === "error"
            ? "bg-red-500"
            : callStatus === "open"
            ? "bg-blue-500"
            : callStatus === "connecting"
            ? "bg-blue-500 animate-pulse"
            : callStatus === "reconnecting"
            ? "bg-yellow-500 animate-pulse"
            : callStatus === "pending"
            ? "bg-yellow-500"
            : "bg-gray-500"
        }`}
      ></span>
      {callStatus}
    </div>
  );

  return (
    <div className="max-w-md mx-auto p-4 bg-white rounded-lg shadow-md">
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold">Simple VoIP Call</h2>
        <StatusIndicator />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded">
          {error}
        </div>
      )}

      {!isInitialized ? renderClientInitializer() : null}

      {isInitialized && (
        <div className="mb-2">
          <div className="text-sm text-gray-500">Logged in as:</div>
          <div className="font-medium">{identity}</div>
        </div>
      )}

      {isInitialized && renderCallControls()}
    </div>
  );
};

export default VoipCall;
