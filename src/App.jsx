import { useState, useEffect, useCallback, useRef } from "react";

const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap";
document.head.appendChild(fontLink);

const RSS_PROXY = "https://api.rss2json.com/v1/api.json?rss_url=";

const CATEGORIES = [
  {
    id: "finance",
    label: "Finance & Marchés",
    short: "Finance",
    icon: "↗",
    feeds: [
      { url: "https://www.lesechos.fr/rss/rss_finance.xml", source: "Les Échos", region: "Europe" },
      { url: "https://feeds.bloomberg.com/markets/news.rss", source: "Bloomberg", region: "Global" },
      { url: "https://www.boursorama.com/bourse/actualites/rss/", source: "Boursorama", region: "Europe" },
      { url: "https://feeds.reuters.com/reuters/businessNews", source: "Reuters", region: "Global" },
    ],
  },
  {
    id: "economie",
    label: "Économie",
    short: "Économie",
    icon: "◈",
    feeds: [
      { url: "https://www.lemonde.fr/economie/rss_full.xml", source: "Le Monde Éco", region: "France" },
      { url: "https://www.lesechos.fr/rss/rss_economie.xml", source: "Les Échos", region: "Europe" },
      { url: "https://feeds.reuters.com/reuters/businessNews", source: "Reuters", region: "Global" },
      { url: "https://www.lefigaro.fr/rss/figaro_economie.xml", source: "Le Figaro Éco", region: "France" },
    ],
  },
  {
    id: "politique",
    label: "Politique",
    short: "Politique",
    icon: "⬡",
    feeds: [
      { url: "https://www.lemonde.fr/politique/rss_full.xml", source: "Le Monde", region: "France" },
      { url: "https://www.lefigaro.fr/rss/figaro_politique.xml", source: "Le Figaro", region: "France" },
      { url: "https://feeds.reuters.com/Reuters/worldNews", source: "Reuters World", region: "Global" },
      { url: "https://www.france24.com/fr/rss", source: "France 24", region: "Global" },
    ],
  },
  {
    id: "social",
    label: "Social & Culturel",
    short: "Social",
    icon: "◎",
    feeds: [
      { url: "https://www.lemonde.fr/societe/rss_full.xml", source: "Le Monde Société", region: "France" },
      { url: "https://www.lemonde.fr/culture/rss_full.xml", source: "Le Monde Culture", region: "France" },
      { url: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml", source: "BBC Culture", region: "Global" },
      { url: "https://www.lefigaro.fr/rss/figaro_culture.xml", source: "Le Figaro Culture", region: "France" },
    ],
  },
];

const REFRESH_INTERVAL = 2.5 * 60 * 60 * 1000;
const DIGEST_HOUR = 18;

async function fetchFeed(feedInfo) {
  try {
    const url = `${RSS_PROXY}${encodeURIComponent(feedInfo.url)}&count=4`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== "ok") return [];
    return (data.items || []).map(item => ({
      title: item.title || "",
      summary: item.description
        ? item.description.replace(/<[^>]*>/g, "").slice(0, 200) + "..."
        : "",
      source: feedInfo.source,
      region: feedInfo.region,
      tag: feedInfo.source,
      time: item.pubDate
        ? formatTime(new Date(item.pubDate))
        : "Récent",
      link: item.link || "",
    }));
  } catch {
    return [];
  }
}

function formatTime(date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return `Il y a ${mins} min`;
  if (hours < 24) return `Il y a ${hours}h`;
  return `Il y a ${days}j`;
}

async function fetchCategory(category) {
  const results = await Promise.all(category.feeds.map(fetchFeed));
  const all = results.flat();
  // Deduplicate by title and limit to 10
  const seen = new Set();
  return all.filter(item => {
    if (seen.has(item.title)) return false;
    seen.add(item.title);
    return true;
  }).slice(0, 10);
}

async function fetchDigest(allNews) {
  // Pick top 5 most recent from all categories
  const all = Object.values(allNews).flat();
  return all
    .sort((a, b) => {
      const ta = a.time.includes("min") ? parseInt(a.time) : a.time.includes("h") ? parseInt(a.time) * 60 : 9999;
      const tb = b.time.includes("min") ? parseInt(b.time) : b.time.includes("h") ? parseInt(b.time) * 60 : 9999;
      return ta - tb;
    })
    .slice(0, 5)
    .map(item => ({
      ...item,
      category: CATEGORIES.find(c => c.feeds.some(f => f.source === item.source))?.label || "News",
    }));
}

export default function NewsApp() {
  const [activeTab, setActiveTab] = useState("finance");
  const [newsData, setNewsData] = useState({});
  const [loading, setLoading] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [popup, setPopup] = useState(null);
  const [digest, setDigest] = useState(null);
  const [showDigest, setShowDigest] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [nextRefresh, setNextRefresh] = useState(null);
  const [countdown, setCountdown] = useState("");
  const digestShownToday = useRef(false);

  const loadAll = useCallback(async (withPopup = false) => {
    setLoading(true);
    setSpinning(true);
    setExpandedId(null);
    const now = new Date();
    setLastRefresh(now);
    setNextRefresh(new Date(now.getTime() + REFRESH_INTERVAL));
    const results = {};
    for (const cat of CATEGORIES) {
      const news = await fetchCategory(cat);
      results[cat.id] = news;
      setNewsData(prev => ({ ...prev, [cat.id]: news }));
    }
    setLoading(false);
    setSpinning(false);

    if (withPopup) {
      const all = Object.values(results).flat();
      if (all.length) {
        const pick = all[Math.floor(Math.random() * Math.min(5, all.length))];
        const cat = CATEGORIES.find(c => c.feeds.some(f => f.source === pick.source));
        setPopup({ ...pick, category: cat?.label || "News", icon: cat?.icon || "📰" });
        setTimeout(() => setPopup(null), 10000);
      }
    }
    return results;
  }, []);

  const checkDigestTime = useCallback(async () => {
    const now = new Date();
    if (now.getHours() === DIGEST_HOUR && !digestShownToday.current) {
      digestShownToday.current = true;
      const d = await fetchDigest(newsData);
      setDigest(d);
      setShowDigest(true);
    }
    if (now.getHours() === 0) digestShownToday.current = false;
  }, [newsData]);

  useEffect(() => { loadAll(false); }, []);
  useEffect(() => {
    const auto = setInterval(() => loadAll(true), REFRESH_INTERVAL);
    return () => clearInterval(auto);
  }, [loadAll]);
  useEffect(() => {
    const digestCheck = setInterval(checkDigestTime, 60000);
    return () => clearInterval(digestCheck);
  }, [checkDigestTime]);
  useEffect(() => {
    const tick = setInterval(() => {
      if (!nextRefresh) return;
      const diff = nextRefresh - Date.now();
      if (diff <= 0) { setCountdown("—"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${h > 0 ? h + "h " : ""}${m}m ${s}s`);
    }, 1000);
    return () => clearInterval(tick);
  }, [nextRefresh]);

  const activeCategory = CATEGORIES.find(c => c.id === activeTab);
  const currentNews = newsData[activeTab] || [];

  return (
    <div style={{ minHeight: "100vh", background: "#0d0d0d", color: "#ededed", fontFamily: "'DM Sans', sans-serif", position: "relative" }}>

      {/* HEADER */}
      <header style={{
        padding: "0 32px", height: "64px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid #1a1a1a",
        position: "sticky", top: 0,
        background: "rgba(13,13,13,0.95)",
        backdropFilter: "blur(12px)", zIndex: 200,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{
            width: "32px", height: "32px", background: "#fff", borderRadius: "6px",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "14px", fontWeight: "700", color: "#0d0d0d",
          }}>R</div>
          <div>
            <div style={{ fontSize: "15px", fontWeight: "600", letterSpacing: "-0.3px", color: "#fff" }}>La Revue</div>
            <div style={{ fontSize: "10px", color: "#444", fontFamily: "'DM Mono', monospace" }}>
              {lastRefresh ? `Mis à jour ${lastRefresh.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : "Chargement..."}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={async () => {
              const d = await fetchDigest(newsData);
              setDigest(d);
              setShowDigest(true);
            }}
            style={{
              background: "transparent", border: "1px solid #222", color: "#666",
              padding: "7px 14px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              fontSize: "12px", fontWeight: "500", borderRadius: "8px",
              display: "flex", alignItems: "center", gap: "6px", transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#444"; e.currentTarget.style.color = "#ccc"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#222"; e.currentTarget.style.color = "#666"; }}
          >
            ✦ Top 5 du jour
          </button>
          <button
            onClick={() => !loading && loadAll(false)}
            disabled={loading}
            style={{
              background: loading ? "transparent" : "#fff",
              border: "1px solid " + (loading ? "#222" : "#fff"),
              color: loading ? "#333" : "#0d0d0d",
              padding: "7px 16px", cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "'DM Sans', sans-serif", fontSize: "12px", fontWeight: "600",
              borderRadius: "8px", display: "flex", alignItems: "center", gap: "7px",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "#e0e0e0"; }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = "#fff"; }}
          >
            <span style={{ display: "inline-block", animation: spinning ? "spin 0.7s linear infinite" : "none", fontSize: "14px", lineHeight: 1 }}>↻</span>
            {loading ? "Chargement…" : "Actualiser"}
          </button>
        </div>
      </header>

      {/* TABS */}
      <div style={{
        display: "flex", padding: "0 32px",
        borderBottom: "1px solid #161616", background: "#0a0a0a",
        gap: "2px", overflowX: "auto",
      }}>
        {CATEGORIES.map(cat => {
          const isActive = activeTab === cat.id;
          return (
            <button key={cat.id}
              onClick={() => { setActiveTab(cat.id); setExpandedId(null); }}
              style={{
                background: "transparent", border: "none",
                borderBottom: isActive ? "2px solid #fff" : "2px solid transparent",
                color: isActive ? "#fff" : "#3d3d3d",
                padding: "14px 18px", cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif", fontSize: "13px",
                fontWeight: isActive ? "600" : "400",
                display: "flex", alignItems: "center", gap: "7px",
                transition: "all 0.15s", whiteSpace: "nowrap",
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = "#999"; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = "#3d3d3d"; }}
            >
              <span style={{ fontSize: "11px", opacity: 0.5 }}>{cat.icon}</span>
              {cat.label}
              {newsData[cat.id] && (
                <span style={{
                  background: isActive ? "#fff" : "#181818",
                  color: isActive ? "#0d0d0d" : "#3d3d3d",
                  borderRadius: "20px", padding: "1px 8px",
                  fontSize: "10px", fontFamily: "'DM Mono', monospace",
                }}>
                  {newsData[cat.id].length}
                </span>
              )}
            </button>
          );
        })}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", padding: "0 0 0 16px" }}>
          <span style={{ fontSize: "10px", color: "#2a2a2a", fontFamily: "'DM Mono', monospace" }}>
            {countdown ? `↻ ${countdown}` : ""}
          </span>
        </div>
      </div>

      {/* MAIN */}
      <main style={{ maxWidth: "820px", margin: "0 auto", padding: "32px" }}>
        <div style={{ marginBottom: "24px" }}>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "600", letterSpacing: "-0.4px", color: "#fff" }}>
            {activeCategory?.label}
          </h2>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#333", fontFamily: "'DM Mono', monospace" }}>
            {currentNews.length} articles · sources réelles · cliquez pour lire
          </p>
        </div>

        {loading && currentNews.length === 0 ? (
          <div style={{ padding: "20px 0" }}>
            {[0,1,2,3,4].map(i => (
              <div key={i} style={{
                height: "80px", background: "#111", borderRadius: "10px",
                marginBottom: "6px", animation: `pulse 1.4s ease-in-out ${i * 0.12}s infinite`,
              }} />
            ))}
          </div>
        ) : currentNews.length === 0 ? (
          <div style={{ padding: "80px 0", textAlign: "center", color: "#2a2a2a", fontSize: "13px", fontFamily: "'DM Mono', monospace" }}>
            Aucun article — cliquez sur Actualiser
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {currentNews.map((item, i) => {
              const isOpen = expandedId === i;
              return (
                <article key={i}
                  onClick={() => setExpandedId(isOpen ? null : i)}
                  style={{
                    background: isOpen ? "#131313" : "transparent",
                    border: "1px solid " + (isOpen ? "#222" : "transparent"),
                    borderRadius: "10px", padding: "16px 18px",
                    cursor: "pointer", transition: "all 0.18s",
                  }}
                  onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = "#0f0f0f"; }}
                  onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", color: "#2a2a2a", minWidth: "18px", paddingTop: "3px" }}>
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "7px", flexWrap: "wrap" }}>
                        <span style={{
                          fontSize: "10px", fontFamily: "'DM Mono', monospace",
                          color: "#555", background: "#161616", border: "1px solid #1e1e1e",
                          padding: "2px 8px", borderRadius: "4px",
                        }}>{item.source}</span>
                        {item.region && (
                          <span style={{
                            fontSize: "10px", fontFamily: "'DM Mono', monospace",
                            color: "#3a3a3a", background: "#111", border: "1px solid #1a1a1a",
                            padding: "2px 8px", borderRadius: "4px",
                          }}>{item.region}</span>
                        )}
                        <span style={{ fontSize: "10px", color: "#2a2a2a", fontFamily: "'DM Mono', monospace" }}>
                          {item.time}
                        </span>
                      </div>
                      <h3 style={{
                        margin: "0 0 6px", fontSize: "14px", fontWeight: "600",
                        letterSpacing: "-0.2px", lineHeight: "1.45",
                        color: isOpen ? "#fff" : "#d0d0d0", transition: "color 0.15s",
                      }}>{item.title}</h3>
                      {isOpen && (
                        <>
                          <p style={{ margin: "10px 0", fontSize: "13px", lineHeight: "1.7", color: "#777" }}>
                            {item.summary}
                          </p>
                          {item.link && (
                            <a href={item.link} target="_blank" rel="noopener noreferrer" style={{
                              fontSize: "11px", color: "#555", fontFamily: "'DM Mono', monospace",
                              textDecoration: "none", borderBottom: "1px solid #333",
                            }}>
                              Lire l'article complet →
                            </a>
                          )}
                        </>
                      )}
                      {!isOpen && (
                        <div style={{ fontSize: "11px", color: "#2e2e2e", fontFamily: "'DM Mono', monospace" }}>
                          {item.source}
                        </div>
                      )}
                    </div>
                    <div style={{
                      color: "#2a2a2a", fontSize: "12px", transition: "transform 0.2s",
                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0, paddingTop: "3px",
                    }}>▾</div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* AUTO POPUP */}
      {popup && (
        <div style={{
          position: "fixed", bottom: "24px", right: "24px", width: "320px",
          background: "#111", border: "1px solid #222", borderRadius: "14px",
          padding: "20px", zIndex: 999,
          boxShadow: "0 0 0 1px #1a1a1a, 0 20px 60px rgba(0,0,0,0.8)",
          animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        }}>
          <div style={{ position: "absolute", bottom: 0, left: "20px", right: "20px", height: "2px", background: "#1e1e1e", borderRadius: "1px", overflow: "hidden" }}>
            <div style={{ height: "100%", background: "#fff", animation: "shrink 10s linear forwards" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div style={{ fontSize: "10px", fontFamily: "'DM Mono', monospace", color: "#444" }}>
              {popup.icon} {popup.category?.toUpperCase()}
            </div>
            <button onClick={() => setPopup(null)} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", fontSize: "16px", padding: 0 }}>×</button>
          </div>
          <h4 style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: "600", lineHeight: "1.45", color: "#e0e0e0" }}>{popup.title}</h4>
          <p style={{ margin: "0 0 10px", fontSize: "12px", color: "#555", lineHeight: "1.6" }}>{popup.summary}</p>
          <div style={{ fontSize: "10px", color: "#2e2e2e", fontFamily: "'DM Mono', monospace" }}>{popup.source}</div>
        </div>
      )}

      {/* DIGEST MODAL */}
      {showDigest && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(8px)", zIndex: 500,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "24px", animation: "fadeIn 0.2s ease",
        }}
          onClick={e => { if (e.target === e.currentTarget) setShowDigest(false); }}
        >
          <div style={{
            background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: "16px",
            width: "100%", maxWidth: "560px", maxHeight: "85vh", overflow: "auto", padding: "28px",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
              <div>
                <div style={{ fontSize: "10px", fontFamily: "'DM Mono', monospace", color: "#444", marginBottom: "4px" }}>
                  ✦ RÉCAP · {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }).toUpperCase()}
                </div>
                <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "700", letterSpacing: "-0.4px", color: "#fff" }}>
                  Top 5 actualités du jour
                </h2>
              </div>
              <button onClick={() => setShowDigest(false)} style={{
                background: "#1a1a1a", border: "none", color: "#666",
                width: "32px", height: "32px", borderRadius: "8px",
                cursor: "pointer", fontSize: "16px",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>×</button>
            </div>
            {!digest || digest.length === 0 ? (
              <div style={{ padding: "40px 0", textAlign: "center", color: "#333", fontFamily: "'DM Mono', monospace", fontSize: "11px" }}>
                Actualisez d'abord pour charger les news
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {digest.map((item, i) => (
                  <div key={i} style={{
                    padding: "18px 16px", borderRadius: "10px",
                    background: "#131313", border: "1px solid #1a1a1a",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                      <span style={{
                        fontFamily: "'DM Mono', monospace", fontSize: "11px", fontWeight: "700",
                        color: "#0d0d0d", background: "#fff",
                        width: "22px", height: "22px", borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}>{i + 1}</span>
                      <span style={{
                        fontSize: "10px", fontFamily: "'DM Mono', monospace", color: "#555",
                        background: "#1a1a1a", border: "1px solid #222",
                        padding: "2px 8px", borderRadius: "4px",
                      }}>{item.source}</span>
                    </div>
                    <h3 style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: "600", color: "#e8e8e8", lineHeight: "1.4" }}>
                      {item.title}
                    </h3>
                    <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#666", lineHeight: "1.7" }}>
                      {item.summary}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap');
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 0.25; } 50% { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes shrink { from { width: 100%; } to { width: 0%; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        * { box-sizing: border-box; margin: 0; }
        body { background: #0d0d0d; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0d0d0d; }
        ::-webkit-scrollbar-thumb { background: #1e1e1e; border-radius: 2px; }
      `}</style>
    </div>
  );
}
