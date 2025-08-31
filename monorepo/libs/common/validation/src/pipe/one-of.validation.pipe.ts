import { Injectable } from '@nestjs/common';
import { ClassConstructor, plainToClass } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { ValidationPipe } from './validation.pipe';

@Injectable()
export class OneOfValidationPipe<
  Discriminator extends string,
  T extends ClassConstructor<{ [Key in Discriminator]: unknown }>,
> extends ValidationPipe {
  constructor(
    private readonly discriminator: Discriminator,
    private readonly classes: Record<string, ClassConstructor<{ [Key in Discriminator]: unknown }>>,
  ) {
    super();
  }

  override async transform(value: unknown): Promise<T> {
    if (!value || typeof value !== 'object' || !(this.discriminator in value)) {
      throw this.createExceptionFactory()([this.createDiscriminatorError()]);
    }

    const type = (value as Record<string, Discriminator>)[this.discriminator];
    const dtoClass = this.classes[type];

    if (!dtoClass) {
      throw this.createExceptionFactory()([this.createDiscriminatorError()]);
    }

    const dtoInstance = plainToClass(dtoClass, value);
    const errors = await validate(dtoInstance);

    if (errors.length > 0) {
      throw this.createExceptionFactory()(errors);
    }

    return dtoInstance as unknown as T;
  }

  private createDiscriminatorError(): ValidationError {
    const error = new ValidationError();

    error.property = this.discriminator;
    error.constraints = {
      isEnum: `${this.discriminator} must be a valid enum value`,
    };

    return error;
  }
}
