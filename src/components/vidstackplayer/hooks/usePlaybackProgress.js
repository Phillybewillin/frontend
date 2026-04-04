import { useCallback, useEffect, useMemo } from "react";
import { debounce } from "../utils/debounce";

const LOCAL_STORAGE_KEY = "vplayer_playback_progress";

export const usePlaybackProgress = (playerRef, contentId, contentType, seasonNumber, episodeNumber, playerSettings, currentSourceIndex) => {
  const saveProgressToLocalStorage = useCallback(() => {
    if (!contentId || !playerRef.current || !playerRef.current.duration || playerRef.current.duration === Infinity) {
      return;
    }
    
    const watched = playerRef.current.currentTime;
    const duration = playerRef.current.duration;

    if (watched < 5 || watched >= duration - 5) {
      return;
    }
    
    try {
      const storedProgress = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
      const progressData = {
        id: contentId,
        type: contentType,
        title: playerSettings.title || "Unknown Title",
        poster_path: playerSettings.poster || "",
        backdrop_path: playerSettings.backdrop || "",
        progress: {
          watched: watched,
          duration: duration,
        },
        last_updated: Date.now(),
      };
      
      if (contentType === 'series' || contentType === 'anime') {
        const episodeKey = `s${seasonNumber}e${episodeNumber}`;
        const existingShowProgress = storedProgress[contentId]?.show_progress || {};
        progressData.last_season_watched = String(seasonNumber);
        progressData.last_episode_watched = String(episodeNumber);
        progressData.show_progress = {
          ...existingShowProgress,
          [episodeKey]: {
            season: String(seasonNumber),
            episode: String(episodeNumber),
            progress: {
              watched: watched,
              duration: duration,
            },
          },
        };
      }
      
      const updatedProgress = {
        ...storedProgress,
        [contentId]: progressData,
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedProgress));
    } catch (error) {
      console.error("Error saving playback progress to local storage:", error);
    }
  }, [contentId, playerRef, contentType, playerSettings.title, playerSettings.poster, playerSettings.backdrop, seasonNumber, episodeNumber]);

  const debouncedSaveProgress = useMemo(() => debounce(saveProgressToLocalStorage, 5000), [saveProgressToLocalStorage]);

  useEffect(() => {
    const player = playerRef.current;
    if (!contentId) return;
    
    const loadProgress = () => {
      try {
        const storedProgress = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
        const contentProgress = storedProgress[contentId];
        if (contentProgress && playerRef.current) {
          let watchedTime = 0;
          if (contentType === 'movie') {
            watchedTime = contentProgress.progress?.watched || 0;
          } else if (contentType === 'series' || contentType === 'anime') {
            const episodeKey = `s${seasonNumber}e${episodeNumber}`;
            watchedTime = contentProgress.show_progress?.[episodeKey]?.progress?.watched || 0;
          }
          if (watchedTime > 0) {
            playerRef.current.currentTime = watchedTime;
          }
        }
      } catch (error) {
        console.error("Error loading playback progress from local storage:", error);
      }
    };

    const onPlayerReady = () => {
      loadProgress();
      playerRef.current.removeEventListener('can-play', onPlayerReady);
    };

    if (playerRef.current) {
      playerRef.current.addEventListener('can-play', onPlayerReady);
    }

    return () => {
      if (player) {
        player.removeEventListener('can-play', onPlayerReady);
      }
    };
  }, [contentId, contentType, seasonNumber, episodeNumber, playerRef, currentSourceIndex]);

  useEffect(() => {
    const player = playerRef.current;
    if (player && contentId) {
      player.addEventListener('time-update', debouncedSaveProgress);
      return () => {
        player.removeEventListener('time-update', debouncedSaveProgress);
        saveProgressToLocalStorage();
      };
    }
  }, [contentId, debouncedSaveProgress, playerRef, saveProgressToLocalStorage, currentSourceIndex]);

  return { debouncedSaveProgress };
};