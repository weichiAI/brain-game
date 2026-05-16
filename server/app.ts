import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { registerErrorHandler } from "./middlewares/error-handler";
import { readPrototypeAsset } from "./prototype-preview";
import { greetingRoute } from "./routes/greeting";

type CreateAppOptions = {
  serveClient?: boolean;
};

export function createApp({ serveClient = false }: CreateAppOptions = {}) {
  const app = new Hono();

  registerErrorHandler(app);

  app.get("/__health", (c) => {
    return c.json({
      status: "ok",
      service: "web",
      serveClient,
      timestamp: Date.now(),
    });
  });

  app.route("/", greetingRoute);

  if (serveClient) {
    const serveClientFiles = serveStatic({ root: "./dist/client" });
    const serveClientIndex = serveStatic({ path: "./dist/client/index.html" });
    const prototypeRoot = "./dist/client/prototype";

    app.get("/prototype/*", async (c) => {
      const asset = await readPrototypeAsset(prototypeRoot, c.req.path);
      if (!asset) return c.notFound();

      return c.body(asset.data, 200, {
        "Content-Type": asset.contentType,
      });
    });

    app.use("/assets/*", serveClientFiles);
    app.use("/*.svg", serveClientFiles);
    app.use("/*.ico", serveClientFiles);
    app.use("/*.png", serveClientFiles);
    app.use("/*.jpg", serveClientFiles);
    app.use("/*.jpeg", serveClientFiles);
    app.use("/*.webp", serveClientFiles);
    app.use("/*.txt", serveClientFiles);
    app.use("/*.js", serveClientFiles);
    app.use("/*.css", serveClientFiles);

    app.get("*", async (c, next) => {
      if (c.req.path.startsWith("/api/")) {
        return c.notFound();
      }

      return serveClientIndex(c, next);
    });
  }

  return app;
}
