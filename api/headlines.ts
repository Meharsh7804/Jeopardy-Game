type FeedHeadline = { title: string; link: string };
type TaggedHeadline = { tag: "INDIA" | "WORLD"; title: string; link: string };

function decodeEntities(str: string): string {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => {
      const code = parseInt(n, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .trim();
}

function cleanTitle(title: string): string {
  return decodeEntities(title)
    .replace(/\s+-\s+BBC News$/i, "")
    .replace(/\s+-\s+BBC$/i, "")
    .replace(/\s+-\s+The Hindu$/i, "")
    .replace(/\s+-\s+NDTV.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractHeadlines(xml: string, limit = 6): FeedHeadline[] {
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  const headlines: FeedHeadline[] = [];
  for (const item of items) {
    const titleMatch = item.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const linkMatch = item.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
    const rawTitle = titleMatch?.[1] || "";
    const rawLink = linkMatch?.[1] || "";
    const title = cleanTitle(rawTitle);
    const link = decodeEntities(rawLink).replace(/^<!\[CDATA\[|\]\]>$/g, "").trim();
    if (!title) continue;
    headlines.push({ title, link });
    if (headlines.length >= limit) break;
  }
  return headlines;
}

async function fetchFeed(url: string, limit = 6): Promise<FeedHeadline[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "BuzzingWithQuizzing/1.0 (+vercel-serverless)",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
    });
    if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`);
    const xml = await res.text();
    return extractHeadlines(xml, limit);
  } finally {
    clearTimeout(timer);
  }
}

function interleave(india: FeedHeadline[], world: FeedHeadline[]): TaggedHeadline[] {
  const out: TaggedHeadline[] = [];
  const len = Math.max(india.length, world.length);
  for (let i = 0; i < len; i++) {
    if (india[i]) out.push({ tag: "INDIA", ...india[i] });
    if (world[i]) out.push({ tag: "WORLD", ...world[i] });
  }
  return out;
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=600");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  try {
    const [indiaSettled, worldSettled] = await Promise.allSettled([
      (async () => {
        const primary = await fetchFeed("https://www.thehindu.com/news/national/feeder/default.rss", 6);
        if (primary.length > 0) return primary;
        return fetchFeed("https://feeds.feedburner.com/ndtvnews-india-news", 6);
      })(),
      fetchFeed("https://feeds.bbci.co.uk/news/world/rss.xml", 6),
    ]);

    const india = indiaSettled.status === "fulfilled" ? indiaSettled.value : [];
    const world = worldSettled.status === "fulfilled" ? worldSettled.value : [];
    const headlines = interleave(india, world);

    res.status(200).json({ headlines, source: "live", updatedAt: new Date().toISOString() });
  } catch {
    res.status(200).json({ headlines: [], source: "unavailable", updatedAt: new Date().toISOString() });
  }
}
