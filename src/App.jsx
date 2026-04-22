import { useState, useEffect, useCallback, useRef } from "react";

/* ── Google Fonts ── */
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap";
document.head.appendChild(fontLink);

const CATEGORIES = [
  {
    id: "finance",
    label: "Finance & Marchés",
    short: "Finance",
    icon: "↗",
    prompt: `Génère 10 actualités financières et de marchés récentes et réalistes couvrant le monde entier (Europe: CAC 40, DAX, FTSE; Amériques: S&P 500, Dow Jones, Nasdaq, Wall Street, Fed; Asie: Nikkei, Hang Seng, Shanghai; crypto, matières premières, pétrole, or). Varie les régions géographiques. Pour chaque news: titre percutant, résumé factuel de 2-3 lignes, source crédible (Bloomberg, Reuters, Financial Times, Les Échos, WSJ, Nikkei Asia, CNBC), tag parmi [Marchés, Actions, Crypto, Banques, Matières premières, Obligataire, Devises], région parmi [Europe, Amériques, Asie, Global], time comme 'Il y a 18 min'. Réponds UNIQUEMENT en JSON: {"news": [{"title":"","summary":"","source":"","tag":"","region":"","time":""}]}`,
  },
  {
    id: "economie",
    label: "Économie",
    short: "Économie",
    icon: "◈",
    prompt: `Génère 10 actualités économiques mondiales réalistes (inflation, emploi, PIB, banques centrales Fed/BCE/BoJ/BoE, commerce mondial, récession, croissance, FMI, Banque Mondiale). Couvre Europe, Amériques, Asie, pays émergents. Pour chaque news: titre percutant, résumé factuel 2-3 lignes, source crédible (Reuters, AFP, Les Échos, Le Monde Éco, FT, Economist, Bloomberg Eco), tag parmi [Inflation, Emploi, Croissance, Banques centrales, Commerce, Budget, Industrie], région parmi [Europe, Amériques, Asie, Global, Émergents], time comme 'Il y a 34 min'. Réponds UNIQUEMENT en JSON: {"news": [{"title":"","summary":"","source":"","tag":"","region":"","time":""}]}`,
  },
  {
    id: "politique",
    label: "Politique",
    short: "Politique",
    icon: "⬡",
    prompt: `Génère 10 actualités politiques mondiales réalistes (France, Europe, USA, Russie, Chine, Moyen-Orient, Afrique, Amérique latine, élections, diplomatie, géopolitique, conflits, traités). Couvre plusieurs continents. Pour chaque news: titre percutant, résumé factuel 2-3 lignes, source crédible (Le Monde, Le Figaro, Politico, NYT, Guardian, Al Jazeera, AFP, France 24), tag parmi [France, Europe, USA, Géopolitique, Élections, Diplomatie, Conflits], région parmi [France, Europe, Amériques, Asie, Afrique, Moyen-Orient], time comme 'Il y a 1h12'. Réponds UNIQUEMENT en JSON: {"news": [{"title":"","summary":"","source":"","tag":"","region":"","time":""}]}`,
  },
  {
    id: "social",
    label: "Social & Culturel",
    short: "Social",
    icon: "◎",
    prompt: `Génère 10 actualités sociales et culturelles françaises et internationales réalistes (société, culture, art, musique, cinéma, éducation, santé publique, mouvements sociaux, sport, sciences). Pour chaque news: titre percutant, résumé factuel 2-3 lignes, source crédible (Le Monde, Télérama, L'Obs, France Culture, Mediapart, The Guardian Culture, Le Figaro Culture), tag parmi [Société, Culture, Éducation, Santé, Environnement, Sciences, Sport, Médias], time comme 'Il y a 2h05'. Réponds UNIQUEMENT en JSON: {"news": [{"title":"","summary":"","source":"","tag":"","time":""}]}`,
  },
];

const REFRESH_INTERVAL = 2.5 * 60 * 60 * 1000;
const DIGEST_HOUR = 18; // 18h00

async function fetchNews(category) {
  const res = await fetch("/api/news", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: "Tu es un agrégateur de news mondial. Réponds UNIQUEMENT avec du JSON valide, sans markdown, sans backticks.",
      messages: [{ role: "user", content: category.prompt }],
    }),
  });
  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  return JSON.parse(text.replace(/```json|```/g, "").trim()).news || [];
}

async function fetchDailyDigest() {
  const res = await fetch("/api/news", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: "Tu es un éditorialiste. Réponds UNIQUEMENT avec du JSON valide, sans markdown, sans backticks.",
      messages: [{ role: "user", content: `Génère les 5 actualités les plus importantes de ce jour. Pour chaque news: titre fort, résumé complet de 3-4 lignes, source crédible, catégorie parmi [Finance, Économie, Politique, Social & Culturel]. Réponds UNIQUEMENT en JSON: {"digest": [{"title":"","summary":"","source":"","category":""}]}` }],
    }),
  });
  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  return JSON.parse(text.replace(/```json|```/g, "").trim()).digest || [];
}

const REGION_COLORS = {
  Europe: "#e8e8e8", Amériques: "#c8c8c8", Asie: "#b0b0b0",
  Global: "#f0f0f0", Émergents: "#a8a8a8", France: "#efefef",
  Afrique: "#989898", "Moyen-Orient": "#888888",
};

export default function NewsApp() {
  const [activeTab, setActiveTab] = useState("finance");
  const [newsData, setNewsData] = useState({});
  const [loading, setLoading] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [popup, setPopup] = useState(null);
  const [digest, setDigest] = useState(null);
  const [showDigest, setShowDigest] = useState(false);
  const [digestLoading, setDigestLoading] = useState(false);
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
      try {
        const news = await fetchNews(cat);
        results[cat.id] = news;
        setNewsData(prev => ({ ...prev, [cat.id]: news }));
      } catch { results[cat.id] = []; }
    }
    setLoading(false);
    setSpinning(false);

    if (withPopup) {
      const all = [];
      for (const cat of CATEGORIES) {
        const items = results[cat.id] || [];
        if (items[0]) all.push({ ...items[0], category: cat.label, icon: cat.icon });
      }
      if (all.length) {
        const pick = all[Math.floor(Math.random() * all.length)];
        setPopup(pick);
        setTimeout(() => setPopup(null), 10000);
      }
    }
  }, []);

  // Check if it's digest time (18h)
  const checkDigestTime = useCallback(async () => {
    const now = new Date();
    if (now.getHours() === DIGEST_HOUR && !digestShownToday.current) {
      digestShownToday.current = true;
      setDigestLoading(true);
      try {
        const d = await fetchDailyDigest();
        setDigest(d);
        setShowDigest(true);
      } catch {}
      setDigestLoading(false);
    }
    // Reset at midnight
    if (now.getHours() === 0) digestShownToday.current = false;
  }, []);

  useEffect(() => { loadAll(false); }, []);
  useEffect(() => {
    const auto = setInterval(() => loadAll(true), REFRESH_INTERVAL);
    return () => clearInterval(auto);
  }, [loadAll]);

  useEffect(() => {
    const digestCheck = setInterval(checkDigestTime, 60000);
    checkDigestTime();
    return () => clearInterval(digestCheck);
  }, [checkDigestTime]);

  // Countdown
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

  const CAT_COLORS = { Finance: "#e8f4e8", Économie: "#e8e8f4", Politique: "#f4e8e8", Social: "#f4f4e8" };

  return (
    <div style={{ minHeight: "100vh", background: "#0d0d0d", color: "#ededed", fontFamily: "'DM Sans', sans-serif", position: "relative", overflowX: "hidden" }}>

      {/* ── HEADER ── */}
      <header style={{
        padding: "0 32px",
        height: "64px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid #1a1a1a",
        position: "sticky",
        top: 0,
        background: "rgba(13,13,13,0.95)",
        backdropFilter: "blur(12px)",
        zIndex: 200,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{
            width: "32px", height: "32px",
            background: "#fff",
            borderRadius: "6px",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "14px", fontWeight: "700", color: "#0d0d0d",
          }}>R</div>
          <div>
            <div style={{ fontSize: "15px", fontWeight: "600", letterSpacing: "-0.3px", color: "#fff" }}>La Revue</div>
            <div style={{ fontSize: "10px", color: "#444", letterSpacing: "0.5px", fontFamily: "'DM Mono', monospace" }}>
              {lastRefresh ? `Mis à jour ${lastRefresh.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : "Chargement..."}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Digest button */}
          <button
            onClick={async () => {
              if (!digest) {
                setDigestLoading(true);
                try { const d = await fetchDailyDigest(); setDigest(d); } catch {}
                setDigestLoading(false);
              }
              setShowDigest(true);
            }}
            style={{
              background: "transparent",
              border: "1px solid #222",
              color: "#666",
              padding: "7px 14px",
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "12px",
              fontWeight: "500",
              letterSpacing: "0.2px",
              borderRadius: "8px",
              display: "flex", alignItems: "center", gap: "6px",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#444"; e.currentTarget.style.color = "#ccc"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#222"; e.currentTarget.style.color = "#666"; }}
          >
            ✦ Top 5 du jour
          </button>

          {/* Refresh */}
          <button
            onClick={() => !loading && loadAll(false)}
            disabled={loading}
            style={{
              background: loading ? "transparent" : "#fff",
              border: "1px solid " + (loading ? "#222" : "#fff"),
              color: loading ? "#333" : "#0d0d0d",
              padding: "7px 16px",
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "12px",
              fontWeight: "600",
              borderRadius: "8px",
              display: "flex", alignItems: "center", gap: "7px",
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

      {/* ── TABS ── */}
      <div style={{
        display: "flex",
        padding: "0 32px",
        borderBottom: "1px solid #161616",
        background: "#0a0a0a",
        gap: "4px",
        overflowX: "auto",
      }}>
        {CATEGORIES.map(cat => {
          const isActive = activeTab === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => { setActiveTab(cat.id); setExpandedId(null); }}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: isActive ? "2px solid #fff" : "2px solid transparent",
                color: isActive ? "#fff" : "#3d3d3d",
                padding: "14px 18px",
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "13px",
                fontWeight: isActive ? "600" : "400",
                letterSpacing: isActive ? "-0.2px" : "0",
                display: "flex", alignItems: "center", gap: "7px",
                transition: "all 0.15s",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = "#999"; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = "#3d3d3d"; }}
            >
              <span style={{ fontSize: "11px", opacity: 0.6 }}>{cat.icon}</span>
              {cat.label}
              {newsData[cat.id] && (
                <span style={{
                  background: isActive ? "#fff" : "#181818",
                  color: isActive ? "#0d0d0d" : "#3d3d3d",
                  borderRadius: "20px",
                  padding: "1px 8px",
                  fontSize: "10px",
                  fontFamily: "'DM Mono', monospace",
                  fontWeight: "500",
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

      {/* ── CONTENT ── */}
      <main style={{ maxWidth: "820px", margin: "0 auto", padding: "32px 32px" }}>
        {/* Section header */}
        <div style={{ marginBottom: "24px", display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "600", letterSpacing: "-0.4px", color: "#fff" }}>
              {activeCategory?.label}
            </h2>
            <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#333", fontFamily: "'DM Mono', monospace" }}>
              {currentNews.length} articles · cliquez pour lire
            </p>
          </div>
          {activeCategory?.id !== "social" && (
            <div style={{ fontSize: "11px", color: "#2a2a2a", fontFamily: "'DM Mono', monospace", textAlign: "right" }}>
              Couverture mondiale
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && currentNews.length === 0 ? (
          <div style={{ padding: "80px 0", textAlign: "center" }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{
                height: "72px", background: "#111", borderRadius: "10px",
                marginBottom: "8px", animation: `pulse 1.4s ease-in-out ${i * 0.15}s infinite`,
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
                <article
                  key={i}
                  onClick={() => setExpandedId(isOpen ? null : i)}
                  style={{
                    background: isOpen ? "#131313" : "transparent",
                    border: "1px solid " + (isOpen ? "#222" : "transparent"),
                    borderRadius: "10px",
                    padding: "16px 18px",
                    cursor: "pointer",
                    transition: "all 0.18s",
                  }}
                  onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = "#0f0f0f"; }}
                  onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                    {/* Index */}
                    <div style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: "10px",
                      color: "#2a2a2a",
                      minWidth: "18px",
                      paddingTop: "3px",
                      fontWeight: "500",
                    }}>
                      {String(i + 1).padStart(2, "0")}
                    </div>

                    <div style={{ flex: 1 }}>
                      {/* Meta row */}
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "7px", flexWrap: "wrap" }}>
                        <span style={{
                          fontSize: "10px",
                          fontFamily: "'DM Mono', monospace",
                          fontWeight: "500",
                          color: "#555",
                          background: "#161616",
                          border: "1px solid #1e1e1e",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          letterSpacing: "0.3px",
                        }}>
                          {item.tag}
                        </span>
                        {item.region && (
                          <span style={{
                            fontSize: "10px",
                            fontFamily: "'DM Mono', monospace",
                            color: "#3a3a3a",
                            background: "#111",
                            border: "1px solid #1a1a1a",
                            padding: "2px 8px",
                            borderRadius: "4px",
                          }}>
                            {item.region}
                          </span>
                        )}
                        <span style={{ fontSize: "10px", color: "#2a2a2a", fontFamily: "'DM Mono', monospace" }}>
                          {item.time}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 style={{
                        margin: "0 0 6px",
                        fontSize: "14px",
                        fontWeight: "600",
                        letterSpacing: "-0.2px",
                        lineHeight: "1.45",
                        color: isOpen ? "#fff" : "#d0d0d0",
                        transition: "color 0.15s",
                      }}>
                        {item.title}
                      </h3>

                      {/* Summary */}
                      {isOpen && (
                        <p style={{
                          margin: "10px 0 10px",
                          fontSize: "13px",
                          lineHeight: "1.7",
                          color: "#777",
                          fontWeight: "400",
                        }}>
                          {item.summary}
                        </p>
                      )}

                      {/* Source */}
                      <div style={{ fontSize: "11px", color: "#2e2e2e", fontFamily: "'DM Mono', monospace" }}>
                        {item.source}
                      </div>
                    </div>

                    {/* Chevron */}
                    <div style={{
                      color: "#2a2a2a",
                      fontSize: "12px",
                      transition: "transform 0.2s",
                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                      flexShrink: 0,
                      paddingTop: "3px",
                    }}>▾</div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* ── AUTO POPUP ── */}
      {popup && (
        <div style={{
          position: "fixed", bottom: "24px", right: "24px",
          width: "320px", background: "#111",
          border: "1px solid #222",
          borderRadius: "14px",
          padding: "20px",
          zIndex: 999,
          boxShadow: "0 0 0 1px #1a1a1a, 0 20px 60px rgba(0,0,0,0.8)",
          animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        }}>
          <div style={{ position: "absolute", bottom: 0, left: "20px", right: "20px", height: "2px", background: "#1e1e1e", borderRadius: "1px", overflow: "hidden" }}>
            <div style={{ height: "100%", background: "#fff", animation: "shrink 10s linear forwards" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div style={{ fontSize: "10px", fontFamily: "'DM Mono', monospace", color: "#444", letterSpacing: "0.5px" }}>
              {popup.icon} {popup.category.toUpperCase()}
            </div>
            <button onClick={() => setPopup(null)} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", fontSize: "16px", padding: 0, lineHeight: 1 }}>×</button>
          </div>
          <h4 style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: "600", lineHeight: "1.45", color: "#e0e0e0", letterSpacing: "-0.1px" }}>{popup.title}</h4>
          <p style={{ margin: "0 0 10px", fontSize: "12px", color: "#555", lineHeight: "1.6" }}>{popup.summary}</p>
          <div style={{ fontSize: "10px", color: "#2e2e2e", fontFamily: "'DM Mono', monospace" }}>{popup.source}</div>
        </div>
      )}

      {/* ── DAILY DIGEST MODAL ── */}
      {showDigest && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(8px)",
          zIndex: 500,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "24px",
          animation: "fadeIn 0.2s ease",
        }}
          onClick={e => { if (e.target === e.currentTarget) setShowDigest(false); }}
        >
          <div style={{
            background: "#0f0f0f",
            border: "1px solid #1e1e1e",
            borderRadius: "16px",
            width: "100%",
            maxWidth: "560px",
            maxHeight: "85vh",
            overflow: "auto",
            padding: "28px",
          }}>
            {/* Modal header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
              <div>
                <div style={{ fontSize: "11px", fontFamily: "'DM Mono', monospace", color: "#444", marginBottom: "4px", letterSpacing: "0.5px" }}>
                  ✦ RÉCAP DU JOUR · {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }).toUpperCase()}
                </div>
                <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "700", letterSpacing: "-0.4px", color: "#fff" }}>
                  Top 5 actualités
                </h2>
              </div>
              <button onClick={() => setShowDigest(false)} style={{
                background: "#1a1a1a", border: "none", color: "#666",
                width: "32px", height: "32px", borderRadius: "8px",
                cursor: "pointer", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center",
              }}>×</button>
            </div>

            {digestLoading || !digest ? (
              <div style={{ padding: "40px 0", textAlign: "center" }}>
                <div style={{ fontSize: "11px", color: "#333", fontFamily: "'DM Mono', monospace", animation: "pulse 1.4s infinite" }}>
                  Sélection des actualités du jour...
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                {digest.map((item, i) => (
                  <div key={i} style={{
                    padding: "18px 16px",
                    borderRadius: "10px",
                    background: "#131313",
                    border: "1px solid #1a1a1a",
                    marginBottom: "6px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                      <span style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: "11px",
                        fontWeight: "700",
                        color: "#0d0d0d",
                        background: "#fff",
                        width: "22px", height: "22px",
                        borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}>{i + 1}</span>
                      <span style={{
                        fontSize: "10px",
                        fontFamily: "'DM Mono', monospace",
                        color: "#555",
                        background: "#1a1a1a",
                        border: "1px solid #222",
                        padding: "2px 8px",
                        borderRadius: "4px",
                      }}>{item.category}</span>
                    </div>
                    <h3 style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: "600", color: "#e8e8e8", letterSpacing: "-0.2px", lineHeight: "1.4" }}>
                      {item.title}
                    </h3>
                    <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#666", lineHeight: "1.7" }}>
                      {item.summary}
                    </p>
                    <div style={{ fontSize: "10px", color: "#2a2a2a", fontFamily: "'DM Mono', monospace" }}>
                      {item.source}
                    </div>
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
