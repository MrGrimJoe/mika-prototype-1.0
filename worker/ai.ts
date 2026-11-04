import type { Env } from './env';
import { HttpError } from './env';

const MODEL = 'gemini-2.5-flash';

const INTERPRETATION_SYSTEM_INSTRUCTION = `You are the interpretation layer for a recursive organisational system (Mika).
You receive an org schema (departments, sections, roles, authority relationships) and a management request or query.
You return a JSON proposal only, with no explanation outside JSON, no preamble, no markdown.
The deterministic authorization engine, not you, decides ALLOW or DENY.

Rules you apply when proposing:
- A department root has authority over subordinate department roots.
- A section root has authority over roles inside its grouped departments, not over those departments' own roots.
- A user holding multiple roles has the union of all their assignments' scopes.
- Help requests route to the direct lead of the department the task belongs to; if the requester holds roles in multiple departments, resolve by the task's department.
- Authority never flows upward: a role cannot affect its own lead.
- Event bindings create horizontal collaboration between leads without creating hierarchical authority.
- Return { "error": "insufficient_context" } if the schema is incomplete.`;

async function gemini(env: Env, body: Record<string, unknown>): Promise<any> {
  if (!env.GEMINI_API_KEY) throw new HttpError(503, 'AI is not configured on this deployment (no GEMINI_API_KEY secret).', { code: 'ai_not_configured' });
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new HttpError(502, `The AI service returned ${res.status}`);
  const data: any = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? '';
  try {
    return JSON.parse(text.trim() || '{}');
  } catch {
    throw new HttpError(502, 'The AI service returned something that was not valid JSON');
  }
}

const jsonConfig = { responseMimeType: 'application/json' };

export async function assistanceGenerate(env: Env, body: { prompt?: string; userName?: string }) {
  if (!body.prompt?.trim()) throw new HttpError(400, 'Describe the organisation you want to build');
  const text = `The user "${body.userName || 'User'}" wants to build an organizational flowchart hierarchy.
User Request: "${body.prompt}"

Rules for the organization tree:
- Root department must have id: "root-department".
- Each department node has: id (string), department (name string), roots (array of root/lead title strings), roles (array of operational role title strings), children (array of department nodes), sectionId (optional string matching a section id, never on root-department).
- Sections (optional array): id (e.g. "sec-1"), name (string), shade ("ash" | "silver" | "slate" | "charcoal" | "graphite" | "sand"), borderStyle ("solid" | "dashed" | "double").
- Return a JSON object with:
  "reply": A friendly, professional explanation of the organizational structure designed for them.
  "tree": The complete hierarchical DepartmentNode tree matching the rules above.
  "sections": An array of Section objects if applicable.
Return ONLY valid JSON matching this format without backticks or markdown wrap.`;
  return gemini(env, { contents: [{ parts: [{ text }] }], generationConfig: jsonConfig });
}

export async function interpret(env: Env, body: { prompt?: string; orgSchema?: unknown; currentUserId?: string; currentRoleTitle?: string }) {
  if (!body.prompt?.trim()) throw new HttpError(400, 'Prompt is required');
  return gemini(env, {
    systemInstruction: { parts: [{ text: INTERPRETATION_SYSTEM_INSTRUCTION }] },
    contents: [{
      parts: [{
        text: `Current Org Schema:\n${JSON.stringify(body.orgSchema ?? {}, null, 2)}\n\nRequester: User "${body.currentUserId}", Role "${body.currentRoleTitle}"\nManagement Request: "${body.prompt}"`,
      }],
    }],
    generationConfig: jsonConfig,
  });
}

export async function generateOrgStructure(env: Env, body: { orgDescription?: string; domainType?: string }) {
  if (!body.orgDescription?.trim()) throw new HttpError(400, 'Description is required');
  const text = `Generate a recursive organizational schema for domain: "${body.domainType || 'Custom'}" with description: "${body.orgDescription}".
Return JSON with: name, description, rootTitle (e.g. Principal, CEO, Executive Director), and departments: an array of
{ name, type ("department" | "section" | "subject" | "temp"), rootRoleTitle, memberRoleTitles (string[]), groupedDeptNames (string[], for sections only) }.`;
  return gemini(env, { contents: [{ parts: [{ text }] }], generationConfig: jsonConfig });
}
