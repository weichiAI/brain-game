import { GREETING_ROUTE_PATH } from "../constants/greeting";
import { GreetingResponseSchema } from "../schema";

export const api = {
  greeting: {
    get: {
      method: "GET",
      path: GREETING_ROUTE_PATH,
      responses: {
        200: GreetingResponseSchema,
      },
    },
  },
} as const;
