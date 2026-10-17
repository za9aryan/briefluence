import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OAuthLoginController } from './oauth/oauth-login.controller';
import { OAuthLoginService } from './oauth/oauth-login.service';

@Module({
  controllers: [AuthController, OAuthLoginController],
  providers: [AuthService, OAuthLoginService],
  exports: [AuthService],
})
export class AuthModule {}
