import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { UserEntity, UserRepository, UserStatus } from '@app/database';
import { UserResponseDto } from '@app/feature-user-shared';
import { UserMapper } from '../mapper/user.mapper';

@Injectable()
export class UserRepositoryImpl {
  private readonly repository: UserRepository;

  constructor(
    private readonly em: EntityManager,
    private readonly userMapper: UserMapper
  ) {
    this.repository = this.em.getRepository(UserEntity);
  }

  async create(userData: Partial<UserEntity>): Promise<UserResponseDto> {
    const user = await this.repository.createUser(userData);
    return this.userMapper.toResponse(user);
  }

  async findById(id: string): Promise<UserResponseDto | null> {
    const user = await this.repository.findOne({ id });
    return user ? this.userMapper.toResponse(user) : null;
  }

  async findByTelegramId(telegramId: string): Promise<UserResponseDto | null> {
    const user = await this.repository.findByTelegramId(telegramId);
    return user ? this.userMapper.toResponse(user) : null;
  }

  async findByUsername(username: string): Promise<UserResponseDto | null> {
    const user = await this.repository.findByUsername(username);
    return user ? this.userMapper.toResponse(user) : null;
  }

  async update(id: string, updateData: Partial<UserEntity>): Promise<UserResponseDto> {
    const user = await this.repository.findOneOrFail({ id });
    
    Object.assign(user, updateData);

    await this.em.flush();
    return this.userMapper.toResponse(user);
  }

  async updateByTelegramId(telegramId: string, updateData: Partial<UserEntity>): Promise<UserResponseDto> {
    const user = await this.repository.findOneOrFail({ telegramId });
    
    Object.assign(user, updateData);

    await this.em.flush();
    return this.userMapper.toResponse(user);
  }

  async delete(id: string): Promise<void> {
    const user = await this.repository.findOneOrFail({ id });
    await this.em.removeAndFlush(user);
  }

  async findActiveUsers(): Promise<UserResponseDto[]> {
    const users = await this.repository.findActiveUsers();
    return this.userMapper.toResponseArray(users);
  }

  async findUsersByReferrer(referredBy: string): Promise<UserResponseDto[]> {
    const users = await this.repository.findUsersByReferrer(referredBy);
    return this.userMapper.toResponseArray(users);
  }

  async updateLastActive(telegramId: string): Promise<void> {
    await this.repository.updateLastActive(telegramId);
  }

  async incrementReferralCount(telegramId: string): Promise<void> {
    await this.repository.incrementReferralCount(telegramId);
  }

  async deactivateUser(telegramId: string): Promise<void> {
    await this.repository.deactivateUser(telegramId);
  }

  async getUserStats(): Promise<{
    total: number;
    active: number;
    premium: number;
  }> {
    return await this.repository.getUserStats();
  }

  async findAll(page: number, limit: number): Promise<{
    users: UserResponseDto[];
    total: number;
  }> {
    const [users, total] = await this.repository.findAndCount({}, {
      limit,
      offset: (page - 1) * limit
    });

    return {
      users: this.userMapper.toResponseArray(users),
      total
    };
  }
}