import type { Metadata } from "next";
import { BoothSession } from "@/features/booth/components/booth-session";

export const metadata: Metadata = {
  title: "Sesi foto",
  robots: {
    index: false,
    follow: false,
  },
};

export default function BoothPage() {
  return <BoothSession />;
}
