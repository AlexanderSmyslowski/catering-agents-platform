import { JSDOM } from "jsdom";
import type { RecipeSearchQuery, WebRecipeCandidate } from "@catering/shared-core";
import { fetchRecipeCandidateFromUrl, type WebRecipeSearchProvider } from "./provider.js";

function decodeBingResultUrl(href: string): string {
  try {
    const url = new URL(href);
    const encoded = url.searchParams.get("u");
    if (!encoded) {
      return href;
    }

    const payload = encoded.startsWith("a1") ? encoded.slice(2) : encoded;
    const padding = "=".repeat((4 - (payload.length % 4)) % 4);
    const decoded = Buffer.from(payload + padding, "base64url").toString("utf8");
    return decoded.startsWith("http") ? decoded : href;
  } catch {
    return href;
  }
}

function parseResultLinks(html: string): string[] {
  const dom = new JSDOM(html);
  const anchors = [
    ...dom.window.document.querySelectorAll("a.result__a"),
    ...dom.window.document.querySelectorAll("a[data-testid='result-title-a']"),
    ...dom.window.document.querySelectorAll("li.b_algo h2 a")
  ];

  return anchors
    .map((anchor) => anchor.getAttribute("href") ?? "")
    .map((href) => (href.includes("bing.com/ck/a") ? decodeBingResultUrl(href) : href))
    .filter((href) => href.startsWith("http"))
    .slice(0, 10);
}

function isDuckDuckGoBotChallenge(html: string): boolean {
  return /anomaly-modal|bots use DuckDuckGo too|challenge-form/i.test(html);
}

export class DuckDuckGoRecipeSearchProvider implements WebRecipeSearchProvider {
  private async fetchSearchResults(url: string): Promise<string | undefined> {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(2500),
        headers: {
          "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) CateringAgentsBot/0.1"
        }
      });

      if (!response.ok) {
        return undefined;
      }

      return await response.text();
    } catch {
      return undefined;
    }
  }

  async searchRecipes(query: RecipeSearchQuery): Promise<WebRecipeCandidate[]> {
    const searchPages = [
      `https://duckduckgo.com/html/?q=${encodeURIComponent(query.query)}`,
      `https://www.bing.com/search?q=${encodeURIComponent(query.query)}`
    ];

    let links: string[] = [];
    for (const url of searchPages) {
      const html = await this.fetchSearchResults(url);
      if (!html) {
        continue;
      }
      if (url.includes("duckduckgo.com") && isDuckDuckGoBotChallenge(html)) {
        continue;
      }

      links = parseResultLinks(html);
      if (links.length > 0) {
        break;
      }
    }

    if (links.length === 0) {
      return [];
    }
    const candidates = await Promise.all(
      links.slice(0, 6).map(async (link) => {
        try {
          return await fetchRecipeCandidateFromUrl(link);
        } catch {
          return undefined;
        }
      })
    );

    return candidates.filter((candidate): candidate is WebRecipeCandidate => Boolean(candidate));
  }
}
