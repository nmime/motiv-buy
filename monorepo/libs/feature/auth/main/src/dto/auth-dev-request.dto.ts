import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AuthDevRequestDto {
  @ApiProperty({
    description: 'Telegram user ID',
    example: '123456789',
  })
  @IsString()
  @IsNotEmpty()
  id!: string;
}
