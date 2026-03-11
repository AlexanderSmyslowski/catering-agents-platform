import { JSDOM } from "jsdom";
import type { RecipeSearchQuery, WebRecipeCandidate } from "@catering/shared-core";
import { fetchRecipeCandidateFromUrl, type WebRecipeSearchProvider } from "./provider.js";

type SearchResultLink = {
  url: string;
  title: string;
  snippet?: string;
};

const recipeCuePattern =
  /\b(rezept|recipe|salat|salad|curry|cake|kuchen|suppe|soup|bread|brot|baguette|vinaigrette|dessert|gem[uü]sepfanne|wildkr[aä]uter|krautsalat|karottensalat|coleslaw|pfanne)\b/i;

const blockedHostPattern =
  /(zhihu\.com|baidu\.com|support\.google\.com|commentcamarche\.net|oracle\.com|java\.com|breuninger\.com|reddit\.com|carrot\.com|iherb\.com|wikipedia\.org|webmd\.com|englishan\.com|azquotes\.com|cda\.pl|ekino-tv\.pl|stackoverflow\.com|stackexchange\.com|youtube\.com|eaglercraft)/i;

const trustedRecipeHosts = [
  "chefkoch.de",
  "allrecipes.com",
  "noracooks.com",
  "thebigmansworld.com",
  "itdoesnttastelikechicken.com",
  "simplyrecipes.com",
  "spendwithpennies.com",
  "einfachkochen.de",
  "emmikochteinfach.de",
  "eat.de",
  "lecker.de",
  "veggie-einhorn.de",
  "kraeuter-buch.de",
  "kochideenzeit.de",
  "omasrezepte.de",
  "ndr.de"
];

function hostnameFor(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isLikelySearchResultsPage(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      /\/rs\//i.test(parsed.pathname) ||
      /\/search/i.test(parsed.pathname) ||
      parsed.searchParams.has("q") ||
      parsed.searchParams.has("query")
    );
  } catch {
    return false;
  }
}

function hasTrustedRecipeHost(url: string): boolean {
  const hostname = hostnameFor(url);
  return trustedRecipeHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

function isLikelyRecipeResult(result: SearchResultLink): boolean {
  const haystack = `${result.title} ${result.snippet ?? ""} ${result.url}`;
  if (!result.url.startsWith("http")) {
    return false;
  }

  if (blockedHostPattern.test(result.url)) {
    return false;
  }

  if (isLikelySearchResultsPage(result.url)) {
    return false;
  }

  return hasTrustedRecipeHost(result.url) || recipeCuePattern.test(haystack);
}

function parseBingRssResults(xml: string): SearchResultLink[] {
  const dom = new JSDOM(xml, { contentType: "text/xml" });
  return [...dom.window.document.querySelectorAll("item")]
    .map((item) => ({
      url: item.querySelector("link")?.textContent?.trim() ?? "",
      title: item.querySelector("title")?.textContent?.trim() ?? "",
      snippet: item.querySelector("description")?.textContent?.trim() ?? ""
    }))
    .filter((result) => result.url.startsWith("http"))
    .filter(isLikelyRecipeResult)
    .slice(0, 10);
}

export class DuckDuckGoRecipeSearchProvider implements WebRecipeSearchProvider {
  private async fetchSearchResults(url: string): Promise<string | undefined> {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(3500),
        headers: {
          "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) CateringAgentsBot/0.1",
          "accept-language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7"
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

  private async fetchBingRssResults(query: RecipeSearchQuery): Promise<SearchResultLink[]> {
    const market = query.locale === "de" ? "de-DE" : "en-US";
    const rssUrl = `https://www.bing.com/search?format=rss&mkt=${market}&q=${encodeURIComponent(query.query)}`;
    const xml = await this.fetchSearchResults(rssUrl);
    return xml ? parseBingRssResults(xml) : [];
  }

  async searchRecipes(query: RecipeSearchQuery): Promise<WebRecipeCandidate[]> {
    const rssResults = await this.fetchBingRssResults(query);
    const links = rssResults.map((result) => result.url);

    if (links.length === 0) {
      return [];
    }

    const candidates = await Promise.all(
      [...new Set(links)].slice(0, 8).map(async (link) => {
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
