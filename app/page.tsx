import { redirect } from "next/navigation";
import { DEMO_ENGAGEMENT_ID } from "@/lib/constants";

// Single seeded engagement in the prototype — jump straight into it.
export default function Home() {
  redirect(`/engagements/${DEMO_ENGAGEMENT_ID}`);
}
