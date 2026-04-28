import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const FINNHUB_API_KEY = import.meta.env.VITE_FINNHUB_API_KEY;
const ALPHA_VANTAGE_API_KEY = import.meta.env.VITE_ALPHA_VANTAGE_API_KEY;

const defaultWatchlist = ["AAPL", "MSFT", "NVDA", "SPY", "TSLA"];

export default function App() {
  const [input, setInput] = useState("AAPL");
  const [ticker, setTicker] = useState("AAPL");

  const [quote, setQuote] = useState(null);
  const [news, setNews] = useState([]);
  const [chartData, setChartData] = useState([]);

  const [watchQuotes, setWatchQuotes] = useState({});
  const [positions, setPositions] = useState([]);

  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  const [watchlist, setWatchlist] = useState(() => {
    const saved = localStorage.getItem("marketpulse-watchlist");
    return saved ? JSON.parse(saved) : defaultWatchlist;
  });

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

  async function fetchChart(symbol) {
    const res = await axios.get("https://www.alphavantage.co/query", {
      params: {
        function: "TIME_SERIES_INTRADAY",
        symbol,
        interval: "5min",
        outputsize: "compact",
        apikey: ALPHA_VANTAGE_API_KEY,
      },
    });

    const series = res.data["Time Series (5min)"];
    if (!series) return [];

    return Object.entries(series)
      .map(([time, values]) => ({
        time: new Date(time).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        price: Number(values["4. close"]),
        raw: new Date(time).getTime(),
      }))
      .sort((a, b) => a.raw - b.raw)
      .slice(-60);
  }

  async function fetchWatchlistQuotes(list) {
    const results = await Promise.all(
      list.map(async (symbol) => {
        try {
          const q = await fetchQuote(symbol);
          return [symbol, q];
        } catch {
          return [symbol, null];
        }
      })
    );

    const map = {};
    results.forEach(([sym, data]) => {
      map[sym] = data;
    });

    setWatchQuotes(map);
  }

  async function load(symbol) {
    setError("");

    try {
      const [q, n, c] = await Promise.all([
        fetchQuote(symbol),
        fetchNews(),
        fetchChart(symbol),
      ]);

      setQuote(q);
      setNews(n);
      setChartData(c);

      fetchWatchlistQuotes(watchlist);
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

  const svgPoints = useMemo(() => {
    if (!chartData.length) return "";

    const pad = 20;
    const h = 260;

    const prices = chartData.map((d) => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;

    return chartData
      .map((d, i) => {
        const x = (i / (chartData.length - 1)) * (900 - pad * 2) + pad;
        const y = pad + ((max - d.price) / range) * (h - pad * 2);
        return `${x},${y}`;
      })
      .join(" ");
  }, [chartData]);

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

        {/* TOP CARDS (WITH HIGH/LOW RESTORED) */}
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

        {/* CHART + NEWS */}
        <div className="grid grid-cols-3 gap-6">

          <div className="col-span-2 bg-slate-900/60 p-6 rounded-3xl">
            <h2 className="text-xl font-bold mb-4">{ticker} Chart</h2>
            <svg viewBox="0 0 900 260" className="w-full h-64">
              <polyline fill="none" stroke="#60a5fa" strokeWidth="3" points={svgPoints} />
            </svg>
          </div>

          <div className="bg-slate-900/60 p-6 rounded-3xl">
            <h2 className="text-xl font-bold mb-4">News</h2>
            <div className="space-y-3 max-h-[500px] overflow-auto">
              {news.map((n, i) => (
                <div key={i} className="bg-slate-800 p-3 rounded-xl">
                  <p className="text-sm">{n.headline}</p>
                </div>
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