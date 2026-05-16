import type { Hono } from "hono";

export function registerErrorHandler(app: Hono) {
  app.onError((error, c) => {
    console.error("Unhandled request error:", error);
    return c.json({ message: "Internal Server Error" }, 500);
  });
}
