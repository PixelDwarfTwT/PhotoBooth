import type { Metadata } from "next";
import { RemoteCameraPage } from "@/features/booth/components/remote-camera-page";

export const metadata: Metadata = {
  title: "Kamera HP",
  robots: { index: false, follow: false },
};

export default async function RemoteCameraRoute({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <RemoteCameraPage sessionId={sessionId} />;
}
