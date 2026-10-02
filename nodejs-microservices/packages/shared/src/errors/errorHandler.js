import { AppError } from "./AppError.js";
import { logger } from "../logger/logger.js";

export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  logger.error({ err }, "Unhandled error");

  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}
