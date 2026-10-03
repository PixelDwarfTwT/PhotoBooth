import { ShareViewer } from "@/features/share/components/share-viewer";
import { getSharePageMetadata } from "@/lib/share-metadata";

interface SharePageProps {
  params: Promise<{ token: string }>;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const generateMetadata = getSharePageMetadata;

export default async function SharePage({ params }: SharePageProps) {
  const { token } = await params;
  return <ShareViewer token={token} />;
}
