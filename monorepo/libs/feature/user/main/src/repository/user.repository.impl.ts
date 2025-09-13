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
    private readonly userMapper: UserMapper,
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

  async updateLastActive(telegramId: string): Promise<void> {
    await this.repository.updateLastActive(telegramId);
  }
}
