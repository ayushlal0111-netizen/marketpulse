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
  const [error, setError] = useState("");
  const [chartMessage, setChartMessage] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [watchlist, setWatchlist] = useState(() => {
    const saved = localStorage.getItem("marketpulse-watchlist");
    return saved ? JSON.parse(saved) : defaultWatchlist;
  });

  useEffect(() => {
    localStorage.setItem("marketpulse-watchlist", JSON.stringify(watchlist));
  }, [watchlist]);

  async function fetchQuote(symbol) {
    const res = await axios.get("https://finnhub.io/api/v1/quote", {
      params: {
        symbol,
        token: FINNHUB_API_KEY,
      },
    });
    return res.data;
  }

  async function fetchNews() {
    const res = await axios.get("https://finnhub.io/api/v1/news", {
      params: {
        category: "general",
        token: FINNHUB_API_KEY,
      },
    });
    return Array.isArray(res.data) ? res.data.slice(0, 6) : [];
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

    const data = res.data;
    const series = data["Time Series (5min)"];

    if (!series) {
      if (data.Note) {
        throw new Error("Alpha Vantage rate limit hit. Wait a minute and try again.");
      }
      if (data["Error Message"]) {
        throw new Error("Chart ticker not supported.");
      }
      if (data.Information) {
        throw new Error(data.Information);
      }
      throw new Error("Chart data unavailable.");
    }

    return Object.entries(series)
      .map(([time, values]) => ({
        time: new Date(time).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        }),
        price: Number(values["4. close"]),
        rawTime: new Date(time).getTime(),
      }))
      .sort((a, b) => a.rawTime - b.rawTime)
      .slice(-60);
  }

  async function loadData(symbol) {
    setError("");
    setChartMessage("");
    setIsLoading(true);

    if (!FINNHUB_API_KEY) {
      setError("Missing Finnhub API key in .env");
      setIsLoading(false);
      return;
    }

    try {
      const quoteData = await fetchQuote(symbol);
      setQuote(quoteData);
    } catch (err) {
      console.error("QUOTE ERROR:", err);
      setError("Could not load live stock data.");
      setQuote(null);
    }

    try {
      const newsData = await fetchNews();
      setNews(newsData);
    } catch (err) {
      console.error("NEWS ERROR:", err);
      setNews([]);
    }

    if (ALPHA_VANTAGE_API_KEY) {
      try {
        const chartResult = await fetchChart(symbol);
        setChartData(chartResult);
      } catch (err) {
        console.error("CHART ERROR:", err);
        setChartData([]);
        setChartMessage(err.message || "Chart data unavailable.");
      }
    } else {
      setChartData([]);
      setChartMessage("Missing Alpha Vantage API key in .env");
    }

    setLastUpdated(
      new Date().toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      })
    );
    setIsLoading(false);
  }

  function handleSearch() {
    if (!input.trim()) return;
    setTicker(input.trim().toUpperCase());
  }

  function handleWatchlistClick(symbol) {
    setInput(symbol);
    setTicker(symbol);
  }

  function handleAddToWatchlist() {
    const symbol = input.trim().toUpperCase();
    if (!symbol) return;
    if (!watchlist.includes(symbol)) {
      setWatchlist((prev) => [...prev, symbol]);
    }
  }

  function handleRemoveFromWatchlist(symbolToRemove) {
    setWatchlist((prev) => prev.filter((symbol) => symbol !== symbolToRemove));
    if (ticker === symbolToRemove && watchlist.length > 1) {
      const next = watchlist.find((symbol) => symbol !== symbolToRemove);
      if (next) {
        setTicker(next);
        setInput(next);
      }
    }
  }

  useEffect(() => {
    loadData(ticker);
  }, [ticker]);

  const marketStatus = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    const open = 9 * 60 + 30;
    const close = 16 * 60;

    if (day === 0 || day === 6) return "Market Closed";
    if (totalMinutes >= open && totalMinutes < close) return "Market Open";
    return "Market Closed";
  }, []);

  const dailyChangeColor =
    quote && typeof quote.dp === "number"
      ? quote.dp >= 0
        ? "text-emerald-400"
        : "text-red-400"
      : "text-white";

  const chartStroke =
    quote && typeof quote.dp === "number"
      ? quote.dp >= 0
        ? "#34d399"
        : "#f87171"
      : "#60a5fa";

  const dailyChangeSymbol =
    quote && typeof quote.dp === "number" ? (quote.dp >= 0 ? "+" : "") : "";

  const svgPoints = useMemo(() => {
    if (!chartData.length) return "";

    const width = 800;
    const height = 300;
    const padding = 20;

    const prices = chartData.map((point) => point.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    const xStep =
      chartData.length > 1
        ? (width - padding * 2) / (chartData.length - 1)
        : 0;

    return chartData
      .map((point, index) => {
        const x = padding + index * xStep;
        const y =
          maxPrice === minPrice
            ? height / 2
            : padding +
              ((maxPrice - point.price) / (maxPrice - minPrice)) *
                (height - padding * 2);

        return `${x},${y}`;
      })
      .join(" ");
  }, [chartData]);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-[28px] border border-slate-800 bg-slate-900/95 p-8 shadow-2xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-4xl font-bold tracking-tight">MarketPulse</h1>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    marketStatus === "Market Open"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-slate-700 text-slate-300"
                  }`}
                >
                  {marketStatus}
                </span>
                {lastUpdated && (
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                    Updated {lastUpdated}
                  </span>
                )}
              </div>

              <p className="mt-3 max-w-2xl text-slate-400">
                A clean market dashboard for tracking stock prices, charts,
                and major headlines all in one place.
              </p>
            </div>

            <div className="flex w-full max-w-2xl gap-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value.toUpperCase())}
                placeholder="Enter ticker like AAPL"
                className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              />
              <button
                onClick={handleSearch}
                className="rounded-2xl bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500"
              >
                Search
              </button>
              <button
                onClick={handleAddToWatchlist}
                className="rounded-2xl bg-slate-700 px-5 py-3 font-semibold hover:bg-slate-600"
              >
                Add
              </button>
              <button
                onClick={() => loadData(ticker)}
                className="rounded-2xl bg-slate-700 px-5 py-3 font-semibold hover:bg-slate-600"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
                <p className="text-sm text-slate-400">Selected Ticker</p>
                <div className="mt-3 flex items-end justify-between">
                  <p className="text-4xl font-bold">{ticker}</p>
                  <p className={`text-lg font-semibold ${dailyChangeColor}`}>
                    {quote && typeof quote.dp === "number"
                      ? `${dailyChangeSymbol}${quote.dp.toFixed(2)}%`
                      : "--"}
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
                <p className="text-sm text-slate-400">Current Price</p>
                <p className="mt-3 text-4xl font-bold">
                  {quote && typeof quote.c === "number"
                    ? `$${quote.c.toFixed(2)}`
                    : "--"}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
                <p className="text-sm text-slate-400">High</p>
                <p className="mt-3 text-2xl font-bold">
                  {quote && typeof quote.h === "number"
                    ? `$${quote.h.toFixed(2)}`
                    : "--"}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
                <p className="text-sm text-slate-400">Low</p>
                <p className="mt-3 text-2xl font-bold">
                  {quote && typeof quote.l === "number"
                    ? `$${quote.l.toFixed(2)}`
                    : "--"}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
                <p className="text-sm text-slate-400">Previous Close</p>
                <p className="mt-3 text-2xl font-bold">
                  {quote && typeof quote.pc === "number"
                    ? `$${quote.pc.toFixed(2)}`
                    : "--"}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
                <p className="text-sm text-slate-400">Daily Change</p>
                <p className={`mt-3 text-2xl font-bold ${dailyChangeColor}`}>
                  {quote && typeof quote.dp === "number"
                    ? `${dailyChangeSymbol}${quote.dp.toFixed(2)}%`
                    : "--"}
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
              <h2 className="text-2xl font-bold">{ticker} Intraday Chart</h2>
              <p className="mt-2 text-sm text-slate-400">
                Powered by Alpha Vantage intraday data.
              </p>

              <div className="mt-5 rounded-2xl bg-slate-800 p-4">
                {chartData.length > 0 ? (
                  <svg viewBox="0 0 800 300" className="h-80 w-full" preserveAspectRatio="none">
                    <polyline
                      fill="none"
                      stroke={chartStroke}
                      strokeWidth="4"
                      points={svgPoints}
                    />
                  </svg>
                ) : (
                  <p className="text-slate-400">
                    {chartMessage || "No chart data available."}
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Watchlist</h2>
                <p className="text-sm text-slate-400">Saved on this browser</p>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                {watchlist.map((symbol) => (
                  <div
                    key={symbol}
                    className={`flex items-center gap-2 rounded-2xl px-3 py-2 ${
                      ticker === symbol
                        ? "bg-blue-600 text-white"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    <button
                      onClick={() => handleWatchlistClick(symbol)}
                      className="text-sm font-semibold"
                    >
                      {symbol}
                    </button>
                    <button
                      onClick={() => handleRemoveFromWatchlist(symbol)}
                      className="text-xs opacity-80 hover:opacity-100"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <h2 className="text-2xl font-bold">Market News</h2>
            <p className="mt-2 text-sm text-slate-400">
              Top general headlines affecting the market right now.
            </p>

            <div className="mt-5 space-y-4">
              {isLoading && (
                <div className="rounded-2xl bg-slate-800 p-4 text-slate-400">
                  Loading...
                </div>
              )}

              {news.map((item, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-slate-700 bg-slate-800 p-4"
                >
                  <p className="font-semibold text-white">{item.headline}</p>
                  <p className="mt-1 text-sm text-slate-400">{item.source}</p>
                  <p className="mt-2 text-sm text-slate-300">{item.summary}</p>

                  <div className="mt-3">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
                    >
                      Open Article
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}