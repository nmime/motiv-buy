import { applyDecorators, UseFilters, UseInterceptors } from '@nestjs/common';
import { ResponseTransformer } from './response.transformer';
import { ProblemResponseTransformer } from './problem-response.transformer';

export enum TransformerType {
  Legacy = 'legacy',
  Problem = 'problem',
}

export const UseTransformer = (type: TransformerType = TransformerType.Legacy) => {
  if (type === TransformerType.Problem) {
    return applyDecorators(UseInterceptors(ProblemResponseTransformer), UseFilters(ProblemResponseTransformer));
  }

  return applyDecorators(UseInterceptors(ResponseTransformer), UseFilters(ResponseTransformer));
};
