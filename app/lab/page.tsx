import { redirect } from "next/navigation";
export default async function Lab({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams({ view: "research" });
  for (const key of ["seed", "scenario", "policy"]) {
    const value = params[key];
    if (typeof value === "string") query.set(key, value);
  }
  redirect(`/?${query}`);
}
