import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "@/lib/prompts";
import type { GenerateRequest } from "@/lib/types";

export const runtime = "nodejs";
// Opus 5 auf Effort-Stufe "Extra" denkt lange – die Funktion braucht Luft.
export const maxDuration = 300;

const MODEL = "claude-opus-5";
const IMAGE_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ImageMediaType = (typeof IMAGE_MEDIA_TYPES)[number];

/** Zerlegt eine Data-URL in Media-Type und base64-Nutzdaten. */
function parseImageDataUrl(
  dataUrl: string | null | undefined,
): { mediaType: ImageMediaType; data: string } | null {
  if (!dataUrl) return null;
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) return null;
  const mediaType = match[1].toLowerCase();
  if (!IMAGE_MEDIA_TYPES.includes(mediaType as ImageMediaType)) return null;
  return { mediaType: mediaType as ImageMediaType, data: match[2] };
}

function buildUserText(body: GenerateRequest): string {
  const parts: string[] = [];

  const headlines = (body.headlines ?? []).filter((h) => h.trim().length > 0);
  const context: string[] = [];
  if (headlines.length > 0) {
    context.push(
      `Überschriften der Anzeige:\n${headlines.map((h, i) => `${i + 1}. ${h}`).join("\n")}`,
    );
  }
  if (body.description?.trim()) {
    context.push(`Beschreibung (Link Description): ${body.description.trim()}`);
  }
  if (body.cta?.trim()) {
    context.push(`Call-to-Action-Button: ${body.cta.trim()}`);
  }
  if (context.length > 0) {
    parts.push(`<kontext>\n${context.join("\n\n")}\n</kontext>`);
  }

  parts.push(`<langer_werbetext>\n${body.longText.trim()}\n</langer_werbetext>`);
  parts.push(`<anweisung>\n${body.prompt.trim()}\n</anweisung>`);
  parts.push("Gib jetzt ausschließlich den gekürzten Werbetext aus.");

  return parts.join("\n\n");
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY ist nicht gesetzt." },
      { status: 500 },
    );
  }

  let body: GenerateRequest;
  try {
    body = (await request.json()) as GenerateRequest;
  } catch {
    return Response.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  if (!body.longText?.trim()) {
    return Response.json(
      { error: "Es ist kein langer Werbetext vorhanden." },
      { status: 400 },
    );
  }
  if (!body.prompt?.trim()) {
    return Response.json({ error: "Der Prompt ist leer." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  const image = parseImageDataUrl(body.assetDataUrl);
  const content: Anthropic.ContentBlockParam[] = [];
  if (image) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: image.mediaType, data: image.data },
    });
  }
  content.push({ type: "text", text: buildUserText(body) });

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const messageStream = client.messages.stream({
          model: MODEL,
          max_tokens: 8000,
          system: SYSTEM_PROMPT,
          thinking: { type: "adaptive" },
          output_config: { effort: "xhigh" },
          messages: [{ role: "user", content }],
        });

        for await (const event of messageStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }

        const finalMessage = await messageStream.finalMessage();
        if (finalMessage.stop_reason === "refusal") {
          controller.enqueue(
            encoder.encode(
              "\n\n[Die Anfrage wurde vom Modell abgelehnt. Bitte Text oder Prompt anpassen.]",
            ),
          );
        }
        controller.close();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unbekannter Fehler";
        controller.enqueue(encoder.encode(`\n\n[Fehler: ${message}]`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
