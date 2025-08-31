import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { UserSourceVisitRepository } from '@app/database';
import { GetSourceParamsService } from './get-source-params.service';
import { GetUserRefLinkService } from './get-user-ref-link.service';
import { SourceRegisterService, VisitDataParams, TelegramAuthParams } from './source-register.service';

@Injectable()
export class UserVisitService {
  private readonly logger = new Logger(UserVisitService.name);

  constructor(
    private readonly userSourceVisitRepository: UserSourceVisitRepository,
    private readonly getSourceParamsService: GetSourceParamsService,
    private readonly getUserRefLinkService: GetUserRefLinkService,
    private readonly sourceRegisterService: SourceRegisterService,
  ) {}

  async trackUserVisit(
    visitParams: VisitDataParams,
    telegramAuthParams?: TelegramAuthParams,
    entityManager?: EntityManager,
  ): Promise<void> {
    try {
      const sourceParams = this.getSourceParamsService.parseRequest(visitParams.params);
      
      let referrerUserId = null;
      if (sourceParams) {
        referrerUserId = await this.getUserRefLinkService.resolveReferrerUserId(sourceParams);
      }

      const visit = this.sourceRegisterService.prepareVisitData(visitParams, referrerUserId);

      if (entityManager) {
        await this.sourceRegisterService.registerVisit(visit, entityManager);
      } else {
        await this.userSourceVisitRepository.createVisit({
          userId: visit.userId,
          platformType: visit.platformType,
          platformData: visit.platformData,
          params: visit.params,
          utmSource: visit.utmSource,
          utmMedium: visit.utmMedium,
          utmCampaign: visit.utmCampaign,
          utmContent: visit.utmContent,
          linkType: visit.linkType,
          linkCode: visit.linkCode,
          linkUserId: visit.linkUserId,
          language: visit.language,
          telegramLanguage: visit.telegramLanguage,
          continent: visit.continent,
          country: visit.country,
          city: visit.city,
          ip: visit.ip,
          isSignup: visit.isSignup,
        });
      }

      this.logger.debug('User visit tracked', {
        userId: visitParams.userId,
        platformType: visitParams.platformType,
        sourceParams,
        referrerUserId,
      });
    } catch (error) {
      this.logger.error('Failed to track user visit', {
        userId: visitParams.userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getVisitStats(userId: string): Promise<{
    totalVisits: number;
    uniqueSources: number;
    lastVisit?: Date;
    firstVisit?: Date;
    platforms: Record<string, number>;
    sources: Record<string, number>;
  }> {
    try {
      const visits = await this.userSourceVisitRepository.findByUserId(userId);

      if (visits.length === 0) {
        return {
          totalVisits: 0,
          uniqueSources: 0,
          platforms: {},
          sources: {},
        };
      }

      const platforms: Record<string, number> = {};
      const sources: Record<string, number> = {};
      const uniqueSourcesSet = new Set<string>();

      visits.forEach(visit => {
        platforms[visit.platformType] = (platforms[visit.platformType] || 0) + 1;

        const sourceKey = visit.utmSource || 'direct';
        sources[sourceKey] = (sources[sourceKey] || 0) + 1;
        uniqueSourcesSet.add(sourceKey);
      });

      const sortedVisits = visits.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      return {
        totalVisits: visits.length,
        uniqueSources: uniqueSourcesSet.size,
        firstVisit: sortedVisits[0]?.createdAt,
        lastVisit: sortedVisits[sortedVisits.length - 1]?.createdAt,
        platforms,
        sources,
      };
    } catch (error) {
      this.logger.error('Failed to get visit stats', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      
      return {
        totalVisits: 0,
        uniqueSources: 0,
        platforms: {},
        sources: {},
      };
    }
  }

  async getReferralStats(referrerUserId: string): Promise<{
    totalReferrals: number;
    signupReferrals: number;
    platforms: Record<string, number>;
    recentReferrals: Array<{
      userId: string;
      createdAt: Date;
      platformType: string;
      isSignup: boolean;
    }>;
  }> {
    try {
      const visits = await this.userSourceVisitRepository.find({ 
        linkUserId: referrerUserId 
      });

      const platforms: Record<string, number> = {};
      let signupCount = 0;

      visits.forEach(visit => {
        platforms[visit.platformType] = (platforms[visit.platformType] || 0) + 1;
        if (visit.isSignup) {
          signupCount++;
        }
      });

      const recentVisits = visits
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10)
        .map(visit => ({
          userId: visit.userId,
          createdAt: visit.createdAt,
          platformType: visit.platformType,
          isSignup: visit.isSignup,
        }));

      return {
        totalReferrals: visits.length,
        signupReferrals: signupCount,
        platforms,
        recentReferrals: recentVisits,
      };
    } catch (error) {
      this.logger.error('Failed to get referral stats', {
        referrerUserId,
        error: error instanceof Error ? error.message : String(error),
      });
      
      return {
        totalReferrals: 0,
        signupReferrals: 0,
        platforms: {},
        recentReferrals: [],
      };
    }
  }
}