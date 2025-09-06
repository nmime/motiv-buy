export interface AuthResult {
  success?: boolean;
  err?: boolean;
  val?: {
    userId: number;
    telegramId: string;
    username: string;
  };
  token?: string;
  error?: string;
}
