import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const { user } = data;

      const { error: upsertError } = await supabase.from("users").upsert(
        {
          id: user.id,
          email: user.email,
          nickname:
            user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
          provider: user.app_metadata?.provider ?? null,
        },
        { onConflict: "id" }
      );

      if (upsertError) {
        console.error("[auth/callback] users upsert failed:", upsertError);
        return NextResponse.redirect(`${origin}/login`);
      }

      const { data: membership } = await supabase
        .from("workspace_member")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      const destination = membership ? "/home" : "/workspace";
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
