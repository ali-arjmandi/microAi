export interface AiRejectedEventV1 {
  transactionId: string;
  reason: string;
  model: string;
  promptVersion: string;
  detail?: string;
}
