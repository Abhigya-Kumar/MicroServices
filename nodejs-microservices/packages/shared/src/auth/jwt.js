import jwt from "jsonwebtoken";

function extractjwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }

  return secret;
}

export function signToken(payload) {
  const expiresIn = process.env.JWT_EXPIRES_IN;

  return jwt.sign(payload, extractjwtSecret(), {
    expiresIn: expiresIn,
  });
}

export function verifyToken(token) {
  const decodeToken = jwt.verify(token, extractjwtSecret());

  if (
    typeof decodeToken !== "object" ||
    decodeToken === null ||
    typeof decodeToken.userId !== "string" ||
    (decodeToken.role !== "USER" && decodeToken.role !== "ADMIN")
  ) {
    throw new Error("Invalid token payload");
  }

  return {
    userId: decodeToken.userId,
    role: decodeToken.role,
  };
}
