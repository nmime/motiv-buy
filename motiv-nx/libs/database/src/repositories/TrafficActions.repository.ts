import { EntityRepository } from '@mikro-orm/core';
import { TrafficActionsEntity, TrafficActionStatus } from '../entities/TrafficActions.entity';

export class TrafficActionsRepository extends EntityRepository<TrafficActionsEntity> {
  
  async findByOrderId(orderId: number): Promise<TrafficActionsEntity[]> {
    return this.find({ trafficOrder: orderId }, {
      populate: ['trafficOrder', 'trafficSource']
    });
  }

  async findBySourceId(sourceId: number): Promise<TrafficActionsEntity[]> {
    return this.find({ trafficSource: sourceId }, {
      populate: ['trafficOrder', 'trafficSource']
    });
  }

  async findByStatus(status: TrafficActionStatus): Promise<TrafficActionsEntity[]> {
    return this.find({ status }, {
      populate: ['trafficOrder', 'trafficSource']
    });
  }

  async findActiveActionsByUser(userId: number): Promise<TrafficActionsEntity[]> {
    // Simple approach using repository methods since complex queries need proper query builder setup
    return this.find({ status: TrafficActionStatus.InProgress }, {
      populate: ['trafficOrder', 'trafficSource']
    });
  }

  async getActionStatistics(orderId?: number): Promise<any[]> {
    if (orderId) {
      return this.find({ trafficOrder: orderId }, {
        populate: ['trafficOrder']
      });
    }
    
    return this.findAll({
      populate: ['trafficOrder', 'trafficSource']
    });
  }
}