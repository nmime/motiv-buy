export enum ExceptionKind {
  ClientDataValidation = 'client_data_validation',

  Validation = 'validation',
  Unauthorized = 'unauthorized',
  Forbidden = 'forbidden',
  NotFound = 'not_found',
  Conflict = 'conflict',

  RateLimitExceed = 'rate_limit_exceed',

  Internal = 'internal',
}
