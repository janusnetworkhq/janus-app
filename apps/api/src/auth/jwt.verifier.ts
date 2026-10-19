import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify, SignJWT, type JWTPayload } from "jose";
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
    // API-issued session tokens (email OTP sign-in) are HS256 in every auth mode;
    // Cognito tokens are RS256 and verified against the pool JWKS below.
    let alg: string | undefined;
    try {
      alg = decodeProtectedHeader(token).alg;
    } catch {
      throw ApiError.unauthorized("Malformed token");
    }
    if (alg === "HS256" && appConfig.authMode !== "local") {
      const { payload } = await jwtVerify(token, secretKey(), {
        issuer: SESSION_ISSUER,
        audience: "janus-api",
        algorithms: ["HS256"],
      });
      if (!payload.sub) throw ApiError.unauthorized("Token missing sub");
      return payload as AccessClaims;
    }

    if (appConfig.authMode === "local") {
      const { payload } = await jwtVerify(token, secretKey(), {
        issuer: ["janus-local", SESSION_ISSUER],
        audience: "janus-api",
        algorithms: ["HS256"],
      });
      if (!payload.sub) throw ApiError.unauthorized("Token missing sub");
      return payload as AccessClaims;
    }

    if (!appConfig.cognitoUserPoolId) {
      throw ApiError.unauthorized("Cognito is not configured");
    }
    const issuer = `https://cognito-idp.${appConfig.cognitoRegion}.amazonaws.com/${appConfig.cognitoUserPoolId}`;
    this.jwks ??= createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
    const { payload } = await jwtVerify(token, this.jwks, { issuer, algorithms: ["RS256"] });
    // Cognito access tokens carry client_id (no aud); ID tokens carry aud.
    const clientId = (payload as { client_id?: string }).client_id ?? payload.aud;
    if (appConfig.cognitoClientId && clientId !== appConfig.cognitoClientId && !(Array.isArray(clientId) && clientId.includes(appConfig.cognitoClientId))) {
      throw ApiError.unauthorized("Token was issued for another client");
    }
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

  /**
   * Session token for first-party email-OTP sign-in. Valid in local, cognito and otp modes:
   * the OTP proves control of the email, and the user row is linked by email.
   */
  async signSession(claims: { sub: string; email: string; name?: string }): Promise<string> {
    return new SignJWT({ email: claims.email, name: claims.name, amr: ["otp"] })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(claims.sub)
      .setIssuer(SESSION_ISSUER)
      .setAudience("janus-api")
      .setIssuedAt()
      .setExpirationTime(appConfig.sessionTokenTtl)
      .sign(secretKey());
  }
}

const SESSION_ISSUER = "janus-session";

function secretKey(): Uint8Array {
  return new TextEncoder().encode(appConfig.localJwtSecret);
}
