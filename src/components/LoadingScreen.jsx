import { useEffect, useRef, useState } from "react";

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
    <div className="fixed inset-0 w-full h-full bg-black/50 flex justify-center items-center z-9999 font-[Poppins,'Segoe_UI',sans-serif]">
      <div className="flex flex-col items-center gap-5">
        <div className="border-4 border-lpu-maroon border-t-lpu-gold rounded-full w-12.5 h-12.5 animate-spin"></div>
        <p className="text-white text-lg font-medium m-0">Loading...</p>
      </div>
    </div>
  );
};

export default LoadingScreen;
