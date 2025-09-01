export class SocketExceptionDto<T = unknown> {
  id?: string;
  code: number;
  message: string;
  data?: T;

  constructor(data: { id?: string; code: number; message: string; data?: T }) {
    this.id = data.id;
    this.code = data.code;
    this.message = data.message;
    this.data = data.data;
  }
}

export class SocketExceptionErrorDto<T = unknown> {
  error: SocketExceptionDto<T>;

  constructor(error: SocketExceptionDto<T>) {
    this.error = error;
  }
}