import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { homeFor } from "@/lib/roles";

// The site's address itself: send each person to their first page.
export default async function Home() {
  const user = await requireUser();
  redirect(homeFor(user.role));
}
