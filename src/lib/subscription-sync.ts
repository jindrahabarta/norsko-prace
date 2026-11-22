import { stripe, priceIdToTier } from "./stripe";
import { supabaseAdmin } from "./supabase";

const ACTIVE_STATUSES = ["active", "trialing"];

/**
 * Záchrana, když nedorazí (nebo selže) webhook: stav předplatného dotáhne přímo ze Stripe.
 * Vrací true, když je předplatné aktivní.
 *
 * `lookupByEmail` dohledá zákazníka podle e-mailu, když ho ještě nemáme v databázi —
 * to má smysl jen při návratu z checkoutu. Jinak by každé otevření profilu neplatícím
 * uživatelem znamenalo dotaz do Stripe.
 */
export async function reconcileSubscription(
  userId: string,
  email?: string | null,
  options: { lookupByEmail?: boolean } = {}
): Promise<boolean> {
  const { lookupByEmail = true } = options;
  const admin = supabaseAdmin();
  const { data: row } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  let customerId: string | undefined = row?.stripe_customer_id ?? undefined;
  if (!customerId && lookupByEmail && email) {
    const found = await stripe.customers.list({ email, limit: 1 });
    customerId = found.data[0]?.id;
  }
  if (!customerId) return false;

  const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 5 });
  const sub = subs.data.find((s) => ACTIVE_STATUSES.includes(s.status)) ?? subs.data[0];
  if (!sub) return false;

  const priceId = sub.items.data[0]?.price?.id ?? "";
  const item = sub.items.data[0] as unknown as { current_period_end?: number } | undefined;
  const periodEnd =
    item?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end;

  await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      status: sub.status,
      tier: priceIdToTier(priceId),
      price_id: priceId,
      stripe_subscription_id: sub.id,
      stripe_customer_id: customerId,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: sub.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  return ACTIVE_STATUSES.includes(sub.status);
}

/**
 * Srovná všechna předplatná se Stripe — zdrojem pravdy je Stripe, ne naše tabulka.
 *
 * Běží z cronu, takže stav dohoní i tehdy, když se webhook nedoručí: obnovení,
 * zrušení i platbu, která prošla až na druhý pokus (tam zákazník přes stránku
 * s potvrzením vůbec neprojde).
 */
export async function reconcileAllSubscriptions(): Promise<{
  checked: number;
  updated: number;
  unmatched: number;
}> {
  const admin = supabaseAdmin();
  let checked = 0;
  let updated = 0;
  let unmatched = 0;

  for await (const sub of stripe.subscriptions.list({ status: "all", limit: 100 })) {
    checked += 1;

    const priceId = sub.items.data[0]?.price?.id ?? "";
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const item = sub.items.data[0] as unknown as { current_period_end?: number } | undefined;
    const periodEnd =
      item?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end;

    const row = {
      status: sub.status,
      tier: priceIdToTier(priceId),
      price_id: priceId,
      stripe_subscription_id: sub.id,
      stripe_customer_id: customerId,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: sub.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    };

    const userId = sub.metadata?.user_id;
    const { error } = userId
      ? await admin.from("subscriptions").upsert({ user_id: userId, ...row }, { onConflict: "user_id" })
      : await admin.from("subscriptions").update(row).eq("stripe_customer_id", customerId);

    if (error) {
      console.error(`reconcileAll ${sub.id}:`, error.message);
      unmatched += 1;
    } else {
      updated += 1;
    }
  }

  return { checked, updated, unmatched };
}
