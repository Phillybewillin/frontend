import { useState, useEffect, useRef, useCallback } from "react";
import PropTypes from "prop-types";
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";
import { MediaPlayer, MediaProvider, Track, Poster, Captions } from "@vidstack/react";
import { defaultLayoutIcons, DefaultVideoLayout } from "@vidstack/react/player/layouts/default";
import { reverseLanguageMap } from "../../utils/languages";
import "./Videoplayer.css";
import QualitySubmenu from "./qualitysubmenu/QualitySubmenu";
import SourceSubmenu from "./sourcessubmenu/SourcesSubmenu";
import {
  PlayIcon,
  PauseIcon,
  Volume1Icon,
  Volume2Icon,
  VolumeXIcon,
  MaximizeIcon,
  MinimizeIcon,
  SubtitlesIcon,
  AirplayIcon,
  CastIcon,
  PictureInPictureIcon,
  SettingsIcon,
  PictureInPicture2,
  CaptionsOffIcon,
  ListEnd,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import EpisodeOverlay from "../episodesOverlay/EpisodeOverlay";
import { usePlaybackProgress } from "./hooks/usePlaybackProgress";
import { useEpisodeNavigation } from "./hooks/useEpisodeNavigation";
import { useVideoSources } from "./hooks/useVideoSources";

const customIcons = {
  PlayButton: {
    Play: () => <PlayIcon className="vds-icon" />,
    Pause: () => <PauseIcon className="vds-icon" />,
    Replay: () => <PlayIcon className="vds-icon" />,
  },
  MuteButton: {
    Mute: () => <VolumeXIcon className="vds-icon" />,
    VolumeLow: () => <Volume1Icon className="vds-icon" />,
    VolumeHigh: () => <Volume2Icon className="vds-icon" />,
  },
  FullscreenButton: {
    Enter: () => <MaximizeIcon className="vds-icon" />,
    Exit: () => <MinimizeIcon className="vds-icon" />,
  },
  CaptionButton: {
    On: () => <SubtitlesIcon className="vds-icon" />,
    Off: () => <CaptionsOffIcon className="vds-icon" />,
  },
  AirPlayButton: {
    Default: () => <AirplayIcon className="vds-icon" />,
  },
  GoogleCastButton: {
    Default: () => <CastIcon className="vds-icon" />,
  },
  PIPButton: {
    Enter: () => <PictureInPicture2 className="vds-icon" />,
    Exit: () => <PictureInPictureIcon className="vds-icon" />,
  },
  Menu: {
    ...defaultLayoutIcons.Menu,
    Settings: () => <SettingsIcon className="vds-icon" />,
    Captions: () => <SubtitlesIcon className="vds-icon" />,
  },
};

function VideoPlayer({ files, subtitles, ...playerSettingsProps }) {
  const playerRef = useRef(null);
  const contentId = playerSettingsProps.id;
  const contentType =
    playerSettingsProps.season && playerSettingsProps.episode ? "series" : "movie";
  const seasonNumber = playerSettingsProps.season;
  const episodeNumber = playerSettingsProps.episode;
  const episodes = playerSettingsProps.episodes;

  const [areControlsVisible, setAreControlsVisible] = useState(true);
  const [showEpisodes, setShowEpisodes] = useState(false);

  // FIX: Keep a ref for the controls-hide debounce timer
  const controlsTimerRef = useRef(null);

  const {
    currentSourceIndex,
    hasFailedAllSources,
    sortedSubtitles,
    videoSources,
    currentSource,
    handleMediaError,
    handleDropdownSelect,
    setCurrentSourceIndex,
    setHasFailedAllSources,
  } = useVideoSources(files, subtitles);

  usePlaybackProgress(
    playerRef,
    contentId,
    contentType,
    seasonNumber,
    episodeNumber,
    playerSettingsProps,
    currentSourceIndex
  );

  const {
    showNextEpisodeButton,
    handleNextEp,
    handlePrevEp,
    currentEpisodeNumber,
    totalEpisodes,
  } = useEpisodeNavigation(
    playerRef,
    episodes,
    contentId,
    seasonNumber,
    episodeNumber,
    currentSourceIndex
  );

  const handleSeek = (seconds) => {
    if (playerRef.current) {
      const newTime = playerRef.current.currentTime + seconds;
      playerRef.current.currentTime = Math.max(0, newTime);
    }
  };

  // FIX 2: Debounce the controls-hide so they don't vanish immediately on mount.
  // Vidstack fires onControlsChange(false) almost instantly when the player is
  // idle, which was causing the title/gradient overlays to disappear right away.
  const handleControlsChange = useCallback((isVisible) => {
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    if (isVisible) {
      // Show immediately
      setAreControlsVisible(true);
    } else {
      // Hide with a small delay to prevent the mount-time flicker
      controlsTimerRef.current = setTimeout(() => {
        setAreControlsVisible(false);
      }, 150);
    }
  }, []);

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, []);

  const onFallbackRef = useRef(playerSettingsProps.onFallback);
  useEffect(() => {
    onFallbackRef.current = playerSettingsProps.onFallback;
  }, [playerSettingsProps.onFallback]);

  useEffect(() => {
    if (hasFailedAllSources && onFallbackRef.current) {
      onFallbackRef.current();
    }
  }, [hasFailedAllSources]);

  // FIX 1: The ref was never updated after first render because the assignment
  // was commented out. This means the timeout was always calling a stale closure
  // that thought currentSourceIndex was 0, so source cycling was broken.
  const handleMediaErrorRef = useRef(handleMediaError);
  useEffect(() => {
    handleMediaErrorRef.current = handleMediaError;
  }, [handleMediaError]);

  const loadTimeoutRef = useRef(null);
  const isPlayingRef = useRef(false);

  const startLoadTimeout = useCallback(() => {
    if (hasFailedAllSources) return;
    isPlayingRef.current = false;
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);

    loadTimeoutRef.current = setTimeout(() => {
      if (!isPlayingRef.current) {
        console.warn(
          `Source ${currentSourceIndex + 1} timed out after 8s. Switching...`
        );
        handleMediaErrorRef.current();
      }
    }, 8000);
  }, [currentSourceIndex, hasFailedAllSources]);

  const clearLoadTimeout = useCallback(() => {
    isPlayingRef.current = true;
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    startLoadTimeout();
    return () => {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    };
  }, [currentSourceIndex, startLoadTimeout]);

  const toggleEpisodes = () => {
    setShowEpisodes((prev) => !prev);
  };

  useEffect(() => {
    setCurrentSourceIndex(0);
    setHasFailedAllSources(false);
  }, [files, contentId, setCurrentSourceIndex, setHasFailedAllSources]);

  useEffect(() => {
    const handleKeyPress = (event) => {
      if (!playerRef.current) return;

      switch (event.key.toLowerCase()) {
        case " ":
        case "k":
          event.preventDefault();
          playerRef.current.paused
            ? playerRef.current.play()
            : playerRef.current.pause();
          break;
        case "j":
          event.preventDefault();
          handleSeek(-10);
          break;
        case "l":
          event.preventDefault();
          handleSeek(10);
          break;
        case "f":
          event.preventDefault();
          playerRef.current.enterFullscreen?.();
          break;
        case "t":
          event.preventDefault();
          break;
        case "m":
          event.preventDefault();
          playerRef.current.muted = !playerRef.current.muted;
          break;
        case "arrowup":
          event.preventDefault();
          if (playerRef.current.volume < 1) {
            playerRef.current.volume = Math.min(
              1,
              playerRef.current.volume + 0.1
            );
          }
          break;
        case "arrowdown":
          event.preventDefault();
          if (playerRef.current.volume > 0) {
            playerRef.current.volume = Math.max(
              0,
              playerRef.current.volume - 0.1
            );
          }
          break;
        case "arrowleft":
          event.preventDefault();
          handleSeek(-5);
          break;
        case "arrowright":
          event.preventDefault();
          handleSeek(5);
          break;
        case ",":
          event.preventDefault();
          if (playerRef.current.playbackRate > 0.25) {
            playerRef.current.playbackRate -= 0.25;
          }
          break;
        case ".":
          event.preventDefault();
          if (playerRef.current.playbackRate < 2) {
            playerRef.current.playbackRate += 0.25;
          }
          break;
        case "0":
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9": {
          event.preventDefault();
          const percentage = parseInt(event.key) / 10;
          if (playerRef.current.duration) {
            playerRef.current.currentTime =
              playerRef.current.duration * percentage;
          }
          break;
        }
        default:
          break;
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => {
      document.removeEventListener("keydown", handleKeyPress);
    };
  }, []);

  const tooltips = {
    play: "Play/Pause (K/Space)",
    mute: "Toggle Mute (M)",
    fullscreen: "Toggle Fullscreen (F)",
    captions: "Toggle Captions",
    airplay: "AirPlay",
    cast: "Google Cast",
    pip: "Picture in Picture",
    settings: "Settings",
    seekBack: "Seek Backward 10s (J)",
    seekForward: "Seek Forward 10s (L)",
    prevEpisode: "Previous Episode (⇧+P)",
    nextEpisode: "Next Episode (⇧+N)",
    episodes: "Episodes List",
  };

  return (
    <div className="video-container">
      <div className="video-player-wrapper">
        {videoSources.length > 0 && !hasFailedAllSources ? (
          <>
            {/*
              FIX 3: Removed key={currentSourceIndex}.
              Using the index as a key was unmounting/remounting the entire
              player on every source failure, causing a blank flash and resetting
              all playback tracking state. Vidstack handles src prop changes
              gracefully — no remount needed.
            */}
            <MediaPlayer
              ref={playerRef}
              poster={playerSettingsProps.poster || undefined}
              src={currentSource}
              playsInline
              autoPlay={playerSettingsProps.autoplay || false}
              onPlay={clearLoadTimeout}
              onPlaying={clearLoadTimeout}
              onError={handleMediaError}
              onControlsChange={handleControlsChange}
              className="video-player"
            >
              {/*
                FIX 4: Moved Track and Captions inside MediaProvider.
                In vidstack, Track and Captions MUST be children of MediaProvider
                to register with the player. Placing them outside as siblings
                meant subtitles were never loaded and captions never rendered.
              */}
              <MediaProvider>
                {playerSettingsProps.poster && (
                  <Poster
                    className="vds-poster"
                    src={playerSettingsProps.poster}
                    alt={
                      playerSettingsProps.showTitle
                        ? playerSettingsProps.title || ""
                        : ""
                    }
                  />
                )}

                {/* ✅ Captions now inside MediaProvider */}
                <Captions className="vds-captions" />

                {/* ✅ Tracks now inside MediaProvider */}
                {sortedSubtitles.map((subtitle, index) => (
                  <Track
                    key={`${subtitle.lang}-${index}`}
                    kind="subtitles"
                    src={subtitle.url}
                    type={subtitle.type}
                    srcLang={subtitle.lang}
                    label={reverseLanguageMap[subtitle.lang] || subtitle.lang}
                    default={index === 0}
                  />
                ))}
              </MediaProvider>

              {showEpisodes && (
                <EpisodeOverlay
                  contentId={contentId}
                  currentSeason={seasonNumber}
                  currentEpisode={episodeNumber}
                  onClose={toggleEpisodes}
                />
              )}

              {areControlsVisible &&
                (seasonNumber && episodeNumber ? (
                  <div className="vds-custom-title">
                    <p>{playerSettingsProps.title || ""}</p>
                    <h1>
                      S{seasonNumber}:E{episodeNumber} -{" "}
                      <p>&quot;</p>
                      {playerSettingsProps.activeEpisodeTitle || ""}{" "}
                      <p>&quot;</p>
                    </h1>
                  </div>
                ) : (
                  <div className="vds-custom-title">
                    <p>Watching - {playerSettingsProps.tagline}</p>
                    <h1>{playerSettingsProps.title || ""}</h1>
                  </div>
                ))}

              {showNextEpisodeButton && (
                <div className="vds-next-ep-button">
                  <button
                    className="next-ep-button"
                    onClick={handleNextEp}
                    title={tooltips.nextEpisode}
                  >
                    <p>Next Episode (⇧+N)</p>
                  </button>
                </div>
              )}

              {areControlsVisible && (
                <div className="gradientholder">
                  <div className="topgradient"></div>
                  <div className="bottomgradient"></div>
                </div>
              )}

              <DefaultVideoLayout
                icons={customIcons}
                slots={{
                  largeLayout: {
                    beforePlayButton: (
                      <button
                        className="vds-button"
                        onClick={() => handleSeek(-10)}
                        title={tooltips.seekBack}
                      >
                        <p>10</p>
                      </button>
                    ),
                    afterPlayButton: (
                      <button
                        className="vds-button"
                        onClick={() => handleSeek(10)}
                        title={tooltips.seekForward}
                      >
                        <p>10</p>
                      </button>
                    ),
                    beforeTopControlsGroupEnd: seasonNumber ? (
                      <div className="season-selector">
                        {episodes && currentEpisodeNumber > 1 && (
                          <button
                            className="vds-button"
                            onClick={handlePrevEp}
                            title={tooltips.prevEpisode}
                          >
                            {currentEpisodeNumber - 1}{" "}
                            <ChevronLeft className="vds-icon" />
                          </button>
                        )}

                        <button
                          className="custom-vds-button"
                          onClick={toggleEpisodes}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            padding: "0rem 1rem",
                          }}
                          title={tooltips.episodes}
                        >
                          <div className="divider">|</div>
                          <p style={{ fontSize: "0.8rem" }}>
                            Episodes ({currentEpisodeNumber}/{totalEpisodes})
                          </p>
                          <div className="divider">|</div>
                        </button>

                        {episodes && currentEpisodeNumber < totalEpisodes && (
                          <button
                            className="vds-button"
                            onClick={handleNextEp}
                            title={tooltips.nextEpisode}
                          >
                            <ChevronRight className="vds-icon" />{" "}
                            {currentEpisodeNumber + 1}
                          </button>
                        )}
                      </div>
                    ) : null,
                  },
                  smallLayout: {
                    beforeTopControlsGroupStart: seasonNumber ? (
                      <button
                        className="custom-vds-button"
                        onClick={toggleEpisodes}
                        title={tooltips.episodes}
                      >
                        <ListEnd className="vds-icon" />
                      </button>
                    ) : null,
                  },
                  afterCaptionButton: <div className="divider">|</div>,
                  beforeMuteButton: <div className="divider">|</div>,
                  afterVolumeSlider: <div className="divider">|</div>,
                  beforeSettingsMenu: <QualitySubmenu />,
                  beforeGoogleCastButton: <div className="divider">|</div>,
                  afterSettingsMenu: (
                    <SourceSubmenu
                      sources={videoSources}
                      selectedValue={currentSourceIndex}
                      onSelect={handleDropdownSelect}
                    />
                  ),
                }}
              />
            </MediaPlayer>
          </>
        ) : (
          <div className="no-video-message">
            <h3 className="no-video-text">
              {hasFailedAllSources
                ? "All video sources failed to load."
                : "No video file available"}
            </h3>
          </div>
        )}
      </div>
    </div>
  );
}

VideoPlayer.propTypes = {
  files: PropTypes.arrayOf(
    PropTypes.shape({
      file: PropTypes.string.isRequired,
      type: PropTypes.string.isRequired,
      lang: PropTypes.string,
    })
  ).isRequired,
  subtitles: PropTypes.arrayOf(
    PropTypes.shape({
      url: PropTypes.string.isRequired,
      lang: PropTypes.string.isRequired,
      type: PropTypes.string,
    })
  ).isRequired,
  id: PropTypes.string.isRequired,
  season: PropTypes.number,
  episode: PropTypes.number,
  episodes: PropTypes.array,
  autoplay: PropTypes.bool,
  showTitle: PropTypes.bool,
  poster: PropTypes.string,
  title: PropTypes.string,
  backdrop: PropTypes.string,
  tagline: PropTypes.string,
  activeEpisodeTitle: PropTypes.string,
};

export default VideoPlayer;