import type { Metadata } from "next";

export function getSharePageMetadata(): Metadata {
  return {
    title: "Photo strip sementara",
    description: "Buka hasil photo strip yang dibagikan sementara.",
    robots: {
      index: false,
      follow: false,
      noarchive: true,
      nosnippet: true,
    },
  };
}
