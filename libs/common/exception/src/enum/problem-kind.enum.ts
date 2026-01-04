export enum ProblemKind {
  ClientDataValidation = 'client_data_validation',
  Validation = 'validation',
  Authentication = 'authentication',
  Authorization = 'authorization',
  Unauthorized = 'unauthorized',
  Forbidden = 'forbidden',
  NotFound = 'not_found',
  Conflict = 'conflict',
  RateLimit = 'rate_limit',
  Internal = 'internal',
}
