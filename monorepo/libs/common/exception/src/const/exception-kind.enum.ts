export enum ExceptionKind {
  ClientDataValidation = 'ClientDataValidation',

  Validation = 'Validation',
  Unauthorized = 'Unauthorized',
  Forbidden = 'Forbidden',
  NotFound = 'NotFound',
  Conflict = 'Conflict',

  RateLimitExceed = 'RateLimitExceed',

  Internal = 'Internal',
}
