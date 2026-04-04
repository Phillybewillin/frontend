import { useEffect, useRef, useMemo, useCallback, useState } from "react";
import Artplayer from "artplayer";
import Hls from "hls.js";
import artplayerPluginHlsControl from "artplayer-plugin-hls-control";
import './Artplayer.css';
// import { useNavigate } from "react-router";
import PropTypes from "prop-types";
import { reverseLanguageMap } from "../../utils/languages";
import EpisodeOverlay from "../episodesOverlay/EpisodeOverlay";

const debounce = (func, delay) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), delay);
    };
};

const LOCAL_STORAGE_KEY = "vplayer_playback_progress";

export default function ArtPlayer({ files, subtitles, ...playerSettingsProps }) {
    const artRef = useRef(null);
    const playerInstanceRef = useRef(null);
    const hlsRef = useRef(null);

    const [currentFileIndex, setCurrentFileIndex] = useState(0);
    const [showEpisodes, setShowEpisodes] = useState(false);

    // ── Stable primitive refs ─────────────────────────────────────────────────
    // These let callbacks inside the effect always read latest values
    // without being listed as deps (which would cause re-initialization)
    const currentFileIndexRef = useRef(currentFileIndex);
    const filesRef = useRef(files);
    const sortedSubtitlesRef = useRef(null);

    const currentContentId = playerSettingsProps.id;
    const currentContentType = playerSettingsProps.season && playerSettingsProps.episode ? "series" : "movie";
    const currentSeasonNumber = playerSettingsProps.season;
    const currentEpisodeNumber = playerSettingsProps.episode;
    const currentTitle = playerSettingsProps.title;
    const currentPoster = playerSettingsProps.poster;
    const currentBackdrop = playerSettingsProps.backdrop;
    const themeColor = playerSettingsProps.theme;
    const isAutoplay = playerSettingsProps.autoplay;
    const subtitleColor = playerSettingsProps.subtitleColor;
    const subtitleFontSize = playerSettingsProps.subtitleFontSize;
    const showPosterBg = playerSettingsProps.showPoster;

    // Keep refs in sync with latest values every render — no effect needed
    currentFileIndexRef.current = currentFileIndex;
    filesRef.current = files;

    // ── Subtitles (memoized, then mirrored to ref) ────────────────────────────
    const sortedSubtitles = useMemo(() => {
        return Array.from(
            new Set((subtitles || []).filter(Boolean).map(s => s.lang))
        ).sort((a, b) => {
            return (reverseLanguageMap[a] || '').localeCompare(reverseLanguageMap[b] || '');
        }).map(lang => subtitles.find(s => s.lang === lang));
    }, [subtitles]);

    sortedSubtitlesRef.current = sortedSubtitles;

    // ── Stable refs for callbacks ─────────────────────────────────────────────
    const toggleEpisodesRef = useRef(() => {});
    useEffect(() => {
        toggleEpisodesRef.current = () => setShowEpisodes(prev => !prev);
    }, []);

    // saveProgress reads everything from refs — zero deps, never changes reference
    const saveProgressToLocalStorage = useCallback(() => {
        const player = playerInstanceRef.current;
        if (!currentContentId || !player || player.duration === 0 || player.duration === Infinity) return;

        const watched = player.currentTime;
        const duration = player.duration;
        if (watched < 5 || watched >= duration - 5) return;

        try {
            const storedProgress = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
            const progressData = {
                id: currentContentId,
                type: currentContentType,
                title: currentTitle || "Unknown Title",
                poster_path: currentPoster || "",
                backdrop_path: currentBackdrop || "",
                progress: { watched, duration },
                last_updated: Date.now(),
            };

            if (currentContentType === 'series' || currentContentType === 'anime') {
                const episodeKey = `s${currentSeasonNumber}e${currentEpisodeNumber}`;
                const existingShowProgress = storedProgress[currentContentId]?.show_progress || {};
                progressData.last_season_watched = String(currentSeasonNumber);
                progressData.last_episode_watched = String(currentEpisodeNumber);
                progressData.show_progress = {
                    ...existingShowProgress,
                    [episodeKey]: {
                        season: String(currentSeasonNumber),
                        episode: String(currentEpisodeNumber),
                        progress: { watched, duration },
                    },
                };
            }

            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
                ...storedProgress,
                [currentContentId]: progressData,
            }));
        } catch (error) {
            console.error("Error saving playback progress:", error);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentContentId, currentContentType, currentSeasonNumber, currentEpisodeNumber, currentTitle, currentPoster, currentBackdrop]);
    // ^ these only change when actual content changes (same as player re-init), so this is safe

    // Debounced version — stable as long as saveProgress is stable
    const debouncedSaveProgress = useMemo(
        () => debounce(saveProgressToLocalStorage, 5000),
        [saveProgressToLocalStorage]
    );

    const onFallbackRef = useRef(playerSettingsProps.onFallback);
    useEffect(() => {
        onFallbackRef.current = playerSettingsProps.onFallback;
    }, [playerSettingsProps.onFallback]);

    // tryNextSource reads index and files from refs — stable forever
    const tryNextSource = useCallback(() => {
        const idx = currentFileIndexRef.current;
        const currentFiles = filesRef.current;
        if (idx < currentFiles.length - 1) {
            console.warn(`Error or unsupported format. Switching to source ${idx + 2}`);
            setCurrentFileIndex(idx + 1);
        } else {
            console.error("All available sources failed.");
            if (playerInstanceRef.current) {
                playerInstanceRef.current.notice.show = "All sources failed. Switching to fallback player...";
            }
            if (onFallbackRef.current) {
                onFallbackRef.current();
            }
        }
    }, []); // ← stable forever

    const getMimeType = (fileType) => {
        switch (fileType) {
            case "hls": return "m3u8";
            case "mp4": return "mp4";
            case "webm": return "webm";
            case "ogg": return "ogg";
            default: return "m3u8";
        }
    };

    // ── Main player effect ────────────────────────────────────────────────────
    // Only re-runs when content identity actually changes
    useEffect(() => {
        if (!artRef.current) return;

        const isNewContent =
            playerInstanceRef.current && (
                playerInstanceRef.current.option.id !== currentContentId ||
                playerInstanceRef.current.option.season !== currentSeasonNumber ||
                playerInstanceRef.current.option.episode !== currentEpisodeNumber ||
                playerInstanceRef.current.option.currentFileIndex !== currentFileIndex
            );

        if (playerInstanceRef.current && !isNewContent) return;

        if (playerInstanceRef.current && isNewContent) {
            playerInstanceRef.current.destroy(false);
            playerInstanceRef.current = null;
        }

        const currentFiles = (filesRef.current || []).filter(f => f.file && typeof f.file === 'string');
        const currentSubtitles = (sortedSubtitlesRef.current || []).filter(s => s.url && typeof s.url === 'string');

        if (currentFiles.length === 0 || !currentContentId) {
            artRef.current.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100%;color:white;">No media files available.</div>';
            return;
        }

        const defaultFile = currentFiles[currentFileIndex] || currentFiles[0];
        if (!defaultFile || !defaultFile.file) {
            artRef.current.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100%;color:white;">No playable source found.</div>';
            return;
        }

        const getSubtitleSettings = () => {
            if (!currentSubtitles || currentSubtitles.length === 0) return [];

            const subtitleSelectors = currentSubtitles.map(sub => ({
                html: reverseLanguageMap[sub.lang] || sub.lang.toUpperCase(),
                url: sub.url,
                default: sub.default || false,
            }));

            subtitleSelectors.unshift({
                html: 'Display',
                tooltip: 'Show',
                switch: true,
                onSwitch: function (item) {
                    item.tooltip = item.switch ? 'Hide' : 'Show';
                    playerInstanceRef.current.subtitle.show = !item.switch;
                    return !item.switch;
                },
            });

            return [{
                width: 250,
                html: 'Subtitle',
                tooltip: subtitleSelectors.find(sub => sub.default)?.html || 'Off',
                icon: '<svg width="22px" height="22px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5.25 16C5.25 15.5858 5.58579 15.25 6 15.25H10C10.4142 15.25 10.75 15.5858 10.75 16C10.75 16.4142 10.4142 16.75 10 16.75H6C5.58579 16.75 5.25 16.4142 5.25 16Z" fill="#ffffff"/><path d="M18 12.25C18.4142 12.25 18.75 12.5858 18.75 13C18.75 13.4142 18.4142 13.75 18 13.75H14C13.5858 13.75 13.25 13.4142 13.25 13C13.25 12.5858 13.5858 12.25 14 12.25H18Z" fill="#ffffff"/><path d="M11.75 16C11.75 15.5858 12.0858 15.25 12.5 15.25H14C14.4142 15.25 14.75 15.5858 14.75 16C14.75 16.4142 14.4142 16.75 14 16.75H12.5C12.0858 16.75 11.75 16.4142 11.75 16Z" fill="#ffffff"/><path fill-rule="evenodd" clip-rule="evenodd" d="M9.94358 3.25H14.0564C15.8942 3.24998 17.3498 3.24997 18.489 3.40314C19.6614 3.56076 20.6104 3.89288 21.3588 4.64124C22.1071 5.38961 22.4392 6.33856 22.5969 7.51098C22.75 8.65018 22.75 10.1058 22.75 11.9435V12.0564C22.75 13.8942 22.75 15.3498 22.5969 16.489C22.4392 17.6614 22.1071 18.6104 21.3588 19.3588C20.6104 20.1071 19.6614 20.4392 18.489 20.5969C17.3498 20.75 15.8942 20.75 14.0565 20.75H9.94359C8.10585 20.75 6.65018 20.75 5.51098 20.5969C4.33856 20.4392 3.38961 20.1071 2.64124 19.3588C1.89288 18.6104 1.56076 17.6614 1.40314 16.489C1.24997 15.3498 1.24998 13.8942 1.25 12.0564V11.9436C1.24998 10.1058 1.24997 8.65019 1.40314 7.51098C1.56076 6.33856 1.89288 5.38961 2.64124 4.64124C3.38961 3.89288 4.33856 3.56076 5.51098 3.40314C6.65019 3.24997 8.10583 3.24998 9.94358 3.25Z" fill="#ffffff"/></svg>',
                selector: subtitleSelectors,
                onSelect: function (item) {
                    playerInstanceRef.current.subtitle.switch(item.url, { name: item.html });
                    return item.html;
                },
            }];
        };

        const getSourcesSettings = () => {
            if (!currentFiles || currentFiles.length <= 1) return [];
            return [{
                html: 'Sources',
                tooltip: `Source ${currentFileIndex + 1}`,
                icon: '<svg width="22px" height="22px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 16.5C14.4853 16.5 16.5 14.4853 16.5 12C16.5 9.51472 14.4853 7.5 12 7.5C9.51472 7.5 7.5 9.51472 7.5 12C7.5 14.4853 9.51472 16.5 12 16.5Z" stroke="#ffffff" stroke-width="1.5"/><path d="M2 12H7" stroke="#ffffff" stroke-width="1.5"/><path d="M17 12H22" stroke="#ffffff" stroke-width="1.5"/></svg>',
                selector: currentFiles.map((f, index) => ({
                    html: `Source ${index + 1}`,
                    url: f.file,
                    default: index === currentFileIndex,
                    index,
                })),
                onSelect: function (item) {
                    setCurrentFileIndex(item.index);
                    return item.html;
                },
            }];
        };

        const art = new Artplayer({
            container: artRef.current,
            url: defaultFile.file,
            type: getMimeType(defaultFile.type),
            title: currentTitle,
            volume: 0.9,
            autoplay: isAutoplay || false,
            pip: true,
            setting: true,
            playbackRate: true,
            aspectRatio: true,
            fullscreen: true,
            fullscreenWeb: false,
            subtitleOffset: true,
            miniProgressBar: true,
            playsInline: true,
            theme: themeColor ? `#${themeColor}` : '#ff4d6d',
            poster: currentPoster || undefined,
            backdrop: showPosterBg || false,
            subtitle: {
                default: true,
                url: currentSubtitles?.length > 0 ? currentSubtitles[0].url : '',
                type: 'srt',
                offset: -1.5,
                style: {
                    color: subtitleColor || '#ffffff',
                    fontSize: subtitleFontSize ? `${subtitleFontSize}px` : '20px',
                },
                encoding: 'utf-8',
            },
            id: currentContentId,
            season: currentSeasonNumber,
            episode: currentEpisodeNumber,
            currentFileIndex,
            icons: {
                fullscreenOn: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>`,
                fullscreenOff: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>`,
            },
            plugins: [
                artplayerPluginHlsControl({
                    quality: {
                        control: true,
                        setting: true,
                        getName: (level) => level.height ? `${level.height}P` : `Auto`,
                        title: "Quality",
                        auto: "Auto",
                    },
                    audio: {
                        control: true,
                        setting: true,
                        getName: (track) => track.name || "Track",
                        title: "Audio",
                        auto: "Auto",
                    },
                }),
            ],
            layers: [
                {
                    html: `
                        <div style="position:absolute;top:30px;left:30px;z-index:20;color:white;display:flex;flex-direction:column;gap:6px;text-shadow:0 2px 4px rgba(0,0,0,0.6);pointer-events:none;">
                            <div style="font-size:1.3rem;font-weight:500;line-height:1.2;letter-spacing:0.5px;">${currentTitle || ''}</div>
                            ${(currentSeasonNumber && currentEpisodeNumber) ? `<div style="font-size:.9rem;opacity:0.85;font-weight:500;">Season ${currentSeasonNumber} / Episode ${currentEpisodeNumber}</div>` : ''}
                        </div>
                    `,
                },
                {
                    html: `<div style="position:absolute;top:0;left:0;width:100%;height:150px;z-index:10;background:linear-gradient(to bottom,rgba(0,0,0,0.85) 0%,rgba(0,0,0,0.4) 50%,transparent 100%);pointer-events:none;"></div>`,
                },
                (currentSeasonNumber && currentEpisodeNumber) ? {
                    html: `
                        <button class="art-custom-episodes-btn" style="position:absolute;top:30px;right:20px;z-index:20;background:rgba(255,255,255,0.07);color:white;padding:8px 16px;border-radius:5px;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:14px;font-weight:500;transition:background 0.2s;pointer-events:auto;">
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                                <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                            </svg>
                            Episodes: ${currentEpisodeNumber} / ${playerSettingsProps.episodes?.length || '?'}
                        </button>
                    `,
                    click: function () { toggleEpisodesRef.current?.(); }
                } : null,
            ].filter(Boolean),
            customType: {
                m3u8: (video, url, artInstance) => {
                    if (Hls.isSupported()) {
                        if (hlsRef.current) {
                            hlsRef.current.destroy();
                            hlsRef.current = null;
                        }

                        const hls = new Hls({
                            xhrSetup: function (xhr) {
                                const source = filesRef.current.find(f => f.file === url);
                                if (source?.headers) {
                                    Object.entries(source.headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
                                }
                            },
                        });

                        hls.on(Hls.Events.ERROR, (event, data) => {
                            if (data.fatal) {
                                switch (data.type) {
                                    case Hls.ErrorTypes.NETWORK_ERROR:
                                        if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR || data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR) {
                                            tryNextSource();
                                        }
                                        break;
                                    case Hls.ErrorTypes.MEDIA_ERROR:
                                        hls.recoverMediaError();
                                        setTimeout(() => {
                                            if (hls.media?.paused) tryNextSource();
                                        }, 2000);
                                        break;
                                    default:
                                        tryNextSource();
                                        break;
                                }
                            }
                        });

                        hls.loadSource(url);
                        hls.attachMedia(video);
                        hlsRef.current = hls;
                        artInstance.hls = hls;

                        artInstance.on("destroy", () => {
                            hlsRef.current?.destroy();
                            hlsRef.current = null;
                        });
                    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
                        video.src = url;
                    } else {
                        artInstance.notice.show = "Unsupported format: m3u8";
                        tryNextSource();
                    }
                },
            },
            settings: [
                ...getSourcesSettings(),
                ...getSubtitleSettings(),
            ],
        });

        playerInstanceRef.current = art;

        art.on("ready", () => {
            try {
                const storedProgress = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
                const contentProgress = storedProgress[currentContentId];
                if (contentProgress) {
                    let watchedTime = 0;
                    if (currentContentType === 'movie') {
                        watchedTime = contentProgress.progress?.watched || 0;
                    } else if (currentContentType === 'series' || currentContentType === 'anime') {
                        const episodeKey = `s${currentSeasonNumber}e${currentEpisodeNumber}`;
                        watchedTime = contentProgress.show_progress?.[episodeKey]?.progress?.watched || 0;
                    }
                    if (watchedTime > 0) art.currentTime = watchedTime;
                }
            } catch (error) {
                console.error("Error loading playback progress:", error);
            }
        });

        let errorSwitchTriggered = false;
        art.on('error', (error, type) => {
            console.error('ArtPlayer error:', error, type);
            if (!errorSwitchTriggered) {
                errorSwitchTriggered = true;
                // Small delay to let rapid-fire error events settle before switching
                setTimeout(() => tryNextSource(), 500);
            }
        });

        art.on("timeupdate", () => {
            debouncedSaveProgress();
        });

        art.on("destroy", () => {
            hlsRef.current?.destroy();
            hlsRef.current = null;
            saveProgressToLocalStorage();
        });

        return () => {
            if (playerInstanceRef.current && !playerInstanceRef.current.destroyed) {
                playerInstanceRef.current.destroy(false);
                playerInstanceRef.current = null;
            }
        };
    }, [
        // ── ONLY these should rebuild the player ──────────────────────────────
        currentContentId,
        currentSeasonNumber,
        currentEpisodeNumber,
        currentFileIndex,
        // ── Stable by design (won't change unless content changes) ───────────
        currentTitle,
        currentPoster,
        currentBackdrop,
        themeColor,
        isAutoplay,
        subtitleColor,
        subtitleFontSize,
        showPosterBg,
        // ── These are now stable (zero-dep callbacks or derived from stable) ──
        tryNextSource,
        debouncedSaveProgress,
        saveProgressToLocalStorage,
    ]);

    return (
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
            <div
                ref={artRef}
                className="artplayercontainer"
                style={{ aspectRatio: "16/9" }}
            />
            {showEpisodes && (
                <EpisodeOverlay
                    contentId={currentContentId}
                    currentSeason={currentSeasonNumber}
                    currentEpisode={currentEpisodeNumber}
                    onClose={() => setShowEpisodes(false)}
                />
            )}
        </div>
    );
}

ArtPlayer.propTypes = {
    files: PropTypes.arrayOf(
        PropTypes.shape({
            file: PropTypes.string.isRequired,
            type: PropTypes.string.isRequired,
            headers: PropTypes.object,
            default: PropTypes.bool,
        })
    ).isRequired,
    subtitles: PropTypes.arrayOf(
        PropTypes.shape({
            url: PropTypes.string.isRequired,
            lang: PropTypes.string.isRequired,
            default: PropTypes.bool,
        })
    ).isRequired,
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    title: PropTypes.string,
    poster: PropTypes.string,
    backdrop: PropTypes.string,
    season: PropTypes.number,
    episode: PropTypes.number,
    playerSettingsProps: PropTypes.shape({
        theme: PropTypes.string,
        autoplay: PropTypes.bool,
        showTitle: PropTypes.bool,
        subtitleColor: PropTypes.string,
        subtitleFontSize: PropTypes.number,
        showPoster: PropTypes.bool,
    }).isRequired,
};
