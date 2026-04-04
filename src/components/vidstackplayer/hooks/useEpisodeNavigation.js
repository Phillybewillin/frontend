import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

export const useEpisodeNavigation = (playerRef, episodes, contentId, seasonNumber, episodeNumber, currentSourceIndex) => {
  const navigate = useNavigate();
  const currentEpisodeNumber = parseInt(episodeNumber, 10);
  const totalEpisodes = episodes?.length;
  const [showNextEpisodeButton, setShowNextEpisodeButton] = useState(false);

  const handleNextEp = useCallback(() => {
    if (totalEpisodes && currentEpisodeNumber < totalEpisodes) {
      const nextEpisodeNumber = currentEpisodeNumber + 1;
      navigate(`/tv/${contentId}/${seasonNumber}/${nextEpisodeNumber}`);
    }
  }, [contentId, seasonNumber, currentEpisodeNumber, totalEpisodes, navigate]);

  const handlePrevEp = useCallback(() => {
    if (totalEpisodes && currentEpisodeNumber > 1) {
      const prevEpisodeNumber = currentEpisodeNumber - 1;
      navigate(`/tv/${contentId}/${seasonNumber}/${prevEpisodeNumber}`);
    }
  }, [contentId, seasonNumber, currentEpisodeNumber, totalEpisodes, navigate]);

  useEffect(() => {
    if (currentEpisodeNumber < totalEpisodes) {
      const totalEpisodeRuntime = playerRef.current?.duration;
      const currentTime = playerRef.current?.currentTime;

      if (totalEpisodeRuntime && currentTime >= (totalEpisodeRuntime * 0.75)) {
        setShowNextEpisodeButton(true);
      } else {
        setShowNextEpisodeButton(false);
      }
    }
  }, [currentEpisodeNumber, totalEpisodes, playerRef, currentSourceIndex]);

  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.shiftKey) {
        if (event.key === 'N' || event.key === 'n') {
          event.preventDefault();
          handleNextEp();
        } else if (event.key === 'P' || event.key === 'p') {
          event.preventDefault();
          handlePrevEp();
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleNextEp, handlePrevEp]);

  return {
    showNextEpisodeButton,
    handleNextEp,
    handlePrevEp,
    currentEpisodeNumber,
    totalEpisodes
  };
};