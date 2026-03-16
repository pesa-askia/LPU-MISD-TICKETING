import { useEffect, useRef, useState } from "react";
import "./LoadingScreen.css";

const LoadingScreen = ({ isLoading }) => {
  // Avoid annoying flicker on fast route transitions by delaying the overlay.
  const [visible, setVisible] = useState(false);
  const showTimerRef = useRef(null);

  useEffect(() => {
    // Show only if loading takes long enough to matter.
    if (isLoading) {
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      showTimerRef.current = setTimeout(() => setVisible(true), 250);
      return;
    }

    // Loading finished: cancel pending show + hide immediately.
    if (showTimerRef.current) clearTimeout(showTimerRef.current);
    showTimerRef.current = null;
    setVisible(false);
  }, [isLoading]);

  useEffect(() => {
    return () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="loading-overlay">
      <div className="loading-spinner-container">
        <div className="loading-spinner"></div>
        <p className="loading-text">Loading...</p>
      </div>
    </div>
  );
};

export default LoadingScreen;
