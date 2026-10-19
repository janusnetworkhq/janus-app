import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";
import { Public } from "./auth.decorators";
import { JwtVerifier } from "./jwt.verifier";

class DevTokenDto {
  @IsString()
  @MaxLength(128)
  sub!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone_number?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  picture?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  groups?: string[];
}

@ApiTags("dev")
@Controller("v1/dev")
export class DevAuthController {
  constructor(private readonly jwt: JwtVerifier) {}

  @Public()
  @HttpCode(200)
  @Post("tokens")
  async token(@Body() body: DevTokenDto) {
    const accessToken = await this.jwt.signLocal(body);
    return { accessToken, tokenType: "Bearer", expiresIn: 900 };
  }
}
