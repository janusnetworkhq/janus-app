import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { FastifyReply, FastifyRequest } from "fastify";
import { ApiError } from "./api-error";
import { getRequestId } from "./request-context";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();
    const requestId = getRequestId();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = "INTERNAL";
    let message = "Something went wrong";

    if (exception instanceof ApiError) {
      status = exception.status;
      code = exception.code;
      message = exception.message;
    } else if (
      typeof exception === "object" &&
      exception !== null &&
      "code" in exception &&
      String((exception as { code: unknown }).code).startsWith("FST_")
    ) {
      const fastifyErr = exception as unknown as { statusCode?: number; message: string };
      status = fastifyErr.statusCode ?? 400;
      code = status === 400 ? "VALIDATION_ERROR" : "HTTP_ERROR";
      message = fastifyErr.message;
    } else if (
      typeof exception === "object" &&
      exception !== null &&
      (exception as { name?: string }).name === "PrismaClientKnownRequestError" &&
      ["P2025", "P2003", "P2002"].includes(String((exception as { code?: unknown }).code))
    ) {
      const prismaCode = String((exception as { code: unknown }).code);
      if (prismaCode === "P2002") {
        status = HttpStatus.CONFLICT;
        code = "CONFLICT";
        message = "Resource already exists";
      } else {
        status = HttpStatus.NOT_FOUND;
        code = "NOT_FOUND";
        message = "Not found";
      }
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === "string") {
        message = body;
      } else if (typeof body === "object" && body && "message" in body) {
        const raw = (body as { message: string | string[] }).message;
        message = Array.isArray(raw) ? raw.join(", ") : raw;
      }
      code =
        status === 400
          ? "VALIDATION_ERROR"
          : status === 401
            ? "UNAUTHORIZED"
            : status === 403
              ? "FORBIDDEN"
              : status === 404
                ? "NOT_FOUND"
                : status === 429
                  ? "RATE_LIMITED"
                  : "HTTP_ERROR";
    } else {
      this.logger.error(
        { err: exception, requestId, url: request.url },
        "Unhandled error",
      );
    }

    if (!reply.sent) {
      void reply.status(status).send({
        error: { code, message, requestId },
      });
    }
  }
}
