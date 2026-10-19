export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }

  static badRequest(code: string, message: string): ApiError {
    return new ApiError(code, message, 400);
  }

  static unauthorized(message = "Authentication required"): ApiError {
    return new ApiError("UNAUTHORIZED", message, 401);
  }

  static forbidden(code: string, message: string): ApiError {
    return new ApiError(code, message, 403);
  }

  static notFound(message = "Not found"): ApiError {
    return new ApiError("NOT_FOUND", message, 404);
  }

  static conflict(code: string, message: string): ApiError {
    return new ApiError(code, message, 409);
  }

  static tooMany(message = "Rate limit exceeded"): ApiError {
    return new ApiError("RATE_LIMITED", message, 429);
  }
}
