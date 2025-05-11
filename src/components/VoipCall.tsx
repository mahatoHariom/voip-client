import { useState, useEffect } from "react";
import { useTwilioVoice } from "../hooks/useTwilioVoice";

// Common button styles to reduce repetition
const buttonClass =
  "px-4 py-2 bg-white border border-gray-300 text-black rounded";
const disabledButtonClass =
  "px-4 py-2 bg-gray-100 border border-gray-300 text-gray-400 rounded";
const actionButtonClass = "px-4 py-2 rounded text-white";

const VoipCall = () => {
  const [identityInput, setIdentityInput] = useState<string>("");
  const [destination, setDestination] = useState<string>("");

  const {
    identity,
    callStatus,
    error,
    isMuted,
    isInitialized,
    conferenceState,
    incomingInvite,
    initialize,
    makeCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    acceptConferenceInvite,
    rejectConferenceInvite,
  } = useTwilioVoice();

  // Log state changes for debugging
  useEffect(() => {
    console.log("Call status:", callStatus);
    console.log("Incoming invite:", incomingInvite);
  }, [callStatus, incomingInvite]);

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

  // Render notification for incoming conference invites (even during an active call)
  const renderIncomingConferenceNotification = () => {
    if (!incomingInvite) return null;

    return (
      <div className="mb-4 p-3 border-2 border-yellow-500 bg-yellow-100 rounded-lg shadow-md animate-pulse">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="text-lg font-semibold text-yellow-800">
              Incoming Call
            </div>
            <div className="text-md text-yellow-700">
              {incomingInvite.from} is calling to join your conversation
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded-md"
              onClick={acceptConferenceInvite}
            >
              Accept
            </button>
            <button
              className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-md"
              onClick={rejectConferenceInvite}
            >
              Reject
            </button>
          </div>
        </div>
      </div>
    );
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

  const renderIncomingConferenceInvite = () => {
    if (!incomingInvite) return null;

    return (
      <div className="mb-4 p-4 border border-yellow-200 bg-yellow-50 rounded">
        <div className="mb-2 font-medium">
          {incomingInvite.from} is calling you to join a conference
        </div>
        <div className="flex space-x-4">
          <button
            className={`${actionButtonClass} bg-green-500 hover:bg-green-600`}
            onClick={acceptConferenceInvite}
          >
            Accept
          </button>
          <button
            className={`${actionButtonClass} bg-red-500 hover:bg-red-600`}
            onClick={rejectConferenceInvite}
          >
            Reject
          </button>
        </div>
      </div>
    );
  };

  const renderConferenceParticipants = () => {
    if (
      !conferenceState.isConference ||
      conferenceState.participants.length === 0
    )
      return null;

    return (
      <div className="mb-4 p-2 border border-blue-200 bg-blue-50 rounded">
        <div className="text-sm font-medium mb-1">Conference Participants:</div>
        <ul className="list-disc pl-5">
          {conferenceState.participants.map((participant) => (
            <li key={participant.identity}>{participant.identity}</li>
          ))}
        </ul>
      </div>
    );
  };

  const renderCallControls = () => {
    const isConference = callStatus === "conference";

    // Always show incoming conference invites if present
    if (incomingInvite && !["open", "conference"].includes(callStatus)) {
      return (
        <div className="flex flex-col">{renderIncomingConferenceInvite()}</div>
      );
    }

    switch (callStatus) {
      case "pending":
        return (
          <div className="flex space-x-4 mt-4">
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
        );

      case "open":
      case "connecting":
      case "conference":
        return (
          <div className="flex flex-col items-center mt-4">
            <div className="text-center mb-2">
              {callStatus === "connecting" ? (
                <div>Connecting...</div>
              ) : isConference ? (
                <div className="font-medium">In Conference Call</div>
              ) : (
                <div>In Call with {destination}</div>
              )}
            </div>

            {renderConferenceParticipants()}

            <div className="flex space-x-4">
              <button
                className={`${actionButtonClass} bg-red-500 hover:bg-red-600`}
                onClick={endCall}
              >
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

      {/* Always show incoming conference notifications at the top if they exist */}
      {isInitialized &&
        incomingInvite &&
        ["open", "conference"].includes(callStatus) &&
        renderIncomingConferenceNotification()}

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
