import { proxyAgentRequest, requireAuthOrRespond } from "@/lib/agentServer";

export async function POST(request: Request) {
  const authError = await requireAuthOrRespond();
  if (authError) return authError;

  const body = await request.text();
  return proxyAgentRequest("/extract-text", body);
}
