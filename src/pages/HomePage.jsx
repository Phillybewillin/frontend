/* eslint-disable react/no-unknown-property */
import { useState, useEffect, useRef } from "react";
import "../styles/HomePage.css";
import { Tv, ChevronDown, PaintRoller, TvIcon, Play, ALargeSmall, Image, Monitor, Palette, Clapperboard } from "lucide-react"; // Import Lucide icons
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "../components/DropdownComponents/DropdownMenu";
import { ToggleGroup, ToggleGroupItem } from "../components/togglegroup/ToggleGroup";
import TrendingCarousel from "../components/TrendingCarousel/TrendingCarousel";

// Constants for default content
const DEFAULT_MOVIE_ID = "299534";
const DEFAULT_SHOW_ID = "201834";
const DEFAULT_ANIME_ID = "12234";
const DEFAULT_SHOW_SEASON = 1; // S1
const DEFAULT_SHOW_EPISODE = 1; // E1
const DEFAULT_ANIME_EPISODE = 1; // E1
const DEFAULT_ANIME_DUB = true;

function HomePage() {
  const [testMovieId, setTestMovieId] = useState("");
  const [testShowId, setTestShowId] = useState("");
  const [testSeasonNum, setTestSeasonNum] = useState("");
  const [testEpisodeNum, setTestEpisodeNum] = useState("");
  const [testAnimeDub, setTestAnimeDub] = useState(false);
  const [testPlayerType, setTestPlayerType] = useState("vidstack");
  const [testTheme, setTestTheme] = useState("ff4d6d"); // Default to pink-red without '#'
  const [testAutoplay, setTestAutoplay] = useState(false);
  const [testShowTitle, setTestShowTitle] = useState(true);
  const [testShowPoster, setTestShowPoster] = useState(true);
  const [contentType, setContentType] = useState("movie");

  const [iframeSrc, setIframeSrc] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');

  const [isPlayerTypeDropdownOpen, setIsPlayerTypeDropdownOpen] = useState(false);

  // Ref for the debounce timer
  const debounceTimerRef = useRef(null);

  // Function to generate the player link
  const generatePlayerLink = () => {
    const queryParams = new URLSearchParams();
    queryParams.append("player", testPlayerType);

    // Append theme without the '#'
    if (testTheme) {
      queryParams.append("theme", testTheme);
    }

    if (testAutoplay) {
      queryParams.append("autoplay", testAutoplay);
    }
    if (testShowTitle) {
      queryParams.append("title", testShowTitle);
    }
    if (testShowPoster) {
      queryParams.append("poster", testShowPoster);
    }
    // Add autoplay and dub to URL
    if (contentType === 'anime' && testAnimeDub) {
      queryParams.append("dub", testAnimeDub);
    }

    let path = "";
    let id, season, episode;
    if (contentType === "movie") {
      id = testMovieId || DEFAULT_MOVIE_ID;
      path = `/movie/${id}?${queryParams.toString()}`;
    } else if (contentType === "series") {
      id = testShowId || DEFAULT_SHOW_ID;
      season = testSeasonNum || DEFAULT_SHOW_SEASON;
      episode = testEpisodeNum || DEFAULT_SHOW_EPISODE;
      path = `/tv/${id}/${season}/${episode}?${queryParams.toString()}`;
    } else if (contentType === "anime") {
      id = testShowId || DEFAULT_ANIME_ID;
      episode = testEpisodeNum || DEFAULT_ANIME_EPISODE;
      path = `/anime/${id}/${episode}?${queryParams.toString()}`;
    }

    if (path) {
      const fullLink = `${window.location.origin}${path}`;
      setGeneratedLink(fullLink);
      setIframeSrc(path);
    }
  };

  // Effect to handle default URLs and automatic fetch
  useEffect(() => {
    // Set default state based on content type
    const setDefaultStates = (type) => {
      if (type === 'movie') {
        setTestMovieId(DEFAULT_MOVIE_ID);
        setTestShowId("");
        setTestSeasonNum("");
        setTestEpisodeNum("");
        setTestAnimeDub(false);
      } else if (type === 'series') {
        setTestMovieId("");
        setTestShowId(DEFAULT_SHOW_ID);
        setTestSeasonNum(DEFAULT_SHOW_SEASON);
        setTestEpisodeNum(DEFAULT_SHOW_EPISODE);
        setTestAnimeDub(false);
      } else if (type === 'anime') {
        setTestMovieId("");
        setTestShowId(DEFAULT_ANIME_ID);
        setTestSeasonNum("");
        setTestEpisodeNum(DEFAULT_ANIME_EPISODE);
        setTestAnimeDub(DEFAULT_ANIME_DUB);
      }
    };

    // Initial mount and when contentType changes, set default states and generate link
    setDefaultStates(contentType);
    generatePlayerLink();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentType]);

  // Effect to handle debounced fetch
  useEffect(() => {
    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set a new timer
    debounceTimerRef.current = setTimeout(() => {
      // Fetch only if there is a valid ID
      let id;
      if (contentType === 'movie' && testMovieId) {
        id = testMovieId;
      } else if ((contentType === 'series' || contentType === 'anime') && testShowId) {
        id = testShowId;
      }

      if (id) {
        generatePlayerLink();
      }
    }, 500); // 500ms debounce

    // Cleanup function to clear the timer when the component unmounts or dependencies change
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testMovieId, testShowId, testSeasonNum, testEpisodeNum, testPlayerType, testTheme, testAutoplay, testShowTitle, testShowPoster, testAnimeDub]);

  const handleCopyLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink).then(() => {
        alert("Player link copied to clipboard!");
      }).catch(err => {
        console.error('Failed to copy link: ', err);
      });
    }
  };

  const handleThemeChange = (e) => {
    const color = e.target.value.replace("#", "");
    setTestTheme(color);
  };

  return (
    <div className="homepage">
      <div className="divblur"></div>
      <div className="divblur2"></div>
      <header className="header">
        <div className="site-top-header">
          <h1 className="site-title">VPlayer</h1>
          <div className="social-links">
            {/* Social links placeholder */}
          </div>
        </div>
        <div className="nav-links">
          <a href="#player-demo-section" className="nav-link">Player</a>
          <div className="separator"></div>
          <a href="#faq" className="nav-link">FAQs</a>
        </div>

      </header>

      <main className="main-content">
        <section className="presentation-section">
          <div className="presentation-gradient"></div>
          <div className="presentation-container">
            <div className="presentation-text">
              <section className="hero-section">
                <div className="hero-content">
                  <h1>Next Generation Media Experience</h1>
                  <p>Stable, fast, and beautiful media playback for everyone.</p>
                </div>
              </section>

              <div className="buttonholder">
                <button className="cta-button" onClick={() => document.getElementById('player-demo-section').scrollIntoView({ behavior: 'smooth' })}>Try the Player</button>
              </div>
            </div>
            <div className="presentation-carousel">
               <TrendingCarousel />
            </div>
          </div>
        </section>

        <section id="player-demo-section" className="player-demo-section">
          <h3>Test the Player</h3>
          <p>Experiment with different settings and content types.</p>

          <ToggleGroup type="single" value={contentType} onValueChange={(value) => {
            if (value) {
              setContentType(value);
            }
          }}>
            <ToggleGroupItem value="movie" aria-label="Movie Player">
              <Clapperboard className="h-4 w-4" /> Movie Player
            </ToggleGroupItem>
            <ToggleGroupItem value="series" aria-label="Series Player">
              <Tv className="h-4 w-4" /> Series Player
            </ToggleGroupItem>
            {/* <ToggleGroupItem value="anime" aria-label="Anime Player">
              <Tv className="h-4 w-4" /> Anime Player
            </ToggleGroupItem> */}
          </ToggleGroup>

          <div className="input-row">
            <div className="input-group id-group">
              <label className="input-title">Content ID</label>
              <input
                type="text"
                id="id-input"
                placeholder={contentType === 'movie' ? "TMDb Movie ID (e.g., 550)" : "TMDb Show/Anilist ID (e.g., 1399)"}
                value={contentType === 'movie' ? testMovieId : testShowId}
                onChange={(e) => contentType === 'movie' ? setTestMovieId(e.target.value) : setTestShowId(e.target.value)}
                className="id-input form-input"
              />
            </div>
            
            {(contentType === 'series' || contentType === 'anime') && (
              <div className="season-episode-group">
                {contentType === 'series' && (
                  <div className="input-group">
                    <label className="input-title">Season</label>
                    <input
                      type="number"
                      placeholder="e.g. 1"
                      value={testSeasonNum}
                      onChange={(e) => setTestSeasonNum(e.target.value)}
                      className="se-input form-input"
                      min="1"
                    />
                  </div>
                )}
                
                <div className="input-group">
                  <label className="input-title">Episode</label>
                  <input
                    type="number"
                    placeholder="e.g. 1"
                    value={testEpisodeNum}
                    onChange={(e) => setTestEpisodeNum(e.target.value)}
                    className="se-input form-input"
                    min="1"
                  />
                </div>

                {contentType === 'anime' && (
                  <div className="input-group">
                    <label className="input-title">Dub</label>
                    <label className="anime-dub-toggle">
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={testAnimeDub}
                          onChange={(e) => setTestAnimeDub(e.target.checked)}
                        />
                        <span className="slider round"></span>
                      </label>
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="player-and-customization-layout">
            <div className="player-preview-area">
              <h4>Player Preview</h4>
              {iframeSrc ? (
                <div className="iframe-container">
                  <iframe
                    src={iframeSrc}
                    title="VPlayer"
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    allowFullScreen
                    loading="lazy"
                    className="player-iframe"
                  ></iframe>
                </div>
              ) : (
                <div className="player-placeholder">
                  Select content and click Generate & Test to see preview.
                </div>
              )}
              <div className="generated-link-bar">
                <input
                  type="text"
                  value={generatedLink}
                  readOnly
                  className="generated-link-input"
                  placeholder="Generated Player Link"
                />
                <button className="copy-link-button" onClick={handleCopyLink} disabled={!generatedLink}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                </button>
              </div>
            </div>

            <div className="player-settings-area">
              <h4>Player Settings</h4>
              <div className="player-options-grid">
                <div className="setting-item">
                  <div className="setting-label">
                    <Monitor className="option-icon"/>
                    <span>Player</span>
                    <p>select the player type</p>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="dropdown-trigger-button" onClick={() => setIsPlayerTypeDropdownOpen(!isPlayerTypeDropdownOpen)}>
                        {testPlayerType === 'vidstack' ? 'Vidstack' : testPlayerType === 'art' ? 'ArtPlayer' : 'MediaWeb'} <ChevronDown size={16} />
                      </button>
                    </DropdownMenuTrigger>
                    {isPlayerTypeDropdownOpen && (
                      <DropdownMenuContent className="w-56" onBlur={() => setIsPlayerTypeDropdownOpen(false)} setIsOpen={setIsPlayerTypeDropdownOpen}>
                        <DropdownMenuLabel>Select Player</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioGroup value={testPlayerType} onValueChange={(val) => { setTestPlayerType(val); setIsPlayerTypeDropdownOpen(false); }}>
                          <DropdownMenuRadioItem value="vidstack">Vidstack</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="art">ArtPlayer</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="mediaweb">MediaWeb</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    )}
                  </DropdownMenu>
                </div>

                <label className="setting-item color-setting">
                  <div className="setting-label">
                    <Palette className="option-icon"/>
                    <span>Theme</span>
                    <p>set the player overall color</p>
                  </div>

                  <div className="separator"></div>

                  <div className="setting-color">
                    <input type="color" value={`#${testTheme}`} onChange={handleThemeChange} className="setting-color-input" />
                    <span className="color-hex">{testTheme}</span>

                  </div>
                </label>

                <label className="setting-item">
                  <span>Autoplay</span>
                  <label className="switch">
                    <input type="checkbox" checked={testAutoplay} onChange={(e) => setTestAutoplay(e.target.checked)} />
                    <span className="slider round"></span>
                  </label>
                </label>

                <label className="setting-item">
                  <span>Show Title</span>
                  <label className="switch">
                    <input type="checkbox" checked={testShowTitle} onChange={(e) => setTestShowTitle(e.target.checked)} />
                    <span className="slider round"></span>
                  </label>
                </label>

                <label className="setting-item">
                  <span>Show Poster</span>
                  <label className="switch">
                    <input type="checkbox" checked={testShowPoster} onChange={(e) => setTestShowPoster(e.target.checked)} />
                    <span className="slider round"></span>
                  </label>
                </label>
              </div>
            </div>
          </div>
        </section>

        <section id="docs" className="docs-section">
          <h3>API Documentation</h3>
          <h4>Embed Movies</h4>
          <p>ID is required from <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer" className="doc-link">The Movie Database API</a>.</p>
          <pre><code>{`${window.location.origin}/movie/{tmdbId}`}</code></pre>
          <h5>Code Example:</h5>
          <pre><code>{`<iframe src="${window.location.origin}/movie/786892" frameborder="0" allowfullscreen></iframe>`}</code></pre>
          <h4>Embed Shows</h4>
          <p>ID is required from <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer" className="doc-link">The Movie Database API</a>. Season and episode number should not be empty.</p>
          <pre><code>{`${window.location.origin}/tv/{tmdbId}/{season}/{episode}`}</code></pre>
          <h5>Code Example:</h5>
          <pre><code>{`<iframe src="${window.location.origin}/tv/94605/1/1" frameborder="0" allowfullscreen></iframe>`}</code></pre>
          {/* <h4>Embed Anime</h4>
          <p>ID is required from <a href="https://anilist.co/" target="_blank" rel="noopener noreferrer" className="doc-link">Anilist API</a>. ID should not be empty, dub by default is false.</p>
          <pre><code>{`${window.location.origin}/anime/{anilistId}/{episodeNumber}?dub={trueOrFalse}`}</code></pre>
          <h5>Code Example:</h5>
          <pre><code>{`<iframe src="${window.location.origin}/anime/12234/1?dub=true" frameborder="0" allowfullscreen></iframe>`}</code></pre>
           */}
          <h4>Player Options</h4>
          <p>Customize the player's behavior and appearance using URL query parameters:</p>
          <div className="player-options-doc-grid">
            <div className="option-item">
              <TvIcon className="option-icon" />
              <strong>player</strong>
              <p>Selects the player type (<code>vidstack</code> or <code>art</code>).</p>
              <pre><code>player=vidstack</code></pre>
            </div>
            <div className="option-item">
              <PaintRoller className="option-icon" />
              <strong>theme</strong>
              <p>Sets the primary color of the player (HEX code without '#').</p>
              <pre><code>theme=B20710</code></pre>
            </div>
            <div className="option-item">
              <Play className="option-icon" />
              <strong>autoplay</strong>
              <p>Controls whether the player automatically starts playing media.</p>
              <pre><code>autoplay=true</code></pre>
            </div>
            <div className="option-item">
              <ALargeSmall className="option-icon" />
              <strong>title</strong>
              <p>Controls whether the title is displayed in the player interface (fetched from TMDB).</p>
              <pre><code>title=true</code></pre>
            </div>
            <div className="option-item">
              <Image className="option-icon" />
              <strong>poster</strong>
              <p>Determines if the poster image is shown (fetched from TMDB backdrop).</p>
              <pre><code>poster=true</code></pre>
            </div>
            <div className="option-item">
              <strong>primaryColor</strong>
              <p>Sets the primary color of the player, including sliders and autoplay controls.</p>
              <pre><code>primaryColor=B20710</code></pre>
            </div>
            <div className="option-item">
              <strong>secondaryColor</strong>
              <p>Defines the color of the progress bar behind the sliders.</p>
              <pre><code>secondaryColor=170000</code></pre>
            </div>
            <div className="option-item">
              <strong>autoNext</strong>
              <p>Controls whether the player automatically plays the next episode/content.</p>
              <pre><code>autoNext=true</code></pre>
            </div>
            <div className="option-item">
              <strong>nextButton</strong>
              <p>Controls whether the next button is displayed in the player controls.</p>
              <pre><code>nextButton=true</code></pre>
            </div>
            <div className="option-item">
              <strong>subtitleColor</strong>
              <p>Sets the color of subtitle text.</p>
              <pre><code>subtitleColor=FFFFFF</code></pre>
            </div>
            <div className="option-item">
              <strong>subtitleFontSize</strong>
              <p>Controls the font size of subtitles.</p>
              <pre><code>subtitleFontSize=16</code></pre>
            </div>
            <div className="option-item">
              <strong>subtitleOpacity</strong>
              <p>Controls the opacity of the subtitle background.</p>
              <pre><code>subtitleOpacity=0.5</code></pre>
            </div>
          </div>
        </section>

        <section id="faq" className="docs-section">
          <h3>Frequently Asked Questions</h3>
          <p>Find answers to commonly asked questions</p>

          <div className="faq-category">
            <h4>All (6)</h4>
            <div className="faq-item">
              <h5>1. Are your links protected from DMCA?</h5>
              <p>Yes, our links are protected.</p>
            </div>
            <div className="faq-item">
              <h5>2. Are subtitles available for all movies and TV shows?</h5>
              <p>Subtitle availability varies by content, but we strive to provide a wide selection.</p>
            </div>
            <div className="faq-item">
              <h5>3. What should I do if I come across incorrect movies or TV shows?</h5>
              <p>Please report any incorrect content through our Discord or Telegram channels.</p>
            </div>
            <div className="faq-item">
              <h5>4. Is it possible to change the video quality?</h5>
              <p>Yes, for adaptive streaming sources (like HLS), video quality can be changed in the player settings.</p>
            </div>
            <div className="faq-item">
              <h5>5. Do you offer movies and TV shows in languages other than English?</h5>
              <p>Yes, we offer content in various languages, with multi-language subtitles available.</p>
            </div>
            <div className="faq-item">
              <h5>6. Can I use this API for anime?</h5>
              <p>No, the API doesnt support embedding anime content yet , but we are working on it</p>
            </div>
          </div>
        </section>

        <footer className="footer">
          <p>&copy; 2025 VPlayer. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
}

export default HomePage;