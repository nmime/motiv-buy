import { ValidationError, ValidationPipe as NestValidationPipe } from '@nestjs/common';
import { ValidationErrorResponse } from '../type';
import { ClientDataProblemValidationException } from '../exception';

export class ProblemValidationPipe extends NestValidationPipe {
  override createExceptionFactory() {
    return (validationErrors: ValidationError[] = []) => {
      return new ClientDataProblemValidationException(this.formatErrors(validationErrors));
    };
  }

  private formatErrors(errors: ValidationError[]): ValidationErrorResponse {
    const result: ValidationErrorResponse = {};

    errors.forEach((error) => {
      const errorResult = this.mapChildrenErrors(error, error.property);
      Object.assign(result, errorResult);
    });

    return result;
  }

  private mapChildrenErrors(error: ValidationError, fieldPath: string): ValidationErrorResponse {
    const { children = [], constraints } = error;

    if (children.length > 0) {
      const childResults: ValidationErrorResponse = {};
      children.forEach((child) => {
        const childResult = this.mapChildrenErrors(child, `${fieldPath}.${child.property}`);
        Object.assign(childResults, childResult);
      });

      return { [fieldPath]: childResults };
    }

    return { [fieldPath]: Object.values(constraints || {}) };
  }
}
