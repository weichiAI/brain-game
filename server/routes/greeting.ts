import { Hono } from "hono";
import { api } from "../../shared/routes";
import { getGreeting } from "../controllers/greeting.controller";

const greetingRoute = new Hono();

greetingRoute.get(api.greeting.get.path, getGreeting);

export { greetingRoute };
