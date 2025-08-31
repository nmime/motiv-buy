import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { 
  CreateUserDto, 
  UpdateUserDto, 
  UserResponseDto, 
  UserRepositoryInterface, 
  USER_REPOSITORY 
} from '@app/feature-user-shared';

/**
 * User service - business logic implementation
 */
@Injectable()
export class UserService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryInterface,
  ) {}

  /**
   * Create a new user
   */
  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    return this.userRepository.create(createUserDto);
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<UserResponseDto | null> {
    return this.userRepository.findByEmail(email);
  }

  /**
   * Update user information
   */
  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
    const existingUser = await this.userRepository.findById(id);
    if (!existingUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    
    return this.userRepository.update(id, updateUserDto);
  }

  /**
   * Delete user by ID
   */
  async delete(id: string): Promise<void> {
    const existingUser = await this.userRepository.findById(id);
    if (!existingUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    
    return this.userRepository.delete(id);
  }

  /**
   * Find all users with pagination
   */
  async findAll(page: number = 1, limit: number = 10): Promise<{
    users: UserResponseDto[];
    total: number;
  }> {
    return this.userRepository.findAll(page, limit);
  }
}