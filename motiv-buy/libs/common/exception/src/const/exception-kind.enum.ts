export enum ExceptionKind {
  // Used only for input data validation
  ClientDataValidation = 'ClientDataValidation',

  // Business logic kinds
  Validation = 'Validation',
  Unauthorized = 'Unauthorized',
  Forbidden = 'Forbidden',
  NotFound = 'NotFound',
  Conflict = 'Conflict',

  RateLimitExceed = 'RateLimitExceed',

  // All other kinds
  Internal = 'Internal',
}
