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
});

export type EnvVars = z.infer<typeof envSchema>;
