'use client';

import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

interface MermaidProps {
  chart: string;
  className?: string;
}

const Mermaid: React.FC<MermaidProps> = ({ chart, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (containerRef.current && chart) {
      try {
        // Initialize mermaid with preferred config
        mermaid.initialize({
          startOnLoad: true,
          theme: 'default',
          securityLevel: 'loose',
          logLevel: 5
        });
        
        // Clear the container before rendering
        containerRef.current.innerHTML = '';
        
        // Render the diagram
        mermaid.render('mermaid-svg-' + Math.random().toString(36).substr(2, 9), chart)
          .then(({ svg }) => {
            if (containerRef.current) {
              containerRef.current.innerHTML = svg;
            }
          })
          .catch(error => {
            console.error('Mermaid rendering error:', error);
            if (containerRef.current) {
              containerRef.current.innerHTML = `
                <div class="p-2 bg-red-50 text-red-500 border border-red-200 rounded">
                  <p>Error rendering diagram:</p>
                  <pre class="text-xs mt-1">${error.message || 'Unknown error'}</pre>
                  <pre class="text-xs mt-1 overflow-x-auto">${chart}</pre>
                </div>
              `;
            }
          });
      } catch (error) {
        console.error('Mermaid initialization error:', error);
        if (containerRef.current) {
          containerRef.current.innerHTML = `
            <div class="p-2 bg-red-50 text-red-500 border border-red-200 rounded">
              <p>Error initializing diagram:</p>
              <pre class="text-xs mt-1">${error instanceof Error ? error.message : 'Unknown error'}</pre>
            </div>
          `;
        }
      }
    }
  }, [chart]);
  
  return (
    <div 
      ref={containerRef} 
      className={`mermaid-container overflow-auto ${className}`}
    >
      <div className="flex justify-center items-center h-24 text-gray-400">
        Loading diagram...
      </div>
    </div>
  );
};

export default Mermaid; 