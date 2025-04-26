import { useState, useEffect, RefObject } from 'react';

export function useIsScrollable(containerRef: RefObject<HTMLElement>) {
  const [isScrollable, setIsScrollable] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    
    function checkScrollable() {
      if (!container) return;
      
      const isContentScrollable = container.scrollHeight > container.clientHeight;
      setIsScrollable(isContentScrollable);
      
      // Check if we're near the bottom (within 100px)
      const scrollPosition = container.scrollTop + container.clientHeight;
      const isNearEnd = container.scrollHeight - scrollPosition < 100;
      setIsNearBottom(isNearEnd);
    }

    // Initial check
    checkScrollable();
    
    // Set up resize observer to check when content changes size
    const resizeObserver = new ResizeObserver(checkScrollable);
    if (container) {
      resizeObserver.observe(container);
    }
    
    // Listen for scroll events
    container?.addEventListener('scroll', checkScrollable);

    return () => {
      container?.removeEventListener('scroll', checkScrollable);
      resizeObserver.disconnect();
    };
  }, [containerRef]);

  return { isScrollable, isNearBottom };
} 

export function useIsScrollable(containerRef: RefObject<HTMLElement>) {
  const [isScrollable, setIsScrollable] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    
    function checkScrollable() {
      if (!container) return;
      
      const isContentScrollable = container.scrollHeight > container.clientHeight;
      setIsScrollable(isContentScrollable);
      
      // Check if we're near the bottom (within 100px)
      const scrollPosition = container.scrollTop + container.clientHeight;
      const isNearEnd = container.scrollHeight - scrollPosition < 100;
      setIsNearBottom(isNearEnd);
    }

    // Initial check
    checkScrollable();
    
    // Set up resize observer to check when content changes size
    const resizeObserver = new ResizeObserver(checkScrollable);
    if (container) {
      resizeObserver.observe(container);
    }
    
    // Listen for scroll events
    container?.addEventListener('scroll', checkScrollable);

    return () => {
      container?.removeEventListener('scroll', checkScrollable);
      resizeObserver.disconnect();
    };
  }, [containerRef]);

  return { isScrollable, isNearBottom };
} 