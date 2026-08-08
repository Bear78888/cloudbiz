import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SellerRelay Logistics",
    short_name: "SellerRelay",
    description: "U.S. prep and logistics for international marketplace sellers.",
    start_url: "/en",
    display: "standalone",
    background_color: "#F5F7FB",
    theme_color: "#0B1633",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
