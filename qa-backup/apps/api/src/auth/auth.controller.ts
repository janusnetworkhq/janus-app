import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsOptional, IsString, Length } from "class-validator";
import { ApiError } from "../common/api-error";
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

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const otpData: StoredOtpData = {
      code,
      name: body.name?.trim() || existing?.displayName || undefined,
      createdAt: Date.now(),
    };

    // Store in redis with 10 minute TTL (600s)
    await this.redis.set(`auth:otp:${email}`, JSON.stringify(otpData), 600);

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
    if (stored.code !== body.code.trim()) {
      throw ApiError.badRequest("INVALID_OTP", "Incorrect verification code. Please check and try again.");
    }

    // Successfully verified: clear OTP
    await this.redis.del(cacheKey);

    // Find or create user
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, cognitoSub: true, profileComplete: true, displayName: true, role: true },
    });

    const sub = existing ? existing.cognitoSub : `local:email:${email}`;
    const displayName = body.name?.trim() || stored.name || existing?.displayName || undefined;

    // Sign session token
    const accessToken = await this.jwt.signLocal({
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
