export type CallStatus =
  | "closed"
  | "connecting"
  | "open"
  | "pending"
  | "reconnecting"
  | "ringing"
  | "conference" // When in a conference call with multiple participants
  | "incoming_conference_request" // When someone is trying to join your call

  // custom for the device state
  | "initializing"
  | "ready"
  | "error";

export interface CallParticipant {
  identity: string;
}

export interface ConferenceState {
  isConference: boolean;
  participants: CallParticipant[];
  pendingInvites: { identity: string; inviteId: string }[];
}
