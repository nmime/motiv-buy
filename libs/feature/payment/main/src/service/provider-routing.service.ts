import { Injectable, Logger } from '@nestjs/common';
import { Result, Ok, Err } from '@app/common-shared';
import {
  PaymentProvider,
  CurrencyCode,
  PaymentProviderRepository,
  ProviderCurrencyRepository,
  ProviderRoutingRepository,
} from '@app/database';
import { RoutingRuleType } from '@app/database';

/**
 * Context for routing decisions
 */
export interface RoutingContext {
  currency: CurrencyCode;
  amount: string;
  userId: string;
  userCountry?: string;
  platform?: 'telegram' | 'web' | 'mobile';
  isVip?: boolean;
  isVerified?: boolean;
  preferredProvider?: PaymentProvider;
  operation: 'deposit' | 'withdrawal';
}

/**
 * Provider Routing Service
 * Implements intelligent provider selection based on rules and context
 */
@Injectable()
export class ProviderRoutingService {
  private readonly logger = new Logger(ProviderRoutingService.name);

  constructor(
    private readonly providerConfigRepo: PaymentProviderRepository,
    private readonly currencySupportRepo: ProviderCurrencyRepository,
    private readonly routingRuleRepo: ProviderRoutingRepository,
  ) {}

  /**
   * Select the best provider for a deposit operation
   */
  async selectDepositProvider(context: RoutingContext): Promise<Result<PaymentProvider, Error>> {
    try {
      this.logger.log(`Selecting deposit provider for ${context.currency} (amount: ${context.amount})`);

      // 1. Check if user has a preferred provider
      if (context.preferredProvider) {
        const isValid = await this.validateProvider(context.preferredProvider, context.currency, 'deposit');

        if (isValid) {
          this.logger.log(`Using user-preferred provider: ${context.preferredProvider}`);

          return Ok(context.preferredProvider);
        }

        this.logger.warn(`Preferred provider ${context.preferredProvider} not valid, falling back to routing`);
      }

      // 2. Try routing rules
      const ruleResult = await this.applyRoutingRules(context);

      if (ruleResult.ok) {
        return ruleResult;
      }

      // 3. Fallback to currency-based selection
      const currencyResult = await this.selectByCurrency(context);

      if (currencyResult.ok) {
        return currencyResult;
      }

      // 4. Final fallback to default provider
      return await this.getDefaultProvider(context);
    } catch (error) {
      this.logger.error('Error selecting deposit provider', error);

      return Err(error instanceof Error ? error : new Error('Failed to select provider'));
    }
  }

  /**
   * Select the best provider for a withdrawal operation
   */
  async selectWithdrawalProvider(context: RoutingContext): Promise<Result<PaymentProvider, Error>> {
    try {
      this.logger.log(`Selecting withdrawal provider for ${context.currency} (amount: ${context.amount})`);

      // Similar logic to deposit but for withdrawals
      if (context.preferredProvider) {
        const isValid = await this.validateProvider(context.preferredProvider, context.currency, 'withdrawal');

        if (isValid) {
          return Ok(context.preferredProvider);
        }
      }

      const ruleResult = await this.applyRoutingRules(context);

      if (ruleResult.ok) {
        return ruleResult;
      }

      const currencyResult = await this.selectByCurrency(context);

      if (currencyResult.ok) {
        return currencyResult;
      }

      return await this.getDefaultProvider(context);
    } catch (error) {
      this.logger.error('Error selecting withdrawal provider', error);

      return Err(error instanceof Error ? error : new Error('Failed to select provider'));
    }
  }

  /**
   * Apply routing rules to select provider
   */
  // eslint-disable-next-line sonarjs/cognitive-complexity
  private async applyRoutingRules(context: RoutingContext): Promise<Result<PaymentProvider, Error>> {
    try {
      // Find applicable rules
      const rules = await this.routingRuleRepo.findApplicableRules({
        currencyCode: context.currency,
        country: context.userCountry,
        platform: context.platform,
        amount: context.amount,
      });

      if (rules.length === 0) {
        return Err(new Error('No applicable routing rules found'));
      }

      // Try each rule in priority order
      for (const rule of rules) {
        // Check if rule matches user requirements
        if (rule.verifiedUsersOnly && !context.isVerified) {
          continue;
        }

        if (rule.vipUsersOnly && !context.isVip) {
          continue;
        }

        // Rule matches, get the provider
        if (rule.provider) {
          const { provider } = rule.provider.unwrap();

          // Validate provider supports this operation
          const isValid = await this.validateProvider(provider, context.currency, context.operation);

          if (isValid) {
            // Record rule usage
            await this.routingRuleRepo.recordUsage(rule.id, true);

            this.logger.log(`Provider ${provider} selected via rule: ${rule.name} (${rule.ruleType})`);

            return Ok(provider);
          }
        }

        // Try fallback if available
        if (rule.fallbackRuleId) {
          const fallbackRule = await this.routingRuleRepo.findFallbackRule(rule.id);

          if (fallbackRule && fallbackRule.provider) {
            const { provider } = fallbackRule.provider.unwrap();
            const isValid = await this.validateProvider(provider, context.currency, context.operation);

            if (isValid) {
              this.logger.log(`Provider ${provider} selected via fallback rule`);

              return Ok(provider);
            }
          }
        }
      }

      return Err(new Error('No valid provider found from routing rules'));
    } catch (error) {
      this.logger.error('Error applying routing rules', error);

      return Err(error instanceof Error ? error : new Error('Failed to apply routing rules'));
    }
  }

  /**
   * Select provider based on currency support
   */
  private async selectByCurrency(context: RoutingContext): Promise<Result<PaymentProvider, Error>> {
    try {
      const supports =
        context.operation === 'deposit'
          ? await this.currencySupportRepo.findDepositProviders(context.currency)
          : await this.currencySupportRepo.findWithdrawalProviders(context.currency);

      if (supports.length === 0) {
        return Err(new Error(`No providers support ${context.operation} for ${context.currency}`));
      }

      // Get the first (highest priority) provider
      const { provider } = supports[0].provider.unwrap();

      this.logger.log(`Provider ${provider} selected by currency support (priority: ${supports[0].routingPriority})`);

      return Ok(provider);
    } catch (error) {
      this.logger.error('Error selecting by currency', error);

      return Err(error instanceof Error ? error : new Error('Failed to select by currency'));
    }
  }

  /**
   * Get default provider as final fallback
   */
  private async getDefaultProvider(context: RoutingContext): Promise<Result<PaymentProvider, Error>> {
    try {
      // Try to find default routing rule
      const defaultRule = await this.routingRuleRepo.findDefaultRule();

      if (defaultRule && defaultRule.provider) {
        const { provider } = defaultRule.provider.unwrap();

        this.logger.log(`Using default provider from rule: ${provider}`);

        return Ok(provider);
      }

      // Hardcoded final fallback (CryptoBot as safest default)
      this.logger.warn('No default rule found, using hardcoded fallback: CryptoBot');

      return Ok(PaymentProvider.CryptoBot);
    } catch (error) {
      this.logger.error('Error getting default provider', error);

      // Absolute last resort
      return Ok(PaymentProvider.CryptoBot);
    }
  }

  /**
   * Validate that a provider supports the currency and operation
   */
  private async validateProvider(
    provider: PaymentProvider,
    currency: CurrencyCode,
    operation: 'deposit' | 'withdrawal',
  ): Promise<boolean> {
    try {
      // Check provider is enabled and active
      const providerConfig = await this.providerConfigRepo.findByProvider(provider);

      if (!providerConfig || !providerConfig.isEnabled) {
        this.logger.debug(`Provider ${provider} is not enabled`);

        return false;
      }

      // Check provider supports the operation type
      if (operation === 'deposit' && !providerConfig.supportsDeposits) {
        this.logger.debug(`Provider ${provider} does not support deposits`);

        return false;
      }

      if (operation === 'withdrawal' && !providerConfig.supportsWithdrawals) {
        this.logger.debug(`Provider ${provider} does not support withdrawals`);

        return false;
      }

      // Check currency support
      const support = await this.currencySupportRepo.findByProviderAndCurrency(provider, currency);

      if (!support || !support.isEnabled) {
        this.logger.debug(`Provider ${provider} does not support currency ${currency}`);

        return false;
      }

      // Check operation support at currency level
      if (operation === 'deposit' && !support.supportsDeposits) {
        this.logger.debug(`Provider ${provider} does not support deposits for ${currency}`);

        return false;
      }

      if (operation === 'withdrawal' && !support.supportsWithdrawals) {
        this.logger.debug(`Provider ${provider} does not support withdrawals for ${currency}`);

        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`Error validating provider ${provider}`, error);

      return false;
    }
  }

  /**
   * Get all available providers for a currency
   */
  async getAvailableProviders(currency: CurrencyCode, operation: 'deposit' | 'withdrawal'): Promise<PaymentProvider[]> {
    try {
      const supports =
        operation === 'deposit'
          ? await this.currencySupportRepo.findDepositProviders(currency)
          : await this.currencySupportRepo.findWithdrawalProviders(currency);

      return supports.map((s) => s.provider.unwrap().provider);
    } catch (error) {
      this.logger.error('Error getting available providers', error);

      return [];
    }
  }

  /**
   * Get provider with best cost for currency
   */
  async getCheapestProvider(currency: CurrencyCode): Promise<PaymentProvider | null> {
    try {
      const support = await this.currencySupportRepo.findBestProvider(currency, 'lowest_fee');

      return support?.provider.unwrap().provider || null;
    } catch (error) {
      this.logger.error('Error getting cheapest provider', error);

      return null;
    }
  }

  /**
   * Get fastest provider for currency
   */
  async getFastestProvider(currency: CurrencyCode): Promise<PaymentProvider | null> {
    try {
      const support = await this.currencySupportRepo.findBestProvider(currency, 'fastest');

      return support?.provider.unwrap().provider || null;
    } catch (error) {
      this.logger.error('Error getting fastest provider', error);

      return null;
    }
  }

  /**
   * Get most reliable provider for currency
   */
  async getMostReliableProvider(currency: CurrencyCode): Promise<PaymentProvider | null> {
    try {
      const support = await this.currencySupportRepo.findBestProvider(currency, 'most_reliable');

      return support?.provider.unwrap().provider || null;
    } catch (error) {
      this.logger.error('Error getting most reliable provider', error);

      return null;
    }
  }
}
