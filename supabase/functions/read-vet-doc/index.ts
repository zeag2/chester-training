// PalDex: read a vet document (photo or PDF) and suggest care-log entries.
// Runs as a Supabase Edge Function (Deno). Needs the secret ANTHROPIC_API_KEY.
// The caller's own sign-in is used to download the file, so storage rules decide who can read it.
import Anthropic from 'npm:@anthropic-ai/sdk@1.3.0';
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const day = { type: ['string', 'null'], description: 'YYYY-MM-DD, or null if not on the document' };
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'docDate', 'clinic', 'visitReason', 'vetNotes', 'weightLb', 'items', 'summary'],
  properties: {
    title: { type: 'string', description: 'Short name for the document, e.g. "Kitten shots invoice"' },
    docDate: day,
    clinic: { type: ['string', 'null'] },
    visitReason: { type: ['string', 'null'], description: 'Why the pet was seen, if this records a visit' },
    vetNotes: { type: ['string', 'null'], description: 'Findings or instructions from the vet, in plain words, under 300 characters' },
    weightLb: { type: ['number', 'null'], description: 'Weight in pounds (convert from kg if needed)' },
    items: {
      type: 'array',
      description: 'Vaccines, flea/tick treatments, dewormers and medicines given or prescribed',
      items: {
        type: 'object', additionalProperties: false, required: ['name', 'kind', 'date', 'nextDue', 'notes'],
        properties: {
          name: { type: 'string' },
          kind: { type: 'string', enum: ['vaccine', 'flea', 'worm', 'medicine'] },
          date: day,
          nextDue: { ...day, description: 'When the next dose or booster is due, if stated' },
          notes: { type: ['string', 'null'], description: 'Dose or instructions, short' },
        },
      },
    },
    summary: { type: 'string', description: 'One or two plain sentences about what this document is' },
  },
};

const PROMPT = `This is a veterinary document for a pet cat (an invoice, visit summary, vaccine certificate or prescription).
Pull out only what is written on it. Never guess: use null for anything that isn't there.
Dates as YYYY-MM-DD. Weight in pounds. List each vaccine, flea/tick treatment, dewormer and medicine once.
If the document isn't a vet record, say so in the summary and leave the rest empty or null.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  try {
    const { path } = await req.json();
    if (typeof path !== 'string' || !/^[\w-]{1,64}\/[\w-]{1,64}\.(jpg|jpeg|png|webp|gif|pdf)$/i.test(path)) return json({ error: 'bad path' }, 400);
    const auth = req.headers.get('Authorization') ?? '';
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: file, error } = await sb.storage.from('pet-docs').download(path);
    if (error || !file) return json({ error: 'Could not open that document' }, 404);
    if (file.size > 20 * 1024 * 1024) return json({ error: 'That file is too big to read (over 20 MB)' }, 413);

    const bytes = new Uint8Array(await file.arrayBuffer());
    let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const data = btoa(bin);
    const ext = path.split('.').pop()!.toLowerCase();
    const source = ext === 'pdf'
      ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data } }
      : { type: 'image' as const, source: { type: 'base64' as const, media_type: (ext === 'jpg' ? 'image/jpeg' : `image/${ext}`) as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data } };

    const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
    // If the model declines, the API re-runs the request on Anthropic's recommended fallback model.
    const msg = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: [source, { type: 'text', text: PROMPT }] }],
    });

    if (msg.stop_reason === 'refusal') return json({ error: 'This document couldn’t be read automatically. Add the details by hand.' }, 422);
    if (msg.stop_reason === 'max_tokens') return json({ error: 'The document was too long to finish reading.' }, 422);
    const text = msg.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') return json({ error: 'No result' }, 502);
    return json({ result: JSON.parse(text.text) });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return json({ error: 'The Claude API key is missing or wrong (Edge Function secret ANTHROPIC_API_KEY).' }, 500);
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Too many documents at once. Try again in a minute.' }, 429);
    if (e instanceof Anthropic.APIError) return json({ error: `Claude API error ${e.status}` }, 502);
    return json({ error: 'Something went wrong reading the document' }, 500);
  }
});
