export interface ValidationErrorResponse {
  [property: string]: string[] | ValidationErrorResponse;
}
