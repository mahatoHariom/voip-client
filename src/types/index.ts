export type CallStatus =
  | "closed"
  | "connecting"
  | "open"
  | "pending"
  | "reconnecting"
  | "ringing"

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
