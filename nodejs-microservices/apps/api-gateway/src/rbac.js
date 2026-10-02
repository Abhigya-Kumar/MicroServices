export const publicRoutes = [
  {
    method: "POST",
    path: "/auth/register",
  },
  {
    method: "POST",
    path: "/auth/login",
  },
];

const rbacRules = [
  {
    method: "GET",
    path: "/auth/me",
    roles: ["USER", "ADMIN"],
  },
  {
    method: "POST",
    path: "/tasks",
    roles: ["USER", "ADMIN"],
  },
  {
    method: "GET",
    path: "/tasks",
    roles: ["USER", "ADMIN"],
  },
  {
    method: "GET",
    path: "/tasks/:id",
    roles: ["USER", "ADMIN"],
  },
  {
    method: "DELETE",
    path: "/tasks/:id",
    roles: ["ADMIN"],
  },
  {
    method: "POST",
    path: "/tasks/:taskId/attachments",
    roles: ["USER", "ADMIN"],
  },
  {
    method: "GET",
    path: "/tasks/:taskId/attachments",
    roles: ["USER", "ADMIN"],
  },
  {
    method: "GET",
    path: "/tasks/:taskId/workflows",
    roles: ["USER", "ADMIN"],
  },
];

// /auth/me -> /auth/me -> true

// /tickets/:id, /tickets/abs-123

// "", "tickets", ":id".  "", "tickets", "abs-123"

function matchPath(pattern, actual) {
  if (pattern === actual) {
    return true;
  }

  const patternParts = pattern.split("/");
  const actualParts = actual.split("/");

  if (patternParts.length !== actualParts.length) {
    return false;
  }

  return patternParts.every(
    (part, index) => part.startsWith(":") || part === actualParts[index],
  );
}

export function isPublicRoute(method, path) {
  return publicRoutes.some(
    (route) => route.method === method && matchPath(route.path, path),
  );
}

export function getAllowedRoles(method, path) {
  const rule = rbacRules.find(
    (currentItem) =>
      currentItem.method === method && matchPath(currentItem.path, path),
  );

  return rule?.roles ?? null;
}
