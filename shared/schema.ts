import { z } from "zod";
import type { GreetingResponse } from "./types/greeting";

export const GreetingResponseSchema: z.ZodType<GreetingResponse> = z.object({
  message: z.string(),
});
