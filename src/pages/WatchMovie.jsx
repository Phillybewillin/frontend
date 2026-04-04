/* eslint-disable no-unused-vars */
import PropTypes from "prop-types";
import { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { fetchTmdbDetails } from "../services/apiClient";
import useFetchStreams from "../hooks/useFetchStreams";
import VideoPlayer from "../components/vidstackplayer/VideoPlayer";
import ArtPlayer from "../components/artplayer/ArtPlayer";
import { Link } from "react-router-dom";
import "../styles/WatchMovie.css";
import { EyeOff, Loader } from "lucide-react";
import useFetchEpisodes from "../hooks/useFetchEpisodes";

// Define a key for local storage
const LOCAL_STORAGE_KEY = "vplayer_player_config";

// Build the videasy.net iframe URL
function buildIframeSrc({ id, type, season, episode, theme }) {
  const iframeBase = "https://player.videasy.net/";
  const pcolor = (theme || "#ffffffff").replace("#", "");

  let progressParam = "";
  try {
    const storedProgress = JSON.parse(localStorage.getItem("vplayer_playback_progress") || "{}");
    const contentProgress = storedProgress[id];
    if (contentProgress) {
      let watchedTime = 0;
      if (type === "movie") {
        watchedTime = contentProgress.progress?.watched || 0;
      } else if (type === "tv" || type === "series") {
        const episodeKey = `s${season}e${episode}`;
        watchedTime = contentProgress.show_progress?.[episodeKey]?.progress?.watched || 0;
      }
      if (watchedTime > 0) {
        progressParam = `&progress=${Math.floor(watchedTime)}`;
      }
    }
  } catch (err) {
    console.error("Could not parse saved progress for iframe.", err);
  }

  return season && episode
    ? `${iframeBase}tv/${id}/${season}/${episode}?color=${pcolor}${progressParam}&overlay=true`
    : `${iframeBase}movie/${id}?color=${pcolor}${progressParam}&overlay=true`;
}

const LoadingOverlay = ({ posterUrl, tmdbDetails }) => (
  <div className="loading" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 2000, background: "#000" , aspectRatio: "16/9" , overflow: "hidden" ,display: "flex", alignItems: "center", justifyContent: "center" }}>
    {posterUrl && <img className="loadingimg" src={posterUrl} alt="" />}
    <div className="loading-spinner">
      <Loader className="spinner" stroke="white" size={30} />
    </div>
    <div className="loading-title">
      {tmdbDetails ? <h1>{tmdbDetails.title || tmdbDetails.name}</h1> : <h1>Loading</h1>}
    </div>
  </div>
);

LoadingOverlay.propTypes = {
  posterUrl: PropTypes.string,
  tmdbDetails: PropTypes.object,
};

function MediaWebPlayer({ id, type, season, episode, theme, posterUrl, tmdbDetails }) {
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);
  const iframeSrc = buildIframeSrc({ id, type, season, episode, theme });
  
  return (
    <div className="fallback-iframe-container" style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden" }}>
      {!isIframeLoaded && <LoadingOverlay posterUrl={posterUrl} tmdbDetails={tmdbDetails} />}
      <iframe
        src={iframeSrc}
        onLoad={() => setIsIframeLoaded(true)}
        style={{ width: "100%", height: "100%", border: "none" }}
        allowFullScreen
        title="MediaWeb Player"
      />
    </div>
  );
}

MediaWebPlayer.propTypes = {
  id: PropTypes.string,
  type: PropTypes.string,
  season: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  episode: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  theme: PropTypes.string,
  posterUrl: PropTypes.string,
  tmdbDetails: PropTypes.object,
};

function WatchMovie() {
  const { id, season, episode } = useParams();
  const { episodes, loading, error } = useFetchEpisodes(id, season);
  const location = useLocation();

  const type = season && episode ? 'tv' : 'movie';

  const [tmdbDetails, setTmdbDetails] = useState(null);
  const [loadingTmdb, setLoadingTmdb] = useState(true);
  const [useIframeFallback, setUseIframeFallback] = useState(false);

  // Read saved params from local storage on initial render
  const savedParams = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY)) || {};

  const queryParams = new URLSearchParams(location.search);

  // Use URL params if available, otherwise fall back to saved params or default values
  const playerType = queryParams.get("player") || savedParams.player || "vidstack";
  const theme = queryParams.get("theme") || savedParams.theme || "#dc2626";
  const subtitleColor = queryParams.get("subtitleColor") || savedParams.subtitleColor || "#ffffff";
  const nextButton = queryParams.get("nextButton") === "true" || (savedParams.nextButton === true && queryParams.get("nextButton") === null) || false;
  const subtitleFontSize = queryParams.get("subtitleFontSize") || savedParams.subtitleFontSize || 16;
  const autoplay = queryParams.get("autoplay") === "true" || (savedParams.autoplay === true && queryParams.get("autoplay") === null) || false;
  const showTitleParam = queryParams.get("title") === "true" || (savedParams.showTitle === true && queryParams.get("title") === null) || false;
  const showPosterParam = queryParams.get("poster") === "true" || (savedParams.showPoster === true && queryParams.get("poster") === null) || false;

  const currentEpisode = episodes[episode - 1];
  const activeEpisodeTitle = currentEpisode ? currentEpisode.name : null;

  // If MediaWeb is selected, skip stream fetching entirely
  const isMediaWeb = playerType === "mediaweb";
  const { sources, subtitles, loading: loadingStreams, error: streamError } = useFetchStreams(
    episode
  );

  const [isCheckingSources, setIsCheckingSources] = useState(false);

  // Fast CORS Pre-check
  useEffect(() => {
    if (isMediaWeb || sources.length === 0 || loadingStreams) return;

    const checkSources = async () => {
      setIsCheckingSources(true);
      
      const checkSource = async (url) => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000); 
          const res = await fetch(url, { method: 'HEAD', mode: 'cors', signal: controller.signal });
          clearTimeout(timeout);
          return res.ok || res.status === 405; // 405 Method Not Allowed is still okay, means CORS passed
        } catch (err) {
          return false;
        }
      };

      // Check first 3 since testing everything might be overkill and takes time
      const results = await Promise.all(sources.slice(0, 3).map(s => checkSource(s.file)));
      const hasAnyWorking = results.some(r => r === true);

      if (!hasAnyWorking) {
        console.warn("Fast-check detected all tested sources are CORS-blocked. Falling back immediately.");
        setUseIframeFallback(true);
      }
      setIsCheckingSources(false);
    };

    checkSources();
  }, [sources, loadingStreams, isMediaWeb]);
  useEffect(() => {
    const newParams = {
      player: playerType,
      theme: theme,
      subtitleColor: subtitleColor,
      nextButton: nextButton,
      subtitleFontSize: subtitleFontSize,
      autoplay: autoplay,
      showTitle: showTitleParam,
      showPoster: showPosterParam,
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newParams));
  }, [playerType, theme, subtitleColor, nextButton, subtitleFontSize, autoplay, showTitleParam, showPosterParam]);

  useEffect(() => {
    const finalTheme = theme.startsWith("#") ? theme : `#${theme}`;
    document.documentElement.style.setProperty("--theme-color", finalTheme);
  }, [theme]);

  useEffect(() => {
    const getTmdbDetails = async () => {
      setLoadingTmdb(true);
      if (id) {
        try {
          if (season && episode) {
            const data = await fetchTmdbDetails(id, season, episode);
            setTmdbDetails(data);
          } else {
            const data = await fetchTmdbDetails(id);
            setTmdbDetails(data);
          }
        } catch (error) {
          setTmdbDetails(null);
        } finally {
          setLoadingTmdb(false);
        }
      } else {
        setLoadingTmdb(false);
      }
    };

    getTmdbDetails();
  }, [id, season, episode]);

  const playerTitle = showTitleParam && tmdbDetails ? tmdbDetails.title || tmdbDetails.name : "";
  const posterUrl = showPosterParam && tmdbDetails?.backdrop_path ? `https://image.tmdb.org/t/p/original${tmdbDetails.backdrop_path}` : null;

  const playerSettingsProps = {
    theme: theme,
    autoplay: autoplay,
    showTitle: showTitleParam,
    showPoster: showPosterParam,
    poster: posterUrl,
    title: playerTitle,
    id: id,
    tagline: tmdbDetails?.tagline,
    season: season,
    episode: episode,
    activeEpisodeTitle: activeEpisodeTitle,
    episodes: episodes,
    subtitleColor: subtitleColor,
    subtitleFontSize: subtitleFontSize,
    nextButton: nextButton,
    onFallback: () => setUseIframeFallback(true),
  };

  if (isMediaWeb) {
    return (
      <div className="watch-movie-container watch-movie-container-notLoading">
        <MediaWebPlayer id={id} type={type} season={season} episode={episode} theme={theme} posterUrl={posterUrl} tmdbDetails={tmdbDetails} />
      </div>
    );
  }

  const isLoading = loadingStreams || loadingTmdb || isCheckingSources;
  const hasErrors = (sources.length === 0 && !loadingStreams && !isCheckingSources) || streamError || useIframeFallback;

  return (
    <div className={`watch-movie-container ${!isLoading && sources.length > 0 ? "watch-movie-container-notLoading" : ""}`}>
      {isLoading ? (
        <LoadingOverlay posterUrl={posterUrl} tmdbDetails={tmdbDetails} />
      ) : hasErrors ? (
        <MediaWebPlayer id={id} type={type} season={season} episode={episode} theme={theme} posterUrl={posterUrl} tmdbDetails={tmdbDetails} />
      ) : (
        <>
          {playerType === "art" ? (
            <ArtPlayer files={sources} subtitles={subtitles} {...playerSettingsProps} />
          ) : (
            <VideoPlayer files={sources} subtitles={subtitles} {...playerSettingsProps} />
          )}
        </>
      )}
    </div>
  );
}

export default WatchMovie;