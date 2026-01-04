import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class BotValidationDto {
  @ApiProperty({
    description: 'Bot username to validate',
    example: '@my_traffic_bot',
  })
  @IsString()
  @IsNotEmpty()
  username!: string;
}

export class CreateBotDto {
  @ApiProperty({
    description: 'Bot username',
    example: '@my_traffic_bot',
  })
  @IsString()
  @IsNotEmpty()
  botUsername!: string;

  @ApiProperty({
    description: 'Traffy integration key',
    example: 'traffy_key_123456789',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  traffyKey!: string;
}

export class BotCreationResponseDto {
  @ApiProperty({
    description: 'Created bot ID',
    example: 'uuid-bot-id',
  })
  botId!: string;

  @ApiProperty({
    description: 'Bot status after creation',
    example: 'pending_moderation',
  })
  status!: string;

  @ApiProperty({
    description: 'Creation status message',
    example: 'Бот создан и отправлен на модерацию',
  })
  message!: string;

  @ApiProperty({
    description: 'Estimated moderation time',
    example: '24-48 часов',
  })
  estimatedModerationTime!: string;
}
