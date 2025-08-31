import { ValidationError, ValidationPipe as NestValidationPipe } from '@nestjs/common';
import { ValidationErrorResponse } from '../type';
import { ClientDataValidationException } from '../exception';

export class ValidationPipe extends NestValidationPipe {
  override createExceptionFactory() {
    return (validationErrors: ValidationError[] = []) => {
      return new ClientDataValidationException(this.formatErrors(validationErrors));
    };
  }

  private formatErrors(errors: ValidationError[]): ValidationErrorResponse {
    const result: ValidationErrorResponse = {};

    errors.forEach((error) => {
      this.mapChildrenErrors(error, result);
    });

    return result;
  }

  private mapChildrenErrors(error: ValidationError, result: ValidationErrorResponse): void {
    const { property, children = [], constraints } = error;

    if (children.length > 0) {
      if (!result[property]) {
        result[property] = {};
      }

      children.forEach((child) => this.mapChildrenErrors(child, result[property] as ValidationErrorResponse));

      return;
    }

    result[property] = Object.values(constraints || {});
  }
}
