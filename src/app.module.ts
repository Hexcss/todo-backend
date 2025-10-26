import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from './config/env.validation';
import { AppLogger } from './common/logger/logger.service';
import { HealthModule } from './modules/health/health.module';
import { TaskModule } from './modules/task/task.module';
import { UserModule } from './modules/user/user.module';
import { TagModule } from './modules/tag/tag.module';
import { ProjectModule } from './modules/project/project.module';
import { FirestoreModule } from './shared/firestore/firestore.module';
import { IdentityModule } from './shared/identity/identity.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: false,
      validate: (config: Record<string, unknown>) => {
        const parsed = envSchema.safeParse(config);
        if (!parsed.success) {
          throw new Error(
            'Invalid environment variables:\n' +
              JSON.stringify(parsed.error.format(), null, 2),
          );
        }
        return parsed.data;
      },
    }),
    AuthModule,
    FirestoreModule,
    IdentityModule,
    HealthModule,
    TaskModule,
    ProjectModule,
    UserModule,
    TagModule,
  ],
  providers: [AppLogger],
  exports: [AppLogger],
})
export class AppModule {}
