import { useState, useEffect } from "react";
import twilioService from "../services/twilioService";

const VoipCall = () => {
  const [identity, setIdentity] = useState<string>("");
  const [destination, setDestination] = useState<string>("");
  const [callStatus, setCallStatus] = useState<string>("disconnected");
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [showTroubleshooting, setShowTroubleshooting] =
    useState<boolean>(false);

  useEffect(() => {
    // Cleanup resources when component unmounts
    return () => {
      twilioService.destroy();
    };
  }, []);

  const handleInitialize = async () => {
    if (!identity) {
      setError("Please enter your identity");
      return;
    }

    setError("");
    setCallStatus("initializing");

    try {
      await twilioService.initialize(identity, (status) => {
        console.log(`Call status changed to: ${status}`);

        // Check if the status contains error information
        if (status.startsWith("error:")) {
          setError(status.substring(7)); // Remove "error: " prefix
          setCallStatus("error");
        } else {
          setCallStatus(status);
          if (status === "ready") {
            setError("");
          }
        }
      });
      setIsInitialized(true);
    } catch (error) {
      console.error("Error initializing Twilio:", error);
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
    } catch (error) {
      console.error("Error making call:", error);
      setError("Failed to initiate call");
    }
  };

  const handleAnswerCall = () => {
    try {
      twilioService.answerCall();
    } catch (error) {
      console.error("Error answering call:", error);
      setError("Failed to answer call");
    }
  };

  const handleRejectCall = () => {
    try {
      twilioService.rejectCall();
    } catch (error) {
      console.error("Error rejecting call:", error);
      setError("Failed to reject call");
    }
  };

  const handleEndCall = () => {
    try {
      twilioService.endCall();
    } catch (error) {
      console.error("Error ending call:", error);
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
    } catch (error) {
      console.error("Error toggling mute:", error);
      setError("Failed to toggle mute");
    }
  };

  const renderCallControls = () => {
    if (callStatus === "incoming") {
      return (
        <div className="flex space-x-4 mt-4">
          <button
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            onClick={handleAnswerCall}
          >
            Answer
          </button>
          <button
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            onClick={handleRejectCall}
          >
            Reject
          </button>
        </div>
      );
    }

    if (callStatus === "in-progress" || callStatus === "connecting") {
      return (
        <div className="flex space-x-4 mt-4">
          <button
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            onClick={handleEndCall}
          >
            End Call
          </button>
          <button
            className={`px-4 py-2 ${
              isMuted ? "bg-blue-600" : "bg-gray-600"
            } text-white rounded hover:bg-blue-700`}
            onClick={handleToggleMute}
          >
            {isMuted ? "Unmute" : "Mute"}
          </button>
        </div>
      );
    }

    if (
      (isInitialized && callStatus === "ready") ||
      callStatus === "disconnected"
    ) {
      return (
        <div className="mt-4">
          <div className="flex items-center space-x-2 mb-4">
            <input
              type="text"
              className="px-4 py-2 border rounded w-full"
              placeholder="Enter destination client identity"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
            <button
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              onClick={handleMakeCall}
            >
              Call
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderTroubleshooting = () => {
    if (!showTroubleshooting) {
      return (
        <button
          onClick={() => setShowTroubleshooting(true)}
          className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
        >
          Show troubleshooting tips
        </button>
      );
    }

    return (
      <div className="mt-4 p-4 bg-blue-50 rounded text-sm">
        <h3 className="font-bold mb-2">Troubleshooting Tips:</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>Check that your browser allows microphone access</li>
          <li>
            Ensure you're using a supported browser (Chrome, Firefox, Edge)
          </li>
          <li>
            Verify that the server is running at{" "}
            <code>http://localhost:9000</code>
          </li>
          <li>Make sure ngrok is running and the URL is correct</li>
          <li>
            Check that your Twilio account is active and configured properly
          </li>
          <li>
            Verify network connectivity and firewalls aren't blocking WebRTC
          </li>
        </ul>
        <button
          onClick={() => setShowTroubleshooting(false)}
          className="mt-2 text-blue-600 hover:text-blue-800"
        >
          Hide tips
        </button>
      </div>
    );
  };

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-center">VOIP Client</h2>

      {!isInitialized ? (
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Your Identity:</label>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              className="px-4 py-2 border rounded w-full"
              placeholder="Enter your identity"
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
              disabled={callStatus === "initializing"}
            />
            <button
              className={`px-4 py-2 ${
                callStatus === "initializing"
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              } text-white rounded`}
              onClick={handleInitialize}
              disabled={callStatus === "initializing"}
            >
              {callStatus === "initializing" ? "Initializing..." : "Initialize"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-4">
          <div className="flex justify-between items-center">
            <span className="font-medium">Identity:</span>
            <span>{identity}</span>
          </div>
        </div>
      )}

      <div className="mb-4">
        <div className="flex justify-between items-center">
          <span className="font-medium">Status:</span>
          <span
            className={`px-2 py-1 rounded text-sm ${
              callStatus === "in-progress"
                ? "bg-green-100 text-green-800"
                : callStatus === "connecting" || callStatus === "incoming"
                ? "bg-yellow-100 text-yellow-800"
                : callStatus === "error"
                ? "bg-red-100 text-red-800"
                : callStatus === "ready"
                ? "bg-blue-100 text-blue-800"
                : "bg-gray-100 text-gray-800"
            }`}
          >
            {callStatus}
          </span>
        </div>
      </div>

      {renderCallControls()}

      {error && (
        <div className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded">
          <p>{error}</p>
          {renderTroubleshooting()}
        </div>
      )}
    </div>
  );
};

export default VoipCall;
