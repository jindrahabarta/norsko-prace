import { NextRequest, NextResponse } from "next/server";
import { reconcileAllSubscriptions } from "@/lib/subscription-sync";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Denní srovnání předplatných se Stripe.
 *
 * Pojistka proti selhání webhooku: ten doručuje změny okamžitě, ale když se
 * nedoručí, platící zákazník zůstane bez přístupu. Tohle stav dohoní nejpozději
 * do druhého dne a nestojí nic — předplatných je řádově desítky.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const secret = bearerToken
    ?? request.headers.get("x-cron-secret")
    ?? request.nextUrl.searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await reconcileAllSubscriptions();
    console.log("sync-subscriptions:", JSON.stringify(result));
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "neznámá chyba";
    console.error("sync-subscriptions selhalo:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
