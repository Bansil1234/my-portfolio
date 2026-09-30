import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

// The portfolio is a standalone static site (semantic HTML5 + CSS3 + vanilla JS)
// served from /portfolio/. The app root simply hands off to it.
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bansil Rakholiya — Full-Stack Engineer & Systems Developer" },
      {
        name: "description",
        content:
          "Portfolio of Bansil Rakholiya: resilient backend architecture, low-latency systems and precise, accessible frontends.",
      },
      { property: "og:title", content: "Bansil Rakholiya — Full-Stack Engineer" },
      {
        property: "og:description",
        content:
          "Resilient backend architecture, low-latency systems, and pixel-precise frontends.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  useEffect(() => {
    window.location.replace("/portfolio/index.html");
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">
        Opening the portfolio…{" "}
        <a className="underline" href="/portfolio/index.html">
          Continue
        </a>
      </p>
    </div>
  );
}
