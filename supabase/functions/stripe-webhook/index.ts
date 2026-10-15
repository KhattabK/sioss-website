// Stripe → Supabase: opens a course for the buyer when a Checkout payment completes.
//
// Deploy:  supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets: supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
// Stripe:  Developers → Webhooks → add endpoint
//          https://<project-ref>.supabase.co/functions/v1/stripe-webhook   event: checkout.session.completed
// Which course was bought: the mapping below, else metadata  course = …  on the Payment Link,
// else the learner area's client_reference_id = "<course>__<user id>".
import { createClient } from "npm:@supabase/supabase-js@2";

const COURSE_BY_PAYMENT_LINK: Record<string, string> = {
  plink_1UQXSIA9b6BMh2hbLhcOxrBT: "ffc", // Football Fitness Coach, 149 USD
};

const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
// Projects on the new API keys expose the secret key in SUPABASE_SECRET_KEYS instead of SUPABASE_SERVICE_ROLE_KEY.
const serverKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default;
const db = createClient(Deno.env.get("SUPABASE_URL")!, serverKey);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REF = /^([a-z]{2,12})__([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

async function signatureOk(body: string, header: string | null): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || !parts.v1 || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${parts.t}.${body}`));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hex.length !== parts.v1.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ parts.v1.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  const body = await req.text();
  if (!(await signatureOk(body, req.headers.get("stripe-signature")))) {
    return new Response("bad signature", { status: 400 });
  }
  const event = JSON.parse(body);
  if (event.type !== "checkout.session.completed") return new Response("ignored");

  const s = event.data.object;
  const ref = REF.exec(s.client_reference_id ?? "");
  // A known Payment Link or its metadata wins over the reference, which the buyer could edit in the URL.
  const course = COURSE_BY_PAYMENT_LINK[s.payment_link] ?? s.metadata?.course ?? ref?.[1].toLowerCase();
  if (s.payment_status !== "paid" || !course) return new Response("ignored");

  const email = (s.customer_details?.email ?? s.customer_email ?? "").toLowerCase() || null;
  const userId = ref?.[2] ?? (UUID.test(s.client_reference_id ?? "") ? s.client_reference_id : null);
  if (!email && !userId) return new Response("no buyer identity", { status: 400 });

  const { error } = await db.from("course_access")
    .upsert({ course, user_id: userId, email, stripe_session: s.id }, { onConflict: "stripe_session", ignoreDuplicates: true });
  if (error) return new Response(error.message, { status: 500 }); // Stripe retries on 5xx
  return new Response("ok");
});
