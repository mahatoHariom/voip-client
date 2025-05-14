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
  const [callDuration, setCallDuration] = useState<number>(0);
  const [callTimer, setCallTimer] = useState<number | null>(null);

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

  // Format call duration as MM:SS
  const formatCallDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // Handle call timer for active calls
  useEffect(() => {
    // Start timer when call is open
    if (callStatus === "open") {
      if (callTimer === null) {
        const timer = window.setInterval(() => {
          setCallDuration((prev) => prev + 1);
        }, 1000);
        setCallTimer(timer);
      }
    } else {
      // Clear timer when call ends
      if (callTimer !== null) {
        window.clearInterval(callTimer);
        setCallTimer(null);

        // Reset duration when call is fully closed
        if (callStatus === "closed" || callStatus === "ready") {
          setCallDuration(0);
        }
      }
    }

    return () => {
      if (callTimer !== null) {
        window.clearInterval(callTimer);
      }
    };
  }, [callStatus, callTimer]);

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
          disabled={callStatus === "initializing" || !identityInput.trim()}
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
            <div className="text-center mb-4">
              <div className="font-medium text-lg">Incoming call</div>
              <div className="text-blue-600 font-medium">
                {remoteIdentity || "Unknown caller"}
              </div>
              {callInfo && (
                <div className="text-sm text-gray-500 mt-1">{callInfo}</div>
              )}
            </div>
            <div className="flex space-x-4">
              <button
                className={`${actionButtonClass} bg-green-500 hover:bg-green-600 flex items-center`}
                onClick={answerCall}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-1"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                </svg>
                Answer
              </button>
              <button
                className={`${actionButtonClass} bg-red-500 hover:bg-red-600 flex items-center`}
                onClick={rejectCall}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-1"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
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
            <div className="text-center mb-4">
              {callStatus === "connecting" ? (
                <div className="font-medium">Connecting...</div>
              ) : callStatus === "reconnecting" ? (
                <div className="font-medium text-yellow-600">
                  Reconnecting...
                </div>
              ) : (
                <>
                  <div className="font-medium text-lg">
                    In Call with{" "}
                    <span className="text-blue-600">
                      {remoteIdentity || "..."}
                    </span>
                  </div>
                  <div className="text-sm font-medium mt-1">
                    {formatCallDuration(callDuration)}
                  </div>
                </>
              )}

              {callInfo && (
                <div className="text-xs text-gray-500 mt-1">{callInfo}</div>
              )}
            </div>

            <div className="flex space-x-4">
              <button
                className={`${actionButtonClass} bg-red-500 hover:bg-red-600 flex items-center`}
                onClick={endCall}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-1"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                </svg>
                End Call
              </button>
              <button
                className={`${buttonClass} ${
                  isMuted ? "bg-yellow-50 border-yellow-300" : ""
                } flex items-center`}
                onClick={toggleMute}
              >
                {isMuted ? (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mr-1"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Unmute
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mr-1"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Mute
                  </>
                )}
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
                Call Another User:
              </label>
              <div className="flex">
                <input
                  type="text"
                  className="px-3 py-2 border border-gray-300 rounded w-full"
                  placeholder="Enter destination identity"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                />
                <button
                  className={
                    destination.trim()
                      ? `${actionButtonClass} bg-blue-500 hover:bg-blue-600 flex items-center`
                      : disabledButtonClass
                  }
                  onClick={handleMakeCall}
                  disabled={!destination.trim()}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-1"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                  </svg>
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

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold">Direct Call</h2>
        <StatusIndicator />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded">
          {error}
        </div>
      )}

      {!isInitialized ? renderClientInitializer() : null}

      {isInitialized && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded">
          <div className="text-sm text-gray-500">Logged in as:</div>
          <div className="font-medium text-blue-700">{identity}</div>
        </div>
      )}

      {isInitialized && renderCallControls()}

      <div className="mt-6 text-xs text-gray-500 text-center">
        <p>
          Enter the same identity on another browser window to test calls
          between clients.
        </p>
      </div>
    </div>
  );
};

// Extract StatusIndicator to its own component (will be moved to a separate file later)
const StatusIndicator = () => {
  const { callStatus } = useTwilioVoice();

  const getStatusColor = () => {
    switch (callStatus) {
      case "ready":
        return "bg-green-100 text-green-800 border-green-200";
      case "error":
        return "bg-red-100 text-red-800 border-red-200";
      case "open":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "connecting":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "reconnecting":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "ringing":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getDotColor = () => {
    switch (callStatus) {
      case "ready":
        return "bg-green-500";
      case "error":
        return "bg-red-500";
      case "open":
        return "bg-blue-500";
      case "connecting":
        return "bg-blue-500 animate-pulse";
      case "reconnecting":
        return "bg-yellow-500 animate-pulse";
      case "pending":
        return "bg-yellow-500";
      case "ringing":
        return "bg-blue-500 animate-pulse";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div
      className={`px-2 py-1 rounded-full text-xs font-medium inline-flex items-center border ${getStatusColor()}`}
    >
      <span className={`w-2 h-2 rounded-full mr-1 ${getDotColor()}`}></span>
      {callStatus}
    </div>
  );
};

export default VoipCall;
