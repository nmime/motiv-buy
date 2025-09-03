import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserResponseDto } from '../dto/user-response.dto';

/**
 * User repository interface - domain contract
 */
export interface UserRepositoryInterface {
  /**
   * Create a new user
   */
  create(createUserDto: CreateUserDto): Promise<UserResponseDto>;

  /**
   * Find user by ID
   */
  findById(id: string): Promise<UserResponseDto | null>;

  /**
   * Find user by email
   */
  findByEmail(email: string): Promise<UserResponseDto | null>;

  /**
   * Update user information
   */
  update(id: string, updateUserDto: UpdateUserDto): Promise<UserResponseDto>;

  /**
   * Delete user by ID
   */
  delete(id: string): Promise<void>;

  /**
   * Find all users with pagination
   */
  findAll(page: number, limit: number): Promise<{
    users: UserResponseDto[];
    total: number;
  }>;
}