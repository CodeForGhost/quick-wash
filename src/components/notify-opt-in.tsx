"use client";

import { BellRing, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card } from "@/components/patterns";

const DISMISSED_KEY = "quickwash.notify-dismissed";

/**
 * FR-018: asks the customer, once, whether the browser may notify them when
 * an order moves. Permission can only be requested from a click, so this is
 * a card with a button rather than a prompt on load. It shows only while the
 * answer is still "not asked": granted and blocked both hide it, as does
 * "Not now", which is remembered on this device. The notifying itself is in
 * LiveOrders, which already hears every change.
 */
export function NotifyOptIn() {
  // Rendered only after mount: the server does not know this browser's answer.
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "default") return;
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return;
    } catch {
      // Storage may be blocked; asking again next visit is the worst case.
    }
    setShow(true);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // See above.
    }
  };

  const ask = async () => {
    const answer = await Notification.requestPermission();
    setShow(false);
    if (answer === "granted") {
      new Notification("QuickWash", { body: "You will hear from us as your laundry moves." });
    }
  };

  return (
    <Card className="mb-6 flex flex-wrap items-center gap-3 border-lagoon/25 bg-lagoon-soft p-4">
      <BellRing aria-hidden className="size-5 shrink-0 text-lagoon-deep" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-lagoon-deep">Know the moment your laundry moves</p>
        <p className="text-sm text-lagoon-deep/80">
          Get a notification on this device at each step, even while you are on another tab.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button tone="primary" onClick={ask}>
          Turn on
        </Button>
        <Button tone="quiet" onClick={dismiss} aria-label="Not now">
          <X aria-hidden className="size-4" />
        </Button>
      </div>
    </Card>
  );
}
