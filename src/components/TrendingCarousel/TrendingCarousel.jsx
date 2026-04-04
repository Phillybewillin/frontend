import { useState, useEffect } from 'react';
import { fetchTrendingContent } from '../../services/apiClient';
import './TrendingCarousel.css';

export default function TrendingCarousel() {
  const [items, setItems] = useState([]);
  const [activeIndex, setActiveIndex] = useState(2);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getTrending = async () => {
      try {
        const data = await fetchTrendingContent();
        if (data && data.results) {
          // Take top 7 results for the carousel
          const validItems = data.results
            .filter(item => item.poster_path)
            .slice(0, 7);
          setItems(validItems);
          setActiveIndex(Math.floor(validItems.length / 2));
        }
      } catch (err) {
        console.error("Failed to fetch trending:", err);
      } finally {
        setLoading(false);
      }
    };
    getTrending();
  }, []);

  useEffect(() => {
    if (items.length === 0) return;
    const interval = setInterval(() => {
      setActiveIndex((current) => (current + 1) % items.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [items]);

  if (loading) return <div className="carousel-loading">Loading trending...</div>;
  if (!items.length) return null;

  return (
    <div className="trending-carousel-wrapper">
      <div className="trending-carousel">
        {items.map((item, index) => {
          let offset = index - activeIndex;
          
          // Handle wrap-around for infinite scroll feel if needed, 
          // or just clamp it. For 7 items, max offset is 3.
          if (offset > Math.floor(items.length / 2)) {
            offset -= items.length;
          } else if (offset < -Math.floor(items.length / 2)) {
            offset += items.length;
          }

          const isActive = offset === 0;
          const absOffset = Math.abs(offset);
          
          // Define classes and inline styles to create a 3D effect
          // Z-index: center is highest, going down outward
          // Scale: center is 1, outward gets smaller
          // Opacity: center is 1, outward gets darker/dimmer
          // Transform: translate X based on offset
          
          let zIndex = 100 - absOffset;
          let scale = 1 - absOffset * 0.15;
          let translateX = offset * 60; // percentage
          let opacity = 1 - absOffset * 0.3;

          return (
            <div
              key={item.id}
              className={`carousel-item ${isActive ? 'active' : ''}`}
              style={{
                zIndex: zIndex,
                transform: `translateX(${translateX}%) scale(${scale})`,
                opacity: opacity,
              }}
              onClick={() => setActiveIndex(index)}
            >
              <div className="carousel-poster-wrapper">
                <img
                  src={`https://image.tmdb.org/t/p/w342${item.poster_path}`}
                  alt={item.title || item.name}
                  className="carousel-poster"
                  loading="lazy"
                />
                <span className="carousel-rating">
                    {(item.vote_average || 0).toFixed(1)} <span className="star">★</span>
                  </span>
                <div className="carousel-item-info">
                  
                  <div className="carousel-details">
                    <p className="carousel-title">{item.title || item.name}</p>
                    <p className="carousel-subinfo">
                       {item.release_date?.substring(0, 4) || item.first_air_date?.substring(0, 4)} 
                       {item.media_type === 'tv' ? ' / TV Series' : ' / Movie'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
