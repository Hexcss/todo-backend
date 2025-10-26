import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IdentityService } from './identity.service';
import { IdentityGuard } from './identity.guard';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [IdentityService, IdentityGuard],
  exports: [IdentityService, IdentityGuard],
})
export class IdentityModule {}
