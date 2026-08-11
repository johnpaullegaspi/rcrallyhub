# Netlify Functions — Future Integration Points

This directory is intentionally close to empty in the demo build. RC Rally
Hub's booking form currently works as a **front-end reservation request**:
it submits to Netlify Forms (visible under Site → Forms in the Netlify
dashboard) and shows a `Pending Confirmation` status to the visitor. No
server-side booking logic exists yet.

When you're ready to wire up a real backend, this is where server-side,
secret-holding logic belongs — **never** put API keys or database
credentials in frontend code (anything in `src/`) since that ships to every
visitor's browser.

## Suggested functions to add here

- **`create-booking.ts`** — receive the booking payload, check real
  availability against a database, write the reservation, and return a
  proper `Confirmed`/`Pending`/`Rejected` status instead of the client-side
  demo simulation in `src/lib/client/booking-form.ts`.
- **`send-confirmation-email.ts`** — call an email provider (Resend,
  SendGrid, Postmark, etc.) using an API key stored in a Netlify
  environment variable, triggered after `create-booking` succeeds.
- **`send-sms-notification.ts`** — same idea via an SMS provider (Semaphore,
  Twilio, etc.) for the Philippine market.
- **`check-availability.ts`** — expose a read endpoint the booking form's
  Step 1 can call instead of the deterministic demo pattern in
  `src/lib/booking-time.ts` (`isSlotUnavailable`), backed by a real
  database or calendar.
- **`sync-calendar.ts`** — push confirmed bookings to Google Calendar /
  Outlook via a service account, so staff see reservations without opening
  the CMS or a separate dashboard.
- **`chatbot-ai.ts`** — a server-side proxy to the OpenAI API (or another
  LLM) for a smarter Rally Assistant. Keep `OPENAI_API_KEY` in Netlify
  environment variables and call it only from here; the current
  `src/lib/client/chatbot.ts` rule-based engine is designed to be swapped
  for a fetch to this endpoint without changing its message-rendering code.

## Example shape

```ts
// netlify/functions/create-booking.ts
import type { Context } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  const payload = await req.json();
  // 1. Validate payload
  // 2. Check availability against your database
  // 3. Write the booking record
  // 4. Trigger send-confirmation-email / send-sms-notification
  // 5. Return the real status
  return new Response(JSON.stringify({ status: "Pending Confirmation" }), {
    headers: { "Content-Type": "application/json" },
  });
};
```

Add any required secrets in **Netlify → Site configuration → Environment
variables** (see `.env.example` in the project root for the expected
names) — never commit real secrets to the repository.
