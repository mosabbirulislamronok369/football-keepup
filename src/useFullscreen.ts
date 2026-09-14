import { useState, useEffect, useCallback } from 'react';

export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(
    !!document.fullscreenElement
  );

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  const enterFullscreen = useCallback((el?: HTMLElement) => {
    const target = el ?? document.documentElement;
    if (target.requestFullscreen) {
      target.requestFullscreen().catch(() => {
        // ignore — some browsers block this without a user gesture
      });
    }
    // Try to lock orientation to landscape on mobile (optional, safe to fail)
    const orientation = screen.orientation as any;
    if (orientation && orientation.lock) {
      orientation.lock('landscape').catch(() => {});
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const toggleFullscreen = useCallback(
    (el?: HTMLElement) => {
      if (document.fullscreenElement) {
        exitFullscreen();
      } else {
        enterFullscreen(el);
      }
    },
    [enterFullscreen, exitFullscreen]
  );

  return { isFullscreen, enterFullscreen, exitFullscreen, toggleFullscreen };
}