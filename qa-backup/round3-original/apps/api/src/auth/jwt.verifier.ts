import { createRemoteJWKSet, jwtVerify, SignJWT, type JWTPayload } from "jose";
import { Injectable } from "@nestjs/common";
import { ApiError } from "../common/api-error";
import { appConfig } from "../common/config";

export type AccessClaims = JWTPayload & {
  sub: string;
  email?: string;
  phone_number?: string;
  name?: string;
  picture?: string;
  identities?: Array<{ providerName?: string }>;
  "cognito:groups"?: string[];
};

@Injectable()
export class JwtVerifier {
  private jwks?: ReturnType<typeof createRemoteJWKSet>;

  async verify(token: string): Promise<AccessClaims> {
    if (appConfig.authMode === "local") {
      const { payload } = await jwtVerify(token, secretKey(), {
        issuer: "janus-local",
        audience: "janus-api",
      });
      if (!payload.sub) throw ApiError.unauthorized("Token missing sub");
      return payload as AccessClaims;
    }

    if (!appConfig.cognitoUserPoolId) {
      throw ApiError.unauthorized("Cognito is not configured");
    }
    const issuer = `https://cognito-idp.${appConfig.cognitoRegion}.amazonaws.com/${appConfig.cognitoUserPoolId}`;
    this.jwks ??= createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
    const { payload } = await jwtVerify(token, this.jwks, {
      issuer,
      audience: appConfig.cognitoClientId || undefined,
    });
    if (!payload.sub) throw ApiError.unauthorized("Token missing sub");
    return payload as AccessClaims;
  }

  async signLocal(claims: {
    sub: string;
    email?: string;
    phone_number?: string;
    name?: string;
    picture?: string;
    groups?: string[];
    provider?: string;
  }): Promise<string> {
    if (appConfig.authMode !== "local") {
      throw ApiError.forbidden("DEV_ONLY", "Local tokens are disabled");
    }
    return new SignJWT({
      email: claims.email,
      phone_number: claims.phone_number,
      name: claims.name,
      picture: claims.picture,
      "cognito:groups": claims.groups ?? [],
      identities: claims.provider ? [{ providerName: claims.provider }] : undefined,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(claims.sub)
      .setIssuer("janus-local")
      .setAudience("janus-api")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(secretKey());
  }
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(appConfig.localJwtSecret);
}
