export const config = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
  kdb: {
    host: process.env.KDB_HOST ?? 'localhost',
    port: parseInt(process.env.KDB_PORT ?? '5000', 10),
  },
  nodeEnv: process.env.NODE_ENV ?? 'development',
} as const
