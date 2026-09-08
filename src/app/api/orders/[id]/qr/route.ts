import QRCode from "qrcode";
import { handle } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { assertCanView, getOrder } from "@/lib/orders";

type Params = { params: Promise<{ id: string }> };

/**
 * FR-011: the QR code that goes on the laundry bag. It encodes the order number
 * so shop staff can scan a bag and pull up the order.
 */
export const GET = handle(async (_request: Request, { params }: Params) => {
  const user = await requireUser();
  const { id } = await params;
  const order = getOrder(Number(id));
  if (!order) throw notFound();
  assertCanView(user, order);

  const svg = await QRCode.toString(order.order_number, {
    type: "svg",
    margin: 1,
    width: 320,
    color: { dark: "#16243f", light: "#ffffff" },
  });

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      // The code never changes for an order, so it can be cached hard.
      "Cache-Control": "private, max-age=86400",
    },
  });
});
