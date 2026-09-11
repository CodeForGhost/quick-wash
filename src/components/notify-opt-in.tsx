"use client";

import { BellRing, Share, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api, messageFrom } from "@/lib/client";
import { Button, Card } from "@/components/patterns";

const DISMISSED_KEY = "quickwash.notify-dismissed";

/**
 * What this browser can do, worked out after mount because the server does
 * not know:
 *  - "ask":      push is available and permission has not been asked yet;
 *  - "install":  an iPhone in Safari, where push only exists once the site is
 *                on the Home Screen - so that is what we ask for instead;
 *  - "silent":   nothing to show - already granted (and resubscribed below),
 *                blocked, dismissed, or a browser without push at all.
 */
type Mode = "silent" | "ask" | "install";

/**
 * FR-018: asks the customer, once, to let this device be told when an order
 * moves. On a yes the browser hands us a push subscription - an address at
 * its push service - which goes to /api/push/subscribe against the signed-in
 * customer; from then on the server posts to it as the order moves and
 * public/sw.js shows it, with the site closed. Permission can only be asked
 * from a click, so this is a card with a button, not a prompt on load.
 * "Not now" is remembered on this device.
 */
export function NotifyOptIn() {
  const [mode, setMode] = useState<Mode>("silent");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (dismissed()) return;
    const supported =
      "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!supported) {
      if (isIphoneInSafari()) setMode("install");
      return;
    }
    if (Notification.permission === "default") setMode("ask");
    // Already allowed: make sure the subscription is still registered - it can
    // be dropped when the browser clears site data or rotates the endpoint.
    if (Notification.permission === "granted") void subscribe().catch(() => {});
  }, []);

  if (mode === "silent") return null;

  const dismiss = () => {
    setMode("silent");
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Storage may be blocked; asking again next visit is the worst case.
    }
  };

  const turnOn = async () => {
    setBusy(true);
    setError(null);
    try {
      const answer = await Notification.requestPermission();
      if (answer !== "granted") {
        setMode("silent");
        return;
      }
      await subscribe();
      setMode("silent");
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setBusy(false);
    }
  };

  if (mode === "install") {
    return (
      <Card className="mb-6 flex flex-wrap items-center gap-3 border-lagoon/25 bg-lagoon-soft p-4">
        <Share aria-hidden className="size-5 shrink-0 text-lagoon-deep" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-lagoon-deep">Get updates on your iPhone</p>
          <p className="text-sm text-lagoon-deep/80">
            Tap Share, then &ldquo;Add to Home Screen&rdquo;. Open QuickWash from there and we can
            notify you as your laundry moves.
          </p>
        </div>
        <Button tone="quiet" onClick={dismiss} aria-label="Not now">
          <X aria-hidden className="size-4" />
        </Button>
      </Card>
    );
  }

  return (
    <Card className="mb-6 flex flex-wrap items-center gap-3 border-lagoon/25 bg-lagoon-soft p-4">
      <BellRing aria-hidden className="size-5 shrink-0 text-lagoon-deep" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-lagoon-deep">Know the moment your laundry moves</p>
        <p className="text-sm text-lagoon-deep/80">
          Get a notification on this device at each step, even with QuickWash closed.
        </p>
        {error ? <p className="mt-1 text-sm text-red-700">{error}</p> : null}
      </div>
      <div className="flex items-center gap-2">
        <Button tone="primary" onClick={turnOn} loading={busy}>
          {busy ? "Turning on…" : "Turn on"}
        </Button>
        <Button tone="quiet" onClick={dismiss} aria-label="Not now" disabled={busy}>
          <X aria-hidden className="size-4" />
        </Button>
      </div>
    </Card>
  );
}

/** Registers the worker, gets (or reuses) the subscription, and records it. */
async function subscribe(): Promise<void> {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) throw new Error("Notifications are not set up on this server yet.");

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(key),
    }));
  await api("/api/push/subscribe", { method: "POST", json: subscription.toJSON() });
}

function dismissed(): boolean {
  try {
    return Boolean(localStorage.getItem(DISMISSED_KEY));
  } catch {
    return false;
  }
}

/** Safari on an iPhone or iPad, not yet opened from the Home Screen. */
function isIphoneInSafari(): boolean {
  const ua = navigator.userAgent;
  const apple = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return apple && !standalone;
}

/** The VAPID public key is base64url; PushManager wants the raw bytes. */
function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
