"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useGreeting() {
  return useQuery({
    queryKey: [api.greeting.get.path],
    queryFn: async () => {
      const res = await fetch(api.greeting.get.path);
      if (!res.ok) throw new Error("Failed to fetch greeting");
      return api.greeting.get.responses[200].parse(await res.json());
    },
  });
}
