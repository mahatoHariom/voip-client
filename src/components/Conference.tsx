import { useState, useEffect } from "react";
import { useTwilioVoice } from "../hooks/useTwilioVoice";

// Import styles
const buttonClass =
  "px-4 py-2 bg-white border border-gray-300 text-black rounded hover:bg-gray-50";
const disabledButtonClass =
  "px-4 py-2 bg-gray-100 border border-gray-300 text-gray-400 rounded cursor-not-allowed";

const Conference = () => {
  const [conferenceName, setConferenceName] = useState<string>("");
  const [identityInput, setIdentityInput] = useState<string>("");

  const {
    identity,
    isInitialized,
    joinConference,
    callStatus,
    endCall,
    toggleMute,
    isMuted,
    error,
    initialize,
  } = useTwilioVoice();

  const handleJoinConference = () => {
    if (!conferenceName.trim()) return;

    // Prevent rapid multiple join attempts
    if (
      callStatus === "connecting" ||
      callStatus === "open" ||
      callStatus === "reconnecting"
    ) {
      console.log(
        "Conference join already in progress or already connected, please wait..."
      );
      return;
    }

    console.log(`Attempting to join conference: ${conferenceName.trim()}`);
    try {
      // Display connecting status immediately for better UX
      const confName = conferenceName.trim();

      // Call the joinConference method
      joinConference(confName);

      console.log(`Join conference request submitted for ${confName}`);
    } catch (error) {
      console.error("Conference join error:", error);
      alert(
        `Failed to join conference: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  };

  const handleInitialize = async () => {
    if (!identityInput) return;
    console.log(
      `Attempting to initialize with identity for conference: ${identityInput}`
    );
    try {
      console.log(
        "About to call initialize method from useTwilioVoice in Conference"
      );
      await initialize(identityInput);
      console.log("Initialize method completed in Conference");
    } catch (error) {
      console.error("Initialization error in Conference component:", error);
      // Display more detailed error information to the user
      alert(
        `Failed to initialize for conference: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  };

  const isInConference =
    callStatus === "open" ||
    callStatus === "connecting" ||
    callStatus === "reconnecting";

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

  // Add a useEffect to monitor call status for debug purposes
  useEffect(() => {
    console.log(`Conference component - Call status changed: ${callStatus}`);
  }, [callStatus]);

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold">Conference Call</h2>
        {/* <StatusIndicator /> */}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded">
          {error}s
        </div>
      )}

      {/* Show initialization UI if not initialized */}
      {!isInitialized ? (
        renderClientInitializer()
      ) : (
        <>
          {/* Show identity when initialized */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded">
            <div className="text-sm text-gray-500">Logged in as:</div>
            <div className="font-medium text-blue-700">{identity}</div>
          </div>

          {/* Join Conference Form */}
          {!isInConference && (
            <div className="mb-4">
              <label className="block text-gray-600 mb-1 text-sm">
                Conference Name:
              </label>
              <div className="flex">
                <input
                  type="text"
                  className="px-3 py-2 border border-gray-300 rounded w-full"
                  placeholder="Enter conference name"
                  value={conferenceName}
                  onChange={(e) => setConferenceName(e.target.value)}
                />
                <button
                  className={`px-4 py-2 ml-2 bg-blue-500 text-white rounded ${
                    !conferenceName.trim()
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-blue-600"
                  }`}
                  onClick={handleJoinConference}
                  disabled={!conferenceName.trim()}
                >
                  Join Conference
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Create a new conference or join an existing one by entering its
                name.
              </p>
            </div>
          )}

          {/* Active Conference */}
          {isInConference && (
            <div className="text-center">
              <div className="mb-4">
                <div className="text-lg font-medium">
                  Conference:{" "}
                  <span className="text-blue-600">{conferenceName}</span>
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {callStatus === "connecting" && "Connecting to conference..."}
                  {callStatus === "reconnecting" &&
                    "Reconnecting to conference..."}
                  {callStatus === "open" && "You are in the conference"}
                </div>
              </div>

              <div className="flex justify-center space-x-4">
                <button
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded"
                  onClick={endCall}
                >
                  Leave Conference
                </button>
                <button
                  className={`px-4 py-2 rounded border ${
                    isMuted
                      ? "bg-yellow-50 border-yellow-300"
                      : "bg-white border-gray-300"
                  }`}
                  onClick={toggleMute}
                >
                  {isMuted ? "Unmute" : "Mute"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// // Status indicator component
// const StatusIndicator = () => {
//   const { callStatus } = useTwilioVoice();

//   const getStatusColor = () => {
//     switch (callStatus) {
//       case "ready":
//         return "bg-green-100 text-green-800 border-green-200";
//       case "error":
//         return "bg-red-100 text-red-800 border-red-200";
//       case "open":
//         return "bg-blue-100 text-blue-800 border-blue-200";
//       case "connecting":
//         return "bg-blue-100 text-blue-800 border-blue-200";
//       case "reconnecting":
//         return "bg-yellow-100 text-yellow-800 border-yellow-200";
//       case "pending":
//         return "bg-yellow-100 text-yellow-800 border-yellow-200";
//       case "ringing":
//         return "bg-blue-100 text-blue-800 border-blue-200";
//       default:
//         return "bg-gray-100 text-gray-800 border-gray-200";
//     }
//   };

//   const getDotColor = () => {
//     switch (callStatus) {
//       case "ready":
//         return "bg-green-500";
//       case "error":
//         return "bg-red-500";
//       case "open":
//         return "bg-blue-500";
//       case "connecting":
//         return "bg-blue-500 animate-pulse";
//       case "reconnecting":
//         return "bg-yellow-500 animate-pulse";
//       case "pending":
//         return "bg-yellow-500";
//       case "ringing":
//         return "bg-blue-500 animate-pulse";
//       default:
//         return "bg-gray-500";
//     }
//   };

//   return (
//     <div
//       className={`px-2 py-1 rounded-full text-xs font-medium inline-flex items-center border ${getStatusColor()}`}
//     >
//       <span className={`w-2 h-2 rounded-full mr-1 ${getDotColor()}`}></span>
//       {callStatus}
//     </div>
//   );
// };

export default Conference;
