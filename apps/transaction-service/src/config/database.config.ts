export interface DatabaseConfig {
  readonly url: string;
}

export const databaseConfig = (): DatabaseConfig => ({
  url: process.env.DATABASE_URL ?? '',
});
