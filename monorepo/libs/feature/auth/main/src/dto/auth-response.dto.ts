import { ApiProperty } from '@nestjs/swagger';
import { AuthResultDto } from '@app/feature-auth-shared';

export class AuthResponseDto {
  @ApiProperty({
    description: 'Authentication result',
    type: AuthResultDto,
  })
  data!: AuthResultDto;

  @ApiProperty({
    description: 'Success status',
    example: true,
  })
  success!: boolean;
}
