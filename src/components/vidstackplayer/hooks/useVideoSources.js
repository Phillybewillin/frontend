import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { reverseLanguageMap } from "../../../utils/languages";

function getMimeType(fileType) {
  switch (fileType) {
    case "hls": return "application/x-mpegurl";
    case "mp4": return "video/mp4";
    case "webm": return "video/webm";
    case "ogg": return "video/ogg";
    case "embed": return "video/mp4";
    default: return "application/x-mpegurl";
  }
}

export const useVideoSources = (files, subtitles) => {
  const [currentSourceIndex, setCurrentSourceIndex] = useState(0);
  const [hasFailedAllSources, setHasFailedAllSources] = useState(false);

  const safeFiles = useMemo(() => Array.isArray(files) ? files : [], [files]);

  // Keep refs in sync so stable callbacks can read latest values
  const currentSourceIndexRef = useRef(currentSourceIndex);
  useEffect(() => {
    currentSourceIndexRef.current = currentSourceIndex;
  }, [currentSourceIndex]);

  const sortedSubtitles = useMemo(() => {
    if (!subtitles || !Array.isArray(subtitles)) return [];
    
    return Array.from(
      new Set(
        subtitles
          .filter(subtitle => 
            subtitle && 
            subtitle.lang && 
            subtitle.url && 
            typeof subtitle.lang === 'string'
          )
          .map(subtitle => subtitle.lang)
      )
    )
    .sort((a, b) => {
      const langA = reverseLanguageMap[a] || '';
      const langB = reverseLanguageMap[b] || '';
      return langA.localeCompare(langB);
    })
    .map(lang => {
      const subtitle = subtitles.find(sub => sub.lang === lang);
      return {
        ...subtitle,
        lang: subtitle.lang || 'en',
        label: reverseLanguageMap[subtitle.lang] || subtitle.lang,
        type: subtitle.type || 'subtitles'
      };
    });
  }, [subtitles]);

  const videoSources = useMemo(() => {
    return safeFiles.map((file, index) => ({
      src: file.file,
      type: getMimeType(file.type),
      label: file.lang ? `${reverseLanguageMap[file.lang]} (${file.type})` : `Source ${index + 1} (${file.type})`,
      value: index.toString(),
    }));
  }, [safeFiles]);

  const videoSourcesRef = useRef(videoSources);
  useEffect(() => {
    videoSourcesRef.current = videoSources;
  }, [videoSources]);

  const currentSource = useMemo(() => {
    const source = videoSources[currentSourceIndex];
    if (!source) return null;
    return { src: source.src, type: source.type };
  }, [videoSources, currentSourceIndex]);

  // STABLE callback — reads from refs, never changes identity
  const handleMediaError = useCallback(() => {
    const idx = currentSourceIndexRef.current;
    const sources = videoSourcesRef.current;
    if (idx < sources.length - 1) {
      console.warn(`Source ${idx + 1} failed. Switching to source ${idx + 2}...`);
      setCurrentSourceIndex(idx + 1);
    } else {
      console.error("All video sources failed.");
      setHasFailedAllSources(true);
    }
  }, []);

  const handleDropdownSelect = useCallback((value) => {
    const selectedIndex = parseInt(value, 10);
    setCurrentSourceIndex(selectedIndex);
    setHasFailedAllSources(false);
  }, []);

  return {
    currentSourceIndex,
    hasFailedAllSources,
    sortedSubtitles,
    videoSources,
    currentSource,
    handleMediaError,
    handleDropdownSelect,
    setCurrentSourceIndex,
    setHasFailedAllSources
  };
};