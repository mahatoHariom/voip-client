import { useState } from "react";
import { useTwilioVoice } from "../hooks/useTwilioVoice";

// Common button styles to reduce repetition
const buttonClass =
  "px-4 py-2 bg-white border border-gray-300 text-black rounded";
const disabledButtonClass =
  "px-4 py-2 bg-gray-100 border border-gray-300 text-gray-400 rounded";

const VoipCall = () => {
  const [identityInput, setIdentityInput] = useState<string>("");
  const [destination, setDestination] = useState<string>("");

  const {
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
    toggleMute,
  } = useTwilioVoice();

  const handleInitialize = async () => {
    if (!identityInput) return;
    await initialize(identityInput);
  };

  const handleMakeCall = async () => {
    if (!destination) return;
    try {
      await makeCall(destination);
    } catch (error) {
      console.error(error);
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
          <div className="flex space-x-4 mt-4">
            <button className={buttonClass} onClick={answerCall}>
              Answer
            </button>
            <button className={buttonClass} onClick={rejectCall}>
              Reject
            </button>
          </div>
        );

      case "open":
      case "connecting":
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
              <button className={buttonClass} onClick={endCall}>
                End Call
              </button>
              <button className={buttonClass} onClick={toggleMute}>
                {isMuted ? "Unmute" : "Mute"}
              </button>
            </div>
          </div>
        );

      case "ready":
      case "closed":
      case "ringing":
      case "reconnecting":
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
                  className={buttonClass}
                  onClick={handleMakeCall}
                  disabled={!destination}
                >
                  Call
                </button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  
  const StatusIndicator = () => (
    <div className="mb-4 p-2 border border-gray-200 bg-gray-50">
      <div className="flex justify-between items-center">
        <span className="text-gray-600 text-sm">Status:</span>
        <span>{callStatus}</span>
      </div>
    </div>
  );

  return (
    <div className="max-w-md mx-auto bg-white p-6 border border-gray-200 rounded">
      <h2 className="text-xl font-bold mb-4 text-center">VOIP Client</h2>

      {!isInitialized ? (
        renderClientInitializer()
      ) : (
        <div className="mb-4 p-2 border border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <span className="text-gray-600 text-sm">Identity:</span>
            <span className="text-gray-800">{identity}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-2 border border-red-200 bg-red-50 text-red-600">
          {error}
        </div>
      )}

      <StatusIndicator />
      {renderCallControls()}
    </div>
  );
};

export default VoipCall;
