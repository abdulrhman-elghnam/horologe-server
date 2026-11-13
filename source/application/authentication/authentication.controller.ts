import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';

import { AuthenticationService } from './authentication.service.js';
import { ChangePasswordDto, EmailDto, GoogleCredentialDto, LoginDto, RegisterDto, ResetPasswordDto, VerifyEmailDto } from './dto/authentication.dto.js';

import { RateLimit, Token } from '../../dependency/decorator/_INDEX.js';
import { AuthGuard } from '../../dependency/guard/_INDEX.js';
import { TokenService, UtilService, type SessionClient } from '../../dependency/service/_INDEX.js';
import { TokenEnum } from '../../dependency/value/security.enum.js';
import type { IAuthReq } from '../../dependency/interface/ctx.interface.js';

const clientOf = (request: Request): SessionClient => ({
ip: request.ip,
  userAgent: request.headers['user-agent'],
});

@Controller('auth')
export class AuthenticationController {
  constructor(
    private readonly auth: AuthenticationService,
    private readonly tokens: TokenService,
    private readonly util: UtilService,
  ) {}

  @RateLimit.signUp()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() body: RegisterDto) {
    return this.auth.register(body);
  }

  @RateLimit.login()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: LoginDto, @Req() request: Request) {
    return this.auth.login(body, this.util.issuer(request as IAuthReq), clientOf(request));
  }

  @RateLimit.authAttempt()
  @Post('google')
  async google(@Body() body: GoogleCredentialDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const { created, ...tokens } = await this.auth.google(body, this.util.issuer(request as IAuthReq), clientOf(request));
    response.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return tokens;
  }

  @RateLimit.session()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Token(TokenEnum.REFRESH)
  @UseGuards(AuthGuard)
  refresh(@Req() request: IAuthReq) {
    return this.auth.refresh(this.tokens.getBearerToken(request), this.util.issuer(request));
  }

  @RateLimit.session()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  logout(@Req() request: IAuthReq) {
    return this.auth.logout(request.credentials.user.id, request.credentials.decoded.sid);
  }

  @RateLimit.authAttempt()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body() body: VerifyEmailDto) {
    return this.auth.verifyEmail(body);
  }

  @RateLimit.verificationEmail()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  resendVerification(@Body() body: EmailDto) {
    return this.auth.resendVerification(body);
  }

  @RateLimit.passwordResetRequest()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() body: EmailDto) {
    return this.auth.forgotPassword(body);
  }

  @RateLimit.authAttempt()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.auth.resetPassword(body);
  }

  @RateLimit.passwordCheck()
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  changePassword(@Body() body: ChangePasswordDto, @Req() request: IAuthReq) {
    return this.auth.changePassword(request.credentials.user, request.credentials.decoded.sid, body);
  }

  @Get('sessions')
  @UseGuards(AuthGuard)
  sessions(@Req() request: IAuthReq) {
    return this.auth.listSessions(request.credentials.user.id, request.credentials.decoded.sid);
  }

  @RateLimit.session()
  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  revokeSession(@Param('sessionId', new ParseUUIDPipe()) sessionId: string, @Req() request: IAuthReq) {
    return this.auth.revokeSession(request.credentials.user.id, sessionId);
  }

  @RateLimit.session()
  @Delete('sessions')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  revokeOtherSessions(@Req() request: IAuthReq) {
    return this.auth.revokeOtherSessions(request.credentials.user.id, request.credentials.decoded.sid);
  }
}
