export interface RabbitMqConfig {
  readonly url: string;
  readonly outboxExchange: string;
  readonly version?: string;
}

export const rabbitMqConfig = (): RabbitMqConfig => ({
  url: process.env.RABBITMQ_URL ?? '',
  outboxExchange: process.env.OUTBOX_EXCHANGE ?? 'transaction.events',
  version: process.env.RABBITMQ_VERSION,
});

export const buildVersionedName = (base: string, version?: string): string => {
  const normalizedBase = base.trim();
  const normalizedVersion = version?.trim();
  if (!normalizedVersion) {
    return normalizedBase;
  }

  return `${normalizedBase}.${normalizedVersion}`;
};

export const normalizeRoutingKey = (
  eventType: string,
  version?: string,
): string => {
  const normalizedEventType = eventType.trim();
  const parts = normalizedEventType.split('.');
  const lastPart = parts[parts.length - 1];
  const hasVersionSuffix =
    (Boolean(version) && lastPart === version) || /^v\d+$/u.test(lastPart);
  const baseEventType = hasVersionSuffix
    ? parts.slice(0, -1).join('.')
    : normalizedEventType;

  if (!baseEventType) {
    return normalizedEventType;
  }
  return buildVersionedName(baseEventType, version);
};
