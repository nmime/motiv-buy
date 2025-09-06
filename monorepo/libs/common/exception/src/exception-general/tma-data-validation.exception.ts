import { Exception } from '../factory';
import { ExceptionKind } from '../const';

export class TmaDataValidationException extends Exception({
  kind: ExceptionKind.Validation,
  problemType: 'tma_data_validation_failed',
  title: 'TMA Data Validation Failed',
}) {
  constructor(message: string = 'TMA data validation failed') {
    super({
      detail: message,
    });
  }
}
