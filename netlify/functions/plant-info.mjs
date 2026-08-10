// Smart fill — the "AI gardener" that fills in the Add-a-plant form when the
// built-in plant dictionary doesn't recognize a name.
// Uses the Netlify AI Gateway (auto-injected ANTHROPIC_API_KEY + ANTHROPIC_BASE_URL).
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ maxRetries: 0, timeout: 20_000 });

const MODELS = [
  "claude-opus-4-8",
  "claude-opus-4-5",
  "claude-sonnet-4-5",
  "claude-haiku-4-5",
];

export default async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "POST only" }, { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Bad JSON" }, { status: 400 });
  }

  const name = String(body.name || "").slice(0, 120).trim();
  if (!name) return Response.json({ error: "Missing name" }, { status: 400 });

  // The page sends its list of available illustration keys so the model can
  // pick the icon that fits best.
  const forms = (Array.isArray(body.forms) ? body.forms : [])
    .slice(0, 80)
    .map((f) => `${String(f.key).slice(0, 40)} = ${String(f.label).slice(0, 60)}`)
    .join("\n");

  const prompt = `You are a Central Texas gardening expert helping fill out a plant-tracker card for a garden in Jonestown, TX (USDA zone 8b, hot summers, occasional hard freezes, on a septic drain field).

The gardener typed the plant name: "${name}"

If that is a recognizable plant (common or latin name, typos are fine), reply with ONLY this JSON, no other text:
{"latin":"...","type":"...","sun":"...","water":"...","septic":"...","cold":"...","roots":"...","native":true,"toxic":false,"vibe":"...","form":"...","note":"..."}

Field rules:
- "latin": botanical name.
- "type": short plain description, e.g. "Flowering shrub", "Succulent", "Shade tree".
- "sun": exactly one of "Full Sun", "Sun / Part Shade", "Part Shade", "Shade".
- "water": exactly one of "Low", "Medium", "Thirsty".
- "septic": how safe its roots are over a septic drain field — exactly one of "safe" (shallow, gentle roots), "caution" (keep a few feet away), "avoid" (aggressive/deep roots).
- "cold": winter behavior in zone 8b — exactly one of "hardy" (fully cold-hardy), "dieback" (top dies back, roots survive), "cover" (cover during a freeze), "tender" (must come inside).
- "roots": 2-4 words about the root habit, e.g. "Shallow, tidy".
- "native": true only if native to Texas.
- "toxic": true if toxic or a skin irritant to people or pets.
- "vibe": a cute little motto in the plant's own voice, under 40 characters, e.g. "I love the heat!".
- "form": the best-matching illustration key from this list (reply with the key only):
${forms}
- "note": one friendly sentence of care advice for this plant in Central Texas.

If "${name}" is not a real plant you can identify, reply with ONLY: {"unknown":true}`;

  let lastErr = "AI unavailable";
  for (const model of MODELS) {
    try {
      const msg = await anthropic.messages.create({
        model,
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      });
      const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
      const json = /\{[\s\S]*\}/.exec(text);
      if (!json) throw new Error("No JSON in model reply");
      const parsed = JSON.parse(json[0]);
      if (parsed.unknown) return Response.json({ unknown: true });

      const pick = (v, list, fallback) => (list.includes(v) ? v : fallback);
      return Response.json({
        latin: String(parsed.latin || "").slice(0, 80),
        type: String(parsed.type || "My plant").slice(0, 60),
        sun: pick(parsed.sun, ["Full Sun", "Sun / Part Shade", "Part Shade", "Shade"], "Full Sun"),
        water: pick(parsed.water, ["Low", "Medium", "Thirsty"], "Medium"),
        septic: pick(parsed.septic, ["safe", "caution", "avoid"], "caution"),
        cold: pick(parsed.cold, ["hardy", "dieback", "cover", "tender"], "hardy"),
        roots: String(parsed.roots || "—").slice(0, 60),
        native: !!parsed.native,
        toxic: !!parsed.toxic,
        vibe: String(parsed.vibe || "").slice(0, 60),
        form: String(parsed.form || "").slice(0, 40),
        note: String(parsed.note || "").slice(0, 300),
        source: "ai",
        model,
      });
    } catch (err) {
      lastErr = err?.message || String(err);
      const status = err?.status;
      if (status && ![400, 403, 404, 422, 429].includes(status)) break;
    }
  }
  return Response.json({ error: lastErr }, { status: 502 });
};

export const config = { path: "/api/plant-info" };
