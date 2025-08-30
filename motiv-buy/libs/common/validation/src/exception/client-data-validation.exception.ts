import { Exception, ExceptionKind } from '@app/common/exception';
import { ValidationErrorResponse } from '../type';

class ClientDataValidationDto {
  errors!: ValidationErrorResponse;
}

/**
 * @deprecated Use ClientDataProblemValidationException instead for RFC 9457 compliance
 */
export class ClientDataValidationException extends Exception(
  ExceptionKind.ClientDataValidation,
  ClientDataValidationDto,
) {
  static readonly message = 'Client data validation failed';

  constructor(errors: ValidationErrorResponse) {
    super({
      message: ClientDataValidationException.message,
      data: { errors },
    });
  }
}
