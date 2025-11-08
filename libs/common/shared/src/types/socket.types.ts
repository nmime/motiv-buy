export interface SocketResponseDto<T = unknown> {
  event: string;
  data: T;
  timestamp: number;
}

export interface SocketResultResponseDto<T = unknown> extends SocketResponseDto<T> {
  success: boolean;
  error?: string;
}
