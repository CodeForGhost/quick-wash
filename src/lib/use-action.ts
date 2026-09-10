"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { messageFrom } from "@/lib/client";

/**
 * What the router should do once the request has succeeded. The button stays
 * busy until this finishes too, because on these screens the refresh - not the
 * fetch - is what actually changes what the person is looking at.
 */
export interface Follow {
  refresh?: boolean;
  push?: string;
  replace?: string;
}

/**
 * The busy state for one screen, keyed by the control that started the work.
 *
 * Two things this fixes over a bare `useState` flag:
 *
 * - `router.refresh()` returns immediately, so a flag cleared in `finally`
 *   goes idle while the old screen is still on the page - the button looks
 *   finished and nothing has moved. Running the refresh inside a transition
 *   holds the spinner until the server components have re-rendered.
 * - A screen with several buttons shares one flag, so pressing one greys out
 *   all of them. The key says which one to spin.
 */
export function useAction() {
  const router = useRouter();
  // State lags a click by a render, so the double-tap guard is a ref.
  const running = useRef(false);
  const [requestKey, setRequestKey] = useState<string | null>(null);
  const [routeKey, setRouteKey] = useState<string | null>(null);
  const [routing, startTransition] = useTransition();
  const [error, setError] = useState("");

  const activeKey = requestKey ?? (routing ? routeKey : null);
  const busy = activeKey !== null;

  /**
   * Runs `action` under `key`. Return a `Follow` from it to keep the button
   * busy across the navigation or refresh that follows.
   */
  async function run(key: string, action: () => Promise<Follow | void>) {
    // A second tap on a slow connection must not send the request twice.
    if (running.current || busy) return;
    running.current = true;

    setRequestKey(key);
    setRouteKey(null);
    setError("");
    try {
      const follow = (await action()) ?? {};
      if (follow.push || follow.replace || follow.refresh) {
        setRouteKey(key);
        startTransition(() => {
          if (follow.push) router.push(follow.push);
          else if (follow.replace) router.replace(follow.replace);
          if (follow.refresh) router.refresh();
        });
      }
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      running.current = false;
      setRequestKey(null);
    }
  }

  return {
    run,
    /** True while any control on this screen is working. */
    busy,
    /** True only for the control that started the work. */
    isBusy: (key: string) => activeKey === key,
    error,
    setError,
  };
}
