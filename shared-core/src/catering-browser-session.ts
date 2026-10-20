// An app-session denial must not reject the browser's separate HTTP Basic
// credentials. The marker distinguishes it from an ordinary permission denial.
export const CATERING_SESSION_REQUIRED_HEADER = "x-catering-session-status";
export const CATERING_SESSION_REQUIRED_VALUE = "required";
