import type { Context } from "hono";
import { api } from "../../shared/routes";
import { greetingService } from "../models/services/greeting.service";

export async function getGreeting(c: Context) {
  try {
    const body = {
      message: await greetingService.getGreetingMessage(),
    };

    api.greeting.get.responses[200].parse(body);

    return c.json(body);
  } catch (error) {
    console.error("GET /api/greeting failed:", error);

    const message =
      error instanceof Error ? error.message : "Internal Server Error";

    return c.json({ message }, 500);
  }
}
