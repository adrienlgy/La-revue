export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { url } = req.query;
  if (!url || !url.startsWith("https://")) {
    return res.status(400).json({ error: "Missing or non-HTTPS url" });
  }

  try {
    const upstream = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RSS/2.0)" },
    });
    if (!upstream.ok) throw new Error(`Upstream HTTP ${upstream.status}`);
    const xml = await upstream.text();
    const items = parseRSS(xml);
    res.status(200).json({ status: "ok", items });
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
  }
}

function text(xml, tag) {
  const re = new RegExp(
    `<${tag}(?:\\s[^>]*)?>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tag}>`,
    "i"
  );
  const m = xml.match(re);
  if (!m) return "";
  return (m[1] !== undefined ? m[1] : m[2] ?? "").trim();
}

function link(xml) {
  // RSS: <link>url</link>
  const rss = text(xml, "link");
  if (rss.startsWith("http")) return rss;
  // Atom: <link href="url" rel="alternate"/> — skip rel="replies"
  const re = /<link([^>]*)>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const attrs = m[1];
    if (/rel=["']replies["']/.test(attrs)) continue;
    const href = attrs.match(/href=["']([^"']+)["']/)?.[1];
    if (href) return href;
  }
  return "";
}

function parseRSS(xml) {
  const items = [];
  const re = /<item[\s>]([\s\S]*?)<\/item>|<entry[\s>]([\s\S]*?)<\/entry>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const c = m[1] ?? m[2];
    items.push({
      title: text(c, "title"),
      description: text(c, "description") || text(c, "summary") || text(c, "content"),
      pubDate: text(c, "pubDate") || text(c, "published") || text(c, "updated"),
      link: link(c),
    });
  }
  return items;
}
