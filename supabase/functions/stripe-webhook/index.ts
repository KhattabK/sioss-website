// Stripe → Supabase: opens a course for the buyer when a Checkout payment completes.
//
// Deploy:  supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets: supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
// Stripe:  Developers → Webhooks → add endpoint
//          https://<project-ref>.supabase.co/functions/v1/stripe-webhook   event: checkout.session.completed
// The Payment Link must carry metadata  course = ffc  (Payment Link → Advanced → Metadata).
import { createClient } from "npm:@supabase/supabase-js@2";

const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const course = s.metadata?.course;
  if (s.payment_status !== "paid" || !course) return new Response("ignored");

  const email = (s.customer_details?.email ?? s.customer_email ?? "").toLowerCase() || null;
  const userId = UUID.test(s.client_reference_id ?? "") ? s.client_reference_id : null;
  if (!email && !userId) return new Response("no buyer identity", { status: 400 });

  const { error } = await db.from("course_access")
    .upsert({ course, user_id: userId, email, stripe_session: s.id }, { onConflict: "stripe_session", ignoreDuplicates: true });
  if (error) return new Response(error.message, { status: 500 }); // Stripe retries on 5xx
  return new Response("ok");
});
