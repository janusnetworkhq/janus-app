import "./load-env";
import "reflect-metadata";
import compress from "@fastify/compress";
import helmet from "@fastify/helmet";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { appConfig, assertProdConfig } from "./common/config";
import { newRequestId, requestContext } from "./common/request-context";

export let swaggerDocument: Record<string, unknown> | null = null;

export async function createApp(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      bodyLimit: appConfig.limits.jsonBytes,
      trustProxy: true,
      requestIdHeader: "x-request-id",
      genReqId: (req: { headers: Record<string, string | string[] | undefined> }) =>
        newRequestId(
          typeof req.headers["x-request-id"] === "string" ? req.headers["x-request-id"] : undefined,
        ),
    }),
    { logger: ["error", "warn", "log"] },
  );

  await app.register(helmet, {
    contentSecurityPolicy: false,
    hsts: appConfig.isProd ? { maxAge: 63072000, includeSubDomains: true, preload: true } : false,
  });
  await app.register(compress, { encodings: ["gzip", "deflate"] });
  app.enableCors({
    origin: appConfig.isProd ? appConfig.corsOrigins : true,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app
    .getHttpAdapter()
    .getInstance()
    .addHook("onRequest", (req, _res, done) => {
      requestContext.run({ requestId: String(req.id) }, () => done());
    });

  if (!appConfig.isProd) {
    try {
      const swagger = new DocumentBuilder()
        .setTitle("JANUS API")
        .setDescription("Video-first marketplace — public feed + NDA vault")
        .setVersion("1.0")
        .addBearerAuth()
        .build();
      const document = SwaggerModule.createDocument(app, swagger);
      swaggerDocument = document as unknown as Record<string, unknown>;
      SwaggerModule.setup("docs", app, document);
    } catch (err) {
      Logger.warn(`Swagger disabled (${(err as Error).message})`);
    }
  }

  return app;
}

async function bootstrap() {
  assertProdConfig();
  const app = await createApp();
  await app.listen(appConfig.port, "0.0.0.0");
  Logger.log(`JANUS API http://localhost:${appConfig.port}  docs /docs`);
}

if (require.main === module) {
  void bootstrap();
}
