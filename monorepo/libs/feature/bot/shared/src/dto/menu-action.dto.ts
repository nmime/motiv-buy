import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject, IsEnum } from 'class-validator';
import { MenuActionType } from '../type/callback-data.interface';

/**
 * Menu Action DTO
 * 
 * Data Transfer Object for menu action requests and responses.
 * Validates menu action parameters and ensures type safety.
 * 
 * @class MenuActionDto
 */
export class MenuActionDto {
  @ApiProperty({ 
    description: 'Menu action type',
    enum: MenuActionType,
    example: MenuActionType.Navigate 
  })
  @IsEnum(MenuActionType)
  action!: MenuActionType;

  @ApiProperty({ 
    description: 'Target menu identifier',
    required: false,
    example: 'main_menu' 
  })
  @IsOptional()
  @IsString()
  menuId?: string;

  @ApiProperty({ 
    description: 'Action parameters',
    required: false,
    type: Object,
    example: { page: 1, filter: 'active' } 
  })
  @IsOptional()
  @IsObject()
  params?: Record<string, any>;

  @ApiProperty({ 
    description: 'User identifier',
    example: '123456789' 
  })
  @IsString()
  userId!: string;

  @ApiProperty({ 
    description: 'Chat identifier',
    example: '-987654321' 
  })
  @IsString()
  chatId!: string;

  @ApiProperty({ 
    description: 'Message identifier',
    required: false,
    example: 12345 
  })
  @IsOptional()
  @IsString()
  messageId?: string;

  constructor(object: MenuActionDto) {
    Object.assign(this, object);
  }
}

/**
 * Menu Action Response DTO
 * 
 * Response object for menu actions.
 */
export class MenuActionResponseDto {
  @ApiProperty({ 
    description: 'Whether action was successful',
    example: true 
  })
  success!: boolean;

  @ApiProperty({ 
    description: 'Action result message',
    required: false,
    example: 'Menu updated successfully' 
  })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiProperty({ 
    description: 'Next menu to navigate to',
    required: false,
    example: 'profile_menu' 
  })
  @IsOptional()
  @IsString()
  nextMenu?: string;

  @ApiProperty({ 
    description: 'Additional response data',
    required: false,
    type: Object 
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  constructor(object: MenuActionResponseDto) {
    Object.assign(this, object);
  }
}