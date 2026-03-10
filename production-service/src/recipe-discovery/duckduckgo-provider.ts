import { JSDOM } from "jsdom";
import type { RecipeSearchQuery, WebRecipeCandidate } from "@catering/shared-core";
import { fetchRecipeCandidateFromUrl, type WebRecipeSearchProvider } from "./provider.js";

function parseResultLinks(html: string): string[] {
  const dom = new JSDOM(html);
  const anchors = [
    ...dom.window.document.querySelectorAll("a.result__a"),
    ...dom.window.document.querySelectorAll("a[data-testid='result-title-a']")
  ];

  return anchors
    .map((anchor) => anchor.getAttribute("href") ?? "")
    .filter((href) => href.startsWith("http"))
    .slice(0, 10);
}

export class DuckDuckGoRecipeSearchProvider implements WebRecipeSearchProvider {
  async searchRecipes(query: RecipeSearchQuery): Promise<WebRecipeCandidate[]> {
    const response = await fetch(
      `https://duckduckgo.com/html/?q=${encodeURIComponent(query.query)}`,
      {
        headers: {
          "user-agent": "CateringAgentsBot/0.1 (+internal MVP recipe discovery)"
        }
      }
    );

    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    const links = parseResultLinks(html);
    const candidates = await Promise.all(
      links.map(async (link) => {
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

