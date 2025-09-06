export interface SocketResponseDto<T = any> {
  event: string;
  data: T;
  timestamp: number;
}

export interface SocketResultResponseDto<T = any> extends SocketResponseDto<T> {
  success: boolean;
  error?: string;
}
