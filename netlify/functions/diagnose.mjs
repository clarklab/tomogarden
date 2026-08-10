// Plant Check — AI photo diagnosis.
// Runs on Netlify Functions using the Netlify AI Gateway, which automatically
// injects ANTHROPIC_API_KEY + ANTHROPIC_BASE_URL, so the SDK needs no config
// and usage is billed straight to the Netlify account (no separate API key).
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ maxRetries: 0, timeout: 22_000 });

// Most capable first; step down if the gateway doesn't offer a model yet.
const MODELS = [
  "claude-opus-4-8",
  "claude-opus-4-5",
  "claude-sonnet-4-5",
  "claude-haiku-4-5",
];

// Maps the model's verdict onto the labels/icons/colors the page already uses.
const LOOKS = {
  healthy: { label: "Looks healthy", icon: "check_circle", cls: "res-healthy" },
  thirsty: { label: "Looks thirsty / dry", icon: "water_drop", cls: "res-thirsty" },
  stress: { label: "Yellowing / stressed", icon: "warning", cls: "res-stress" },
  pest: { label: "Possible pests or disease", icon: "pest_control", cls: "res-pest" },
  info: { label: "Need a clearer photo", icon: "help", cls: "res-info" },
};

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

  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(
    body.image || ""
  );
  if (!match) return Response.json({ error: "Missing or invalid image" }, { status: 400 });
  if (match[2].length > 2_500_000) {
    return Response.json({ error: "Image too large" }, { status: 413 });
  }

  const plant = String(body.plant || "this plant").slice(0, 120);
  const profile = body.profile || {};
  const month = new Date().toLocaleString("en-US", { month: "long", timeZone: "America/Chicago" });

  const prompt = `You are a friendly plant doctor helping a beginner gardener in Jonestown, Texas (Central Texas, USDA zone 8b). It is ${month}.

The photo is supposed to show their plant "${plant}"${profile.sun ? ` (likes ${profile.sun}, ${profile.water || "medium"} water, ${profile.hardy || ""})` : ""}. Look closely at the leaves, stems, and soil and judge how it's doing.

Reply with ONLY a JSON object in exactly this shape, no other text:
{"status":"healthy|thirsty|stress|pest|info","summary":"...","tips":["...","..."]}

Rules:
- "status": healthy = happy plant; thirsty = dry/underwatered/heat-crisped; stress = yellowing, nutrient or watering trouble; pest = visible pests, spots, or disease; info = the photo is too unclear or isn't a plant.
- "summary": one warm, plain-English sentence (under 160 characters) describing what you actually see in the photo.
- "tips": 3 or 4 short, practical steps for THIS plant in Central Texas in ${month}. Beginner-friendly, no jargon. Mention specific things you noticed in the photo when you can.`;

  const content = [
    { type: "image", source: { type: "base64", media_type: match[1], data: match[2] } },
    { type: "text", text: prompt },
  ];

  let lastErr = "AI unavailable";
  for (const model of MODELS) {
    try {
      const msg = await anthropic.messages.create({
        model,
        max_tokens: 700,
        messages: [{ role: "user", content }],
      });
      const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
      const json = /\{[\s\S]*\}/.exec(text);
      if (!json) throw new Error("No JSON in model reply");
      const parsed = JSON.parse(json[0]);
      const look = LOOKS[parsed.status] || LOOKS.info;
      const tips = (Array.isArray(parsed.tips) ? parsed.tips : [])
        .slice(0, 5)
        .map((t) => String(t).slice(0, 300));
      return Response.json({
        ...look,
        summary: String(parsed.summary || "Here's what I can see in the photo.").slice(0, 400),
        tips: tips.length ? tips : ["Try another photo in brighter light so I can see the leaves clearly."],
        source: "ai",
        model,
      });
    } catch (err) {
      lastErr = err?.message || String(err);
      // Model not offered / rejected by the gateway → try the next one.
      const status = err?.status;
      if (status && ![400, 403, 404, 422, 429].includes(status)) break;
    }
  }
  return Response.json({ error: lastErr }, { status: 502 });
};

export const config = { path: "/api/diagnose" };
