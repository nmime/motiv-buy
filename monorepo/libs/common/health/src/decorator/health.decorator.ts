import { ApiExcludeEndpoint, ApiOkResponse } from '@nestjs/swagger';
import { applyDecorators, UseGuards } from '@nestjs/common';
import { HealthCheck } from '@nestjs/terminus';
import { HealthResponseDtoSchema } from '../dto';
import { HealthPrivateNetworkIpGuard } from '../guard';

type Options = {
  summary?: string;
  public?: boolean;
  swagger?: boolean;
};

export const Health = (options: Options) => {
  const decorators: (ClassDecorator | MethodDecorator | PropertyDecorator)[] = [];

  decorators.push(HealthCheck({ swaggerDocumentation: false }));

  if (!options.public) {
    decorators.push(UseGuards(HealthPrivateNetworkIpGuard));
  }

  if (options.swagger) {
    decorators.push(
      ApiOkResponse({
        schema: HealthResponseDtoSchema,
        description: options.summary ?? 'Health check',
      }),
    );
  } else {
    decorators.push(ApiExcludeEndpoint());
  }

  return applyDecorators(...decorators);
};
