import { Injectable } from '@nestjs/common';
import { 
  CreateUserDto, 
  UpdateUserDto, 
  UserResponseDto, 
  UserRepositoryInterface,
  UserStatus,
  UserRole
} from '@app/feature-user-shared';
import { UserMapper } from '../mapper/user.mapper';

/**
 * User repository implementation
 * This is a mock implementation - replace with actual database integration
 */
@Injectable()
export class UserRepositoryImpl implements UserRepositoryInterface {
  private users: Map<string, UserResponseDto> = new Map();
  private idCounter = 1;

  constructor(private readonly userMapper: UserMapper) {
    // Initialize with sample data
    this.seedData();
  }

  /**
   * Create a new user
   */
  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const id = this.generateId();
    const user = this.userMapper.toResponse({
      id,
      ...createUserDto,
      status: UserStatus.ACTIVE,
      role: UserRole.USER,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    this.users.set(id, user);
    return user;
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<UserResponseDto | null> {
    return this.users.get(id) || null;
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<UserResponseDto | null> {
    const users = Array.from(this.users.values());
    return users.find(user => user.email === email) || null;
  }

  /**
   * Update user information
   */
  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
    const existingUser = this.users.get(id);
    if (!existingUser) {
      throw new Error('User not found');
    }

    const updatedUser = {
      ...existingUser,
      ...updateUserDto,
      updatedAt: new Date(),
    };

    this.users.set(id, updatedUser);
    return updatedUser;
  }

  /**
   * Delete user by ID
   */
  async delete(id: string): Promise<void> {
    this.users.delete(id);
  }

  /**
   * Find all users with pagination
   */
  async findAll(page: number, limit: number): Promise<{
    users: UserResponseDto[];
    total: number;
  }> {
    const allUsers = Array.from(this.users.values());
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    return {
      users: allUsers.slice(startIndex, endIndex),
      total: allUsers.length,
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return (this.idCounter++).toString();
  }

  /**
   * Seed initial data
   */
  private seedData(): void {
    const sampleUser: UserResponseDto = {
      id: '1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phoneNumber: '+1234567890',
      status: UserStatus.ACTIVE,
      role: UserRole.USER,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.users.set('1', sampleUser);
    this.idCounter = 2;
  }
}