import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z
    .string()
    .optional()
    .transform((v) => (typeof v === 'string' ? v.replace(/\\n/g, '\n') : v)),
  FIREBASE_API_KEY: z.string().optional(),
  FIRESTORE_DATABASE_ID: z.string().default('todo'),
  SESSION_COOKIE_NAME: z.string().default('__session'),
  SESSION_EXPIRES_DAYS: z.string().default('14'),
});

export type EnvVars = z.infer<typeof envSchema>;
