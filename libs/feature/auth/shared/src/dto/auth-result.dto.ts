import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AuthResultDto {
  @ApiProperty({ description: 'JWT authentication token' })
  @IsString()
  token!: string;

  constructor(object: AuthResultDto) {
    Object.assign(this, object);
  }
}
