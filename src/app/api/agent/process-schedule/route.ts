import { proxyAgentRequest } from "@/lib/agentServer";

export async function POST(request: Request) {
  const body = await request.text();
  return proxyAgentRequest("/process-schedule", body);
}
