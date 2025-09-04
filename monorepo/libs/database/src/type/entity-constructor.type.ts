export type EntityConstructorData<T, TExclude extends keyof T, TOptional extends keyof T = never> = Omit<
  T,
  TExclude | TOptional
> &
  Partial<Pick<T, TOptional>>;
