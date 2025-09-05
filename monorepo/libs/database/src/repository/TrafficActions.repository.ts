import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { TrafficActionsEntity, TrafficActionStatus } from '../entity/TrafficActions.entity';

export class TrafficActionsRepository extends EntityRepository<TrafficActionsEntity> {
  constructor(em: EntityManager) {
    super(em, TrafficActionsEntity);
  }

  async findByOrderId(orderId: string): Promise<TrafficActionsEntity[]> {
    return this.find({ trafficOrderId: orderId }, {
      populate: ['trafficOrder', 'trafficSource']
    });
  }

  async findBySourceId(sourceId: string): Promise<TrafficActionsEntity[]> {
    return this.find({ trafficSourceId: sourceId }, {
      populate: ['trafficOrder', 'trafficSource']
    });
  }

  async findByStatus(status: TrafficActionStatus): Promise<TrafficActionsEntity[]> {
    return this.find({ status }, {
      populate: ['trafficOrder', 'trafficSource']
    });
  }

  async findInProgressActions(): Promise<TrafficActionsEntity[]> {
    return this.find({ status: TrafficActionStatus.InProgress }, {
      populate: ['trafficOrder', 'trafficSource']
    });
  }

  async getActionStats(): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
  }> {
    const [total, pending, inProgress, completed, failed] = await Promise.all([
      this.count(),
      this.count({ status: TrafficActionStatus.Pending }),
      this.count({ status: TrafficActionStatus.InProgress }),
      this.count({ status: TrafficActionStatus.Completed }),
      this.count({ status: TrafficActionStatus.Failed })
    ]);

    return { total, pending, inProgress, completed, failed };
  }
}
