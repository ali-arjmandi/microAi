export type AiModelOutputFailureCode =
  | 'json_parse_failed'
  | 'schema_validation_failed';

export class AiModelOutputInvalidError extends Error {
  constructor(
    readonly code: AiModelOutputFailureCode,
    message?: string,
    readonly detail?: string,
  ) {
    super(message ?? code);
    this.name = 'AiModelOutputInvalidError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
