/**
 * Generic type utility for entity constructor data with proper default handling
 */
export type EntityConstructorData<T, TExclude extends keyof T, TOptional extends keyof T = never> = Omit<
  T,
  TExclude | TOptional
> &
  Partial<Pick<T, TOptional>>;
