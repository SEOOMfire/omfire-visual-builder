"use client";

import { usePathname, useRouter } from "next/navigation";

export function useApp() {
  const path = usePathname() || "/";
  const router = useRouter();
  return {
    path,
    navigate: (next: string, options?: { replace?: boolean }) => {
      if (options?.replace) router.replace(next);
      else router.push(next);
    },
  };
}
