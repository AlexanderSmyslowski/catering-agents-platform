import { JSDOM } from "jsdom";
import type { RecipeSearchQuery, WebRecipeCandidate } from "@catering/shared-core";
import { fetchRecipeCandidateFromUrl, type WebRecipeSearchProvider } from "./provider.js";

type SearchResultLink = {
  url: string;
  title: string;
  snippet?: string;
};

const recipeCuePattern =
  /\b(rezept|recipe|salat|salad|curry|cake|kuchen|suppe|soup|bread|brot|baguette|vinaigrette|dessert|gem[uü]sepfanne|wildkr[aä]uter|wild herb|parsley|krautsalat|karottensalat|coleslaw|pfanne)\b/i;
const collectionPagePattern =
  /\b(top\s*\d+|\d+\s+(extra\s+schnelle|schnelle|beste|best|easy|einfache?)\b|best\s+\w+\s+(recipes?|salads?|cakes?|desserts?)|ideen|ideas|sammlung|collection|best of|die leckersten|die besten)\b/i;

const blockedHostPattern =
  /(zhihu\.com|baidu\.com|support\.google\.com|commentcamarche\.net|oracle\.com|java\.com|breuninger\.com|reddit\.com|carrot\.com|iherb\.com|wikipedia\.org|webmd\.com|englishan\.com|azquotes\.com|cda\.pl|ekino-tv\.pl|stackoverflow\.com|stackexchange\.com|youtube\.com|eaglercraft)/i;

const trustedRecipeHosts = [
  "chefkoch.de",
  "allrecipes.com",
  "noracooks.com",
  "thebigmansworld.com",
  "itdoesnttastelikechicken.com",
  "biancazapatka.com",
  "lovingitvegan.com",
  "rainbowplantlife.com",
  "simplyrecipes.com",
  "spendwithpennies.com",
  "einfachkochen.de",
  "essen-und-trinken.de",
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

function queryTokens(query: RecipeSearchQuery): string[] {
  return `${query.query} ${query.component.label}`
    .toLowerCase()
    .split(/[^a-z0-9äöüß]+/i)
    .filter((token) => token.length >= 3);
}

function prioritizedHostsForQuery(query: RecipeSearchQuery): string[] {
  const label = query.component.label.toLowerCase();
  const hosts = new Set<string>();

  if (query.component.menuCategory === "vegan") {
    for (const host of [
      "noracooks.com",
      "itdoesnttastelikechicken.com",
      "lovingitvegan.com",
      "rainbowplantlife.com",
      "biancazapatka.com",
      "veggie-einhorn.de"
    ]) {
      hosts.add(host);
    }
  }

  if (/kuchen|cake|dessert|schokolade|chocolate/.test(label)) {
    for (const host of ["noracooks.com", "lovingitvegan.com", "thebigmansworld.com", "allrecipes.com"]) {
      hosts.add(host);
    }
  }

  if (/salat|vinaigrette|kraut|karott|wildkr[aä]uter/.test(label)) {
    for (const host of ["essen-und-trinken.de", "chefkoch.de", "eat.de", "gutekueche.at"]) {
      hosts.add(host);
    }
    if (query.component.menuCategory === "vegan") {
      for (const host of [
        "noracooks.com",
        "rainbowplantlife.com",
        "lovingitvegan.com",
        "biancazapatka.com",
        "veggie-einhorn.de"
      ]) {
        hosts.add(host);
      }
    }
  }

  if (/curry|gem[uü]sepfanne|pak-choi|zucchini|pilze|bread|brot|baguette/.test(label)) {
    for (const host of ["biancazapatka.com", "chefkoch.de", "einfachkochen.de", "eat.de"]) {
      hosts.add(host);
    }
  }

  for (const host of trustedRecipeHosts) {
    hosts.add(host);
  }

  return [...hosts].slice(0, 6);
}

function searchResultScore(result: SearchResultLink, query: RecipeSearchQuery): number {
  const haystack = `${result.title} ${result.snippet ?? ""} ${result.url}`.toLowerCase();
  const tokens = queryTokens(query);
  const tokenOverlap = tokens.filter((token) => haystack.includes(token)).length;
  const trustedBoost = hasTrustedRecipeHost(result.url) ? 4 : 0;
  const explicitCategoryBoost =
    query.component.menuCategory === "vegan" && /\bvegan\b/i.test(haystack)
      ? 1.5
      : query.component.menuCategory === "vegetarian" && /\b(vegetarisch|vegetarian|vegan)\b/i.test(haystack)
        ? 1
        : 0;
  const herbBoost =
    /wildkr[aä]uter|wild herb|parsley|petersilie|vinaigrette/i.test(haystack) &&
    /wildkr[aä]uter|wild herb|parsley|petersilie|vinaigrette/i.test(query.query)
      ? 1.25
      : 0;
  const cakeFormBoost =
    /schokoladenkuchen|schokokuchen|chocolate cake|sheet cake|blechkuchen/i.test(haystack) &&
    /schokoladenkuchen|schokokuchen|chocolate cake|sheet cake|blechkuchen/i.test(query.query)
      ? 1.25
      : 0;
  const collectionPenalty = /\b(top\s*\d+|sammlung|collection|ideen|ideas|besten|best of|die besten)\b/i.test(
    haystack
  )
    ? 3
    : 0;

  return trustedBoost + explicitCategoryBoost + herbBoost + cakeFormBoost + tokenOverlap - collectionPenalty;
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

  if (collectionPagePattern.test(haystack)) {
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

  private async fetchSiteRestrictedResults(query: RecipeSearchQuery): Promise<SearchResultLink[]> {
    const market = query.locale === "de" ? "de-DE" : "en-US";
    const hosts = prioritizedHostsForQuery(query);
    const siteResults = await Promise.all(
      hosts.map(async (host) => {
        const rssUrl = `https://www.bing.com/search?format=rss&mkt=${market}&q=${encodeURIComponent(`site:${host} ${query.query}`)}`;
        const xml = await this.fetchSearchResults(rssUrl);
        return xml ? parseBingRssResults(xml) : [];
      })
    );

    return siteResults.flat();
  }

  async searchRecipes(query: RecipeSearchQuery): Promise<WebRecipeCandidate[]> {
    const rssResults = await this.fetchBingRssResults(query);
    const needsHostExpansion =
      rssResults.filter((result) => hasTrustedRecipeHost(result.url)).length < 2 ||
      query.component.menuCategory === "vegan";
    const expandedResults = needsHostExpansion
      ? await this.fetchSiteRestrictedResults(query)
      : [];

    const links = [...new Map(
      [...rssResults, ...expandedResults]
        .sort((left, right) => searchResultScore(right, query) - searchResultScore(left, query))
        .map((result) => [result.url, result])
    ).values()]
      .map((result) => result.url)
      .slice(0, 10);

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
