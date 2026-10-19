import { randomInt, timingSafeEqual } from "node:crypto";
import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsOptional, IsString, Length } from "class-validator";
import { ApiError } from "../common/api-error";
import { appConfig } from "../common/config";
import { EmailService } from "../common/email.service";
import { PrismaService } from "../common/prisma.service";
import { RedisService } from "../common/redis.service";
import { IdentityService } from "../identity/identity.service";
import { Public } from "./auth.decorators";
import { JwtVerifier } from "./jwt.verifier";

class LookupDto {
  @IsEmail()
  email!: string;
}

class SendOtpDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  name?: string;
}

class VerifyOtpDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @Length(4, 8)
  code!: string;

  @IsOptional()
  @IsString()
  name?: string;
}

const OTP_TTL_SEC = 600;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_SEC = 30;
const OTP_MAX_SENDS_PER_HOUR = 5;

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) {
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

interface StoredOtpData {
  code: string;
  name?: string;
  createdAt: number;
}

@ApiTags("auth")
@Controller("v1/auth")
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly emailService: EmailService,
    private readonly jwt: JwtVerifier,
    private readonly identity: IdentityService,
  ) {}

  @Public()
  @HttpCode(200)
  @Post("lookup")
  async lookup(@Body() body: LookupDto) {
    const email = body.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, profileComplete: true, displayName: true },
    });
    return {
      exists: Boolean(existing),
      profileComplete: Boolean(existing?.profileComplete),
      displayName: existing?.displayName ?? null,
    };
  }

  @Public()
  @HttpCode(200)
  @Post("otp/send")
  async sendOtp(@Body() body: SendOtpDto) {
    const email = body.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, displayName: true },
    });

    const cooldownOk = await this.redis.setNx(`auth:otp:cooldown:${email}`, "1", OTP_RESEND_COOLDOWN_SEC);
    if (!cooldownOk) {
      throw ApiError.tooMany("Please wait before requesting another code");
    }
    const sends = await this.redis.incr(`auth:otp:sends:${email}`, 3600);
    if (sends > OTP_MAX_SENDS_PER_HOUR) {
      throw ApiError.tooMany("Too many verification codes requested. Try again later.");
    }

    const code = randomInt(100000, 1000000).toString();
    const otpData: StoredOtpData = {
      code,
      name: body.name?.trim() || existing?.displayName || undefined,
      createdAt: Date.now(),
    };

    // Store in redis with 10 minute TTL (600s)
    await this.redis.set(`auth:otp:${email}`, JSON.stringify(otpData), OTP_TTL_SEC);
    await this.redis.del(`auth:otp:attempts:${email}`);

    // Send email using Resend service
    await this.emailService.sendOtp({
      to: email,
      code,
      name: otpData.name,
    });

    return {
      success: true,
      email,
      exists: Boolean(existing),
      message: "Verification code dispatched to your email",
    };
  }

  @Public()
  @HttpCode(200)
  @Post("otp/verify")
  async verifyOtp(@Body() body: VerifyOtpDto) {
    const email = body.email.trim().toLowerCase();
    const cacheKey = `auth:otp:${email}`;
    const raw = await this.redis.get(cacheKey);

    if (!raw) {
      throw ApiError.badRequest("OTP_EXPIRED", "Verification code has expired or was not requested");
    }

    const stored = JSON.parse(raw) as StoredOtpData;
    if (!safeEqual(stored.code, body.code.trim())) {
      const attempts = await this.redis.incr(`auth:otp:attempts:${email}`, OTP_TTL_SEC);
      if (attempts >= OTP_MAX_ATTEMPTS) {
        await this.redis.del(cacheKey, `auth:otp:attempts:${email}`);
        throw ApiError.tooMany("Too many incorrect attempts. Request a new code.");
      }
      throw ApiError.badRequest("INVALID_OTP", "Incorrect verification code. Please check and try again.");
    }

    // Successfully verified: clear OTP
    await this.redis.del(cacheKey, `auth:otp:attempts:${email}`);

    // Find or create user
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, cognitoSub: true, profileComplete: true, displayName: true, role: true },
    });

    // Link by verified email: reuse the existing identity (Cognito or local); new users get
    // a first-party sub. Works in both auth modes because the API issues the session token.
    const sub = existing
      ? existing.cognitoSub
      : appConfig.authMode !== "local"
        ? `otp:email:${email}`
        : `local:email:${email}`;
    const displayName = body.name?.trim() || stored.name || existing?.displayName || undefined;

    // Sign session token
    const accessToken = await this.jwt.signSession({
      sub,
      email,
      name: displayName,
    });

    // Ensure user record exists in database
    const user = await this.identity.upsertFromClaims(
      {
        sub,
        email,
        name: displayName,
      },
      {},
    );

    return {
      accessToken,
      tokenType: "Bearer",
      isNewUser: !existing,
      profileComplete: user.profileComplete,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        handle: user.handle,
        role: user.role,
        profileComplete: user.profileComplete,
      },
    };
  }
}
