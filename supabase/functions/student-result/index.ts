import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function normalizeArabic(value: unknown) {
  return String(value ?? "").toLocaleLowerCase("ar").normalize("NFD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/\u0640/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[\s\u200f\u200e]+/g, " ")
    .trim();
}

function nameMatches(stored: string, entered: string) {
  const target = normalizeArabic(stored);
  const parts = normalizeArabic(entered).split(" ").filter(Boolean);
  return parts.length > 0 && parts.every((part) => target.includes(part));
}

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const masterPassword = Deno.env.get("MASTER_PASSWORD") || "2323";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "الطريقة غير مسموحة" }, 405);
  try {
    const body = await request.json();
    if (String(body.password ?? "") !== masterPassword) return json({ error: "كلمة المرور غير صحيحة." }, 401);

    // Password-only requests unlock the second step without touching grade data.
    if (body.name === undefined && body.section === undefined && body.serial === undefined) return json({ unlocked: true });
    const section = Number(body.section), serial = Number(body.serial), enteredName = String(body.name ?? "").trim();
    if (!Number.isInteger(section) || section < 1 || section > 30 || !Number.isInteger(serial) || serial < 1 || enteredName.length < 2) return json({ error: "بيانات الاستعلام غير مكتملة." }, 400);

    // The service-role key is server-only. RLS blocks direct public reads of this table.
    const { data, error } = await supabase.from("student_grades").select("name, semester_work").eq("section", section).eq("serial", serial).maybeSingle();
    if (error) throw error;
    if (!data || !nameMatches(data.name, enteredName)) return json({ error: "لم نعثر على طالب مطابق. راجع السكشن والرقم والاسم." }, 404);
    return json({ name: data.name, work: Number(data.semester_work ?? 0) });
  } catch (error) {
    console.error(error);
    return json({ error: "تعذر إتمام الاستعلام حالياً." }, 500);
  }
});
