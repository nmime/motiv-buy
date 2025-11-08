import { ValidationError, ValidationPipe as NestValidationPipe } from '@nestjs/common';
import { ValidationErrorResponse } from '../type';
import { ClientDataProblemValidationException } from '../exception';

export class ValidationPipe extends NestValidationPipe {
  override createExceptionFactory() {
    return (validationErrors: ValidationError[] = []) => {
      return new ClientDataProblemValidationException(this.formatErrors(validationErrors));
    };
  }

  private formatErrors(errors: ValidationError[]): ValidationErrorResponse {
    return errors.reduce((result, error) => this.mapChildrenErrors(error, result), {} as ValidationErrorResponse);
  }

  private mapChildrenErrors(error: ValidationError, result: ValidationErrorResponse): ValidationErrorResponse {
    const { property, children = [], constraints } = error;

    if (children.length > 0) {
      const propertyResult = result[property] ? result[property] : {};

      const updatedPropertyResult = children.reduce(
        (acc, child) => this.mapChildrenErrors(child, acc as ValidationErrorResponse),
        propertyResult,
      );

      return {
        ...result,
        [property]: updatedPropertyResult,
      };
    }

    return {
      ...result,
      [property]: Object.values(constraints || {}),
    };
  }
}
