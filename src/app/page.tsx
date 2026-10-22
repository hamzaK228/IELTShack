import { readFileSync } from "node:fs";
import path from "node:path";
import Script from "next/script";

export default function LandingPage() {
  const html = readFileSync(
    path.join(process.cwd(), "src/content/landingBody.html"),
    "utf8"
  );

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: html }} />
      <Script src="/assets/js/site.js" strategy="afterInteractive" />
    </>
  );
}
