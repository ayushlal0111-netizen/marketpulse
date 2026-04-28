import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const FINNHUB_API_KEY = import.meta.env.VITE_FINNHUB_API_KEY;

const defaultWatchlist = ["AAPL", "MSFT", "NVDA", "SPY", "TSLA"];

export default function App() {
  const [input, setInput] = useState("AAPL");
  const [ticker, setTicker] = useState("AAPL");

  const [quote, setQuote] = useState(null);
  const [news, setNews] = useState([]);

  const [watchlist, setWatchlist] = useState(() => {
    const saved = localStorage.getItem("marketpulse-watchlist");
    return saved ? JSON.parse(saved) : defaultWatchlist;
  });

  const [positions, setPositions] = useState([]);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  useEffect(() => {
    localStorage.setItem("marketpulse-watchlist", JSON.stringify(watchlist));
  }, [watchlist]);

  async function fetchQuote(symbol) {
    const res = await axios.get("https://finnhub.io/api/v1/quote", {
      params: { symbol, token: FINNHUB_API_KEY },
    });
    return res.data;
  }

  async function fetchNews() {
    const res = await axios.get("https://finnhub.io/api/v1/news", {
      params: { category: "general", token: FINNHUB_API_KEY },
    });
    return Array.isArray(res.data) ? res.data : [];
  }

  async function load(symbol) {
    setError("");

    try {
      const [q, n] = await Promise.all([fetchQuote(symbol), fetchNews()]);

      setQuote(q);
      setNews(n);
    } catch (e) {
      setError("Failed to load data");
    }

    setLastUpdated(
      new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    );
  }

  useEffect(() => {
    load(ticker);
  }, [ticker]);

  function handleSearch() {
    setTicker(input.trim().toUpperCase());
  }

  function handleWatch(symbol) {
    setInput(symbol);
    setTicker(symbol);
  }

  function addWatch() {
    const s = input.trim().toUpperCase();
    if (!watchlist.includes(s)) {
      setWatchlist((p) => [...p, s]);
    }
  }

  function buyStock() {
    if (!quote?.c) return;

    setPositions((prev) => [
      ...prev,
      {
        symbol: ticker,
        entry: quote.c,
        qty: 1,
      },
    ]);
  }

  const changeColor =
    quote?.dp >= 0 ? "text-emerald-400" : "text-red-400";

  const portfolioPnL = useMemo(() => {
    return positions.reduce((sum, p) => {
      const current = quote?.c || p.entry;
      return sum + (current - p.entry) * p.qty;
    }, 0);
  }, [positions, quote]);

  const portfolioValue = useMemo(() => {
    return positions.reduce((sum, p) => {
      const current = quote?.c || p.entry;
      return sum + current * p.qty;
    }, 0);
  }, [positions, quote]);

  return (
    <div className="min-h-screen text-white px-6 py-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">

      <div className="max-w-7xl mx-auto space-y-6">

        {/* HEADER */}
        <div className="rounded-3xl bg-slate-900/60 p-6 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold">MarketPulse</h1>
            <p className="text-slate-400 text-sm">Live market dashboard</p>
          </div>

          <div className="flex gap-3">
            <input
              className="bg-slate-800 px-4 py-2 rounded-xl"
              value={input}
              onChange={(e) => setInput(e.target.value.toUpperCase())}
            />
            <button onClick={handleSearch} className="bg-blue-600 px-4 py-2 rounded-xl">
              Search
            </button>
            <button onClick={addWatch} className="bg-slate-700 px-4 py-2 rounded-xl">
              Add
            </button>
          </div>
        </div>

        {/* TOP CARDS */}
        <div className="grid grid-cols-5 gap-4">

          <div className="bg-slate-900/60 p-5 rounded-2xl">
            <p className="text-slate-400 text-sm">Ticker</p>
            <p className="text-3xl font-bold">{ticker}</p>
          </div>

          <div className="bg-slate-900/60 p-5 rounded-2xl">
            <p className="text-slate-400 text-sm">Price</p>
            <p className="text-3xl font-bold">${quote?.c?.toFixed(2)}</p>
          </div>

          <div className="bg-slate-900/60 p-5 rounded-2xl">
            <p className="text-slate-400 text-sm">Change</p>
            <p className={`text-2xl font-bold ${changeColor}`}>
              {quote?.dp?.toFixed(2)}%
            </p>
          </div>

          <div className="bg-slate-900/60 p-5 rounded-2xl">
            <p className="text-slate-400 text-sm">High</p>
            <p className="text-2xl font-bold text-emerald-400">
              ${quote?.h?.toFixed(2)}
            </p>
          </div>

          <div className="bg-slate-900/60 p-5 rounded-2xl">
            <p className="text-slate-400 text-sm">Low</p>
            <p className="text-2xl font-bold text-red-400">
              ${quote?.l?.toFixed(2)}
            </p>
          </div>

        </div>

        {/* GRID */}
        <div className="grid grid-cols-2 gap-6">

          {/* MARKET OVERVIEW */}
          <div className="bg-slate-900/60 p-6 rounded-3xl">
            <h2 className="text-xl font-bold mb-4">Market Overview</h2>

            <div className="space-y-2 text-slate-300">
              <p>• Live dashboard mode active</p>
              <p>• Tracking {ticker}</p>
              <p>• Watchlist size: {watchlist.length}</p>
              <p>• Last update: {lastUpdated}</p>
            </div>
          </div>

          {/* NEWS (UPGRADED) */}
          <div className="bg-slate-900/60 p-6 rounded-3xl">
            <h2 className="text-xl font-bold mb-4">Market News</h2>

            <div className="space-y-4 max-h-[520px] overflow-auto pr-2">
              {news.map((n, i) => (
                <a
                  key={i}
                  href={n.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block bg-slate-800/60 hover:bg-slate-800 transition rounded-2xl p-4 border border-slate-700/40 hover:border-slate-600"
                >
                  <div className="flex gap-3">

                    {n.image && (
                      <img
                        src={n.image}
                        alt=""
                        className="w-20 h-20 object-cover rounded-xl flex-shrink-0"
                      />
                    )}

                    <div className="flex-1 space-y-2">

                      <p className="font-semibold text-white leading-snug line-clamp-2">
                        {n.headline}
                      </p>

                      {n.summary && (
                        <p className="text-sm text-slate-400 line-clamp-2">
                          {n.summary}
                        </p>
                      )}

                      <div className="flex justify-between text-xs text-slate-500 pt-1">
                        <span>{n.source}</span>

                        {n.datetime && (
                          <span>
                            {new Date(n.datetime * 1000).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>

                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>

        </div>

        {/* WATCHLIST */}
        <div className="bg-slate-900/60 p-6 rounded-3xl">
          <h2 className="text-xl font-bold mb-3">Watchlist</h2>

          <div className="flex gap-3 flex-wrap">
            {watchlist.map((s) => (
              <button
                key={s}
                onClick={() => handleWatch(s)}
                className="bg-slate-800 px-4 py-2 rounded-xl"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* TRADE SIMULATOR */}
        <div className="bg-slate-900/60 p-6 rounded-3xl">

          <div className="flex justify-between mb-4">
            <h2 className="text-xl font-bold">Trade Simulator</h2>

            <button
              onClick={() => setPositions([])}
              className="bg-red-500/20 text-red-300 px-4 py-2 rounded-xl"
            >
              Clear
            </button>
          </div>

          <button
            onClick={buyStock}
            className="bg-emerald-600 px-4 py-2 rounded-xl mb-4"
          >
            Buy 1 {ticker}
          </button>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-slate-800 p-3 rounded-xl">
              Positions: {positions.length}
            </div>

            <div className="bg-slate-800 p-3 rounded-xl">
              Value: ${portfolioValue.toFixed(2)}
            </div>

            <div className={`bg-slate-800 p-3 rounded-xl ${portfolioPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              P/L: ${portfolioPnL.toFixed(2)}
            </div>
          </div>

          <div className="space-y-2 max-h-[200px] overflow-auto">
            {positions.map((p, i) => {
              const current = quote?.c || p.entry;
              const pnl = current - p.entry;
              const pct = ((pnl / p.entry) * 100).toFixed(2);

              return (
                <div key={i} className="flex justify-between bg-slate-800 p-3 rounded-xl">
                  <span>{p.symbol}</span>
                  <span className={pnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                    {pnl.toFixed(2)} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>

        </div>

      </div>
    </div>
  );
}