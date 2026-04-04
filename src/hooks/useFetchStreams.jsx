import { useState, useEffect } from "react";
import { reverseLanguageMap } from "../utils/languages";

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const WYZIE_API_KEY = import.meta.env.VITE_WYZIE_API_KEY;

const ADDONS = {
  nuvio: { base: 'https://nuviostreams.hayd.uk', name: 'NuvioStreams' },
  webstreamr: { base: 'https://webstreamr.hayd.uk', name: 'WebStreamr' },
  streamvix: { base: 'https://streamvix.hayd.uk', name: 'StreamVix' },
};

const WYZIE_BASE = 'https://sub.wyzie.io';

const idCache = new Map();

async function resolveId(tmdbId, type) {
  const cacheKey = `${type}:${tmdbId}`;
  if (idCache.has(cacheKey)) return idCache.get(cacheKey);

  if (!TMDB_API_KEY) {
    const fallback = { addonId: `tmdb:${tmdbId}`, wyzieId: tmdbId };
    idCache.set(cacheKey, fallback);
    return fallback;
  }

  const tmdbType = type === 'tv' ? 'tv' : 'movie';
  const url = `https://api.themoviedb.org/3/${tmdbType}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;

  try {
    const res = await fetch(url);
    if (res.ok) {
        const data = await res.json();
        if (data.imdb_id) {
          const result = { addonId: data.imdb_id, wyzieId: data.imdb_id };
          idCache.set(cacheKey, result);
          return result;
        }
    }
  } catch (err) {
    console.error('TMDB resolution failed:', err.message);
  }

  const fallback = { addonId: `tmdb:${tmdbId}`, wyzieId: tmdbId };
  idCache.set(cacheKey, fallback);
  return fallback;
}

const QUALITY_ORDER = { '1080p': 0, '720p': 1, '480p': 2, 'auto': 3, '4k': 4 };

function parseQuality(text) {
  if (!text) return 'auto';
  const t = text.toLowerCase();
  if (/\b2160p\b/.test(t) || /\b4k\b/.test(t)) return '4k';
  if (/\b1080p\b/.test(t)) return '1080p';
  if (/\b720p\b/.test(t)) return '720p';
  if (/\b480p\b/.test(t)) return '480p';
  return 'auto';
}

function inferStreamType(url) {
  if (!url) return 'mp4';
  if (url.includes('.m3u8')) return 'hls';
  // Treat all other streams (MKV, direct links without extensions, etc.) as mp4 for native browser playback
  return 'mp4';
}

async function fetchAddonStreams(addonKey, addonId, type, season, episode) {
  const addon = ADDONS[addonKey];
  const idPart = type === 'tv' ? `${addonId}:${season}:${episode}` : addonId;
  const contentType = type === 'tv' ? 'series' : 'movie';

  async function tryBase(base) {
    const url = `${base}/stream/${contentType}/${idPart}.json`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.streams || !Array.isArray(data.streams)) return [];
      return data.streams;
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  let rawStreams;
  try {
    rawStreams = await tryBase(addon.base);
  } catch {
    return null; 
  }

  return rawStreams.map((s) => {
    const qualityText = `${s.name || ''} ${s.title || ''}`;
    return {
      url: s.url,
      type: inferStreamType(s.url),
      label: `${addon.name} • ${s.title || s.name || 'Unknown'}`,
      quality: parseQuality(qualityText),
      addon: addonKey,
    };
  });
}

async function fetchSubtitles(wyzieId, type, season, episode) {
  if (!WYZIE_API_KEY) return [];

  let url = `${WYZIE_BASE}/search?id=${encodeURIComponent(wyzieId)}&key=${WYZIE_API_KEY}`;
  if (type === 'tv') url += `&season=${season}&episode=${episode}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return [];

    const raw = await res.json();
    const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.results) ? raw.results : []);

    const WEB_FORMATS = new Set(['srt', 'vtt']);
    const compatible = list.filter((sub) => WEB_FORMATS.has((sub.format || '').toLowerCase()));

    const seen = new Set();
    const unique = [];

    for (const sub of compatible) {
      if (!sub.url || typeof sub.url !== 'string') continue;
      const lang = (sub.language || sub.lang || '').toLowerCase();
      if (!lang || seen.has(lang)) continue;
      seen.add(lang);
      
      const mappedDisplay = reverseLanguageMap[lang] || sub.display || sub.language || sub.lang || '';
      
      unique.push({
        url: sub.url,
        lang: lang,
        display: mappedDisplay,
        format: sub.format || 'srt',
        isHI: !!(sub.isHearingImpaired || sub.isHI),
      });
    }

    unique.sort((a, b) => {
      const aEn = a.lang.toLowerCase().startsWith('en') ? 0 : 1;
      const bEn = b.lang.toLowerCase().startsWith('en') ? 0 : 1;
      if (aEn !== bEn) return aEn - bEn;
      return (a.display || '').localeCompare(b.display || '');
    });

    return unique.slice(0, 20);
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

function isBigFile(label) {
  const match = label.match(/(\d+(?:\.\d+)?)\s*GB/i);
  if (!match) return false;
  return parseFloat(match[1]) >= 5;
}

const ADDON_ORDER = {
  nuvio: 0,
  webstreamr: 1,
  streamvix: 2,
};

function sortSources(sources) {
  return sources.sort((a, b) => {
    const aBig = isBigFile(a.label) ? 1 : 0;
    const bBig = isBigFile(b.label) ? 1 : 0;
    if (aBig !== bBig) return aBig - bBig;

    const qa = QUALITY_ORDER[a.quality] ?? 3;
    const qb = QUALITY_ORDER[b.quality] ?? 3;
    if (qa !== qb) return qa - qb;

    return (ADDON_ORDER[a.addon] ?? 5) - (ADDON_ORDER[b.addon] ?? 5);
  });
}

const useFetchStreams = (tmdbId, type, season, episode) => {
  const [sources, setSources] = useState([]);
  const [subtitles, setSubtitles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!tmdbId || !type) return;
    if (type === 'tv' && (!season || !episode)) return;

    const pullData = async () => {
      setLoading(true);
      setError(null);

      try {
        const { addonId, wyzieId } = await resolveId(tmdbId, type);

        const [
          nuvioR, webstreamrR, streamvixR,
          subtitlesR,
        ] = await Promise.allSettled([
          fetchAddonStreams('nuvio', addonId, type, season, episode),
          fetchAddonStreams('webstreamr', addonId, type, season, episode),
          fetchAddonStreams('streamvix', addonId, type, season, episode),
          fetchSubtitles(wyzieId, type, season, episode),
        ]);

        const streams = (r) => (r.status === 'fulfilled' && Array.isArray(r.value) ? r.value : []);

        const allSources = sortSources([
          ...streams(nuvioR),
          ...streams(webstreamrR),
          ...streams(streamvixR),
        ]).filter(s => s.url && typeof s.url === 'string');

        const fetchedSubs = subtitlesR.status === 'fulfilled' ? subtitlesR.value : [];

        if (allSources.length === 0) {
           throw new Error("No streams available from any addon.");
        }

        const formattedSources = allSources.map((s, idx) => ({
            file: s.url,
            type: s.type,
            default: idx === 0,
            label: s.label,
            quality: s.quality,
            addon: s.addon,
        }));

        const formattedSubtitles = fetchedSubs.map((sub, idx) => ({
            url: sub.url,
            lang: sub.lang,
            display: sub.display,
            default: idx === 0,
            format: sub.format,
            isHI: sub.isHI
        }));

        setSources(formattedSources);
        setSubtitles(formattedSubtitles);

      } catch (err) {
        setError(err.message || "An error occurred");
        setSources([]);
        setSubtitles([]);
      } finally {
        setLoading(false);
      }
    };

    pullData();
  }, [tmdbId, type, season, episode]);

  return { sources, subtitles, loading, error };
};

export default useFetchStreams;
