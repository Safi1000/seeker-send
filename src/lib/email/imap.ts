import "server-only";
import { ImapFlow } from "imapflow";
import MailComposer from "nodemailer/lib/mail-composer";
import { getEnv } from "@/lib/env";

/**
 * Drop a copy of a just-sent email into the mailbox's "Sent" folder over IMAP.
 *
 * The platform sends through Resend/SMTP, neither of which writes to the IMAP
 * "Sent" folder — so without this, sends never appear in Outlook's Sent. This
 * builds the same RFC822 message and APPENDs it to the Sent mailbox.
 *
 * Best-effort: any failure (e.g. the deploy host blocks IMAP) is swallowed so it
 * never affects the actual send.
 */

export interface SentCopy {
  from: string;
  to: string;
  subject: string;
  body: string;
  replyTo?: string | null;
}

async function buildRfc822(c: SentCopy): Promise<Buffer> {
  const mail = new MailComposer({
    from: c.from,
    to: c.to,
    subject: c.subject,
    text: c.body,
    replyTo: c.replyTo ?? undefined,
    date: new Date(),
  });
  return await mail.compile().build();
}

/** Find the Sent mailbox path (special-use \Sent, else a common name). */
async function findSentMailbox(client: ImapFlow): Promise<string> {
  const boxes = await client.list();
  const special = boxes.find((m) => m.specialUse === "\\Sent");
  if (special) return special.path;
  const named = boxes.find((m) => /^(inbox\.)?sent(\s*items)?$/i.test(m.path));
  return named?.path ?? "Sent";
}

export async function appendToSent(copy: SentCopy): Promise<boolean> {
  const env = getEnv();
  if (!env.saveToSent || !env.smtpUser || !env.smtpPass) return false;

  let client: ImapFlow | null = null;
  try {
    client = new ImapFlow({
      host: env.imapHost,
      port: env.imapPort,
      secure: true,
      auth: { user: env.smtpUser, pass: env.smtpPass },
      logger: false,
      // Keep this from hanging the request if IMAP is unreachable.
      socketTimeout: 15_000,
    });
    await client.connect();
    const raw = await buildRfc822(copy);
    const sentPath = await findSentMailbox(client);
    await client.append(sentPath, raw, ["\\Seen"]);
    return true;
  } catch (err) {
    console.warn("[imap] could not append to Sent folder:", (err as Error).message);
    return false;
  } finally {
    try {
      await client?.logout();
    } catch {
      // ignore
    }
  }
}
