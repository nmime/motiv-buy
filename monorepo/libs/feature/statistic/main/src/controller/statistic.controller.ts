import { Controller, Get, Query, Param, UseGuards, UnauthorizedException, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { StatisticService } from '../service/statistic.service';
import { ApiProblemExceptions, InternalException } from '@app/common-exception';
import { AsyncResult } from '@app/common-shared';

// Local guards and decorators to avoid cross-library imports
export const JwtAuthGuard = AuthGuard('jwt');

export const CurrentUserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    if (!request.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return request.user.id;
  },
);

// Local DTOs to avoid cross-library imports
export interface StatisticQueryDto {
  type?: 'sale' | 'purchase';
  orderId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface StatisticResponseDto {
  peopleCount: number;
  moneyAmount: number;
  period: string;
}

@ApiTags('statistic')
@Controller('statistic')
@ApiProblemExceptions([
  // [UnauthorizedException, { description: 'User not authenticated' }],
  [InternalException, { description: 'Internal server error occurred' }],
])
export class StatisticController {
  constructor(private readonly statisticService: StatisticService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get traffic statistic',
    description: `Get statistic with optional filtering:
    - Filter by type (sale/purchase)  
    - Filter by specific order ID
    - Filter by date range
    - Returns people count and money amount
    - Includes shareable link`,
  })
  @ApiResponse({
    status: 200,
    description: 'Statistic retrieved successfully',
  })
  async getStatistic(
    @Query() query: StatisticQueryDto,
    @CurrentUserId() userId: string,
  ): AsyncResult<StatisticResponseDto, UnauthorizedException | InternalException> {
    const result = await this.statisticService.getStatistic(userId, query);
    return { success: true, data: result };
  }

  @Get('shared/:shareToken')
  @ApiOperation({
    summary: 'Get shared statistic',
    description: 'Get statistic by share token (public access, no auth required)',
  })
  @ApiResponse({
    status: 200,
    description: 'Shared statistic retrieved successfully',
  })
  async getSharedStatistic(
    @Param('shareToken') shareToken: string,
  ): AsyncResult<StatisticResponseDto, InternalException> {
    const result = await this.statisticService.getSharedStatistic(shareToken);
    return { success: true, data: result };
  }
}