import { ExceptionKind } from '../const';
import { ProblemKind } from '../enum';

export class ProblemKindMapper {
  private static readonly mapping: Record<ExceptionKind, ProblemKind> = {
    [ExceptionKind.ClientDataValidation]: ProblemKind.ClientDataValidation,
    [ExceptionKind.Validation]: ProblemKind.Validation,
    [ExceptionKind.Unauthorized]: ProblemKind.Unauthorized,
    [ExceptionKind.Forbidden]: ProblemKind.Forbidden,
    [ExceptionKind.NotFound]: ProblemKind.NotFound,
    [ExceptionKind.Conflict]: ProblemKind.Conflict,
    [ExceptionKind.RateLimitExceed]: ProblemKind.RateLimit,
    [ExceptionKind.Internal]: ProblemKind.Internal,
  };

  static mapToProblemKind(kind: ExceptionKind): ProblemKind {
    return this.mapping[kind];
  }
}