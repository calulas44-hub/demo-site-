import type { NextConfig } from "next";

const onNetlify = Boolean(process.env.NETLIFY);

const nextConfig: NextConfig = {
  // Netlify : sortie gérée par @netlify/plugin-nextjs. Docker / serveur Node : sortie autonome.
  ...(onNetlify ? {} : { output: "standalone" as const }),
  poweredByHeader: false,
  serverExternalPackages: ["pdfkit", "sharp", "exceljs", "nodemailer", "bcryptjs"],
  // Polices intégrées de pdfkit (factures PDF) : à embarquer dans les fonctions serveur.
  outputFileTracingIncludes: { "/**": ["./node_modules/pdfkit/js/data/**"] },
  experimental: {
    // Les médias ne transitent plus par les actions serveur (envoi direct vers le stockage).
    serverActions: { bodySizeLimit: "2mb" },
  },
  async headers() {
    const security = [
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    if (process.env.NODE_ENV === "production") security.push({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" });
    return [
      { source: "/(.*)", headers: security },
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
