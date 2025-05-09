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