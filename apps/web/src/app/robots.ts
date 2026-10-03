import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/public-catalog";
import { createRobotsPolicy } from "@/lib/robots-policy";

export default function robots(): MetadataRoute.Robots {
  return createRobotsPolicy(SITE_ORIGIN);
}
