'use client';

import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

// Only initialize if no global init exists
// Since we can't directly check mermaid.initialized, use a try/catch approach
if (typeof window !== 'undefined') {
  try {
    // Initialize with settings that suppress error SVGs
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      fontFamily: 'inherit',
      logLevel: 1,
      suppressErrorRendering: true
    });
  } catch (e) {
    console.warn("Mermaid may already be initialized");
  }
}

interface MermaidDiagramProps {
  chart: string;
}

export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ chart }) => {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reset state for new chart
    setError(null);
    setSvg('');
    setIsLoading(true);

    if (!chart) {
      setIsLoading(false);
      return;
    }

    const renderDiagram = async () => {
      try {
        // Apply fixes even before first rendering attempt
        // Special characters need to be handled proactively
        const fixedChart = fixMermaidSyntax(chart, '');
        
        try {
          // Use a unique ID for rendering
          const id = `mermaid-${Math.random().toString(36).substring(2)}`;
          
          // Try to render with fixed chart
          const { svg } = await mermaid.render(id, fixedChart);
          
          setSvg(svg);
          setIsLoading(false);
        } catch (err) {
          // First attempt failed, try with more aggressive fixes
          console.error('First render attempt failed:', err);
          
          const errorMsg = err instanceof Error ? err.message : String(err);
          const moreFixedChart = applyAggressiveFixes(fixedChart, errorMsg);
          
          try {
            // Try one more time with more aggressive fixes
            const newId = `mermaid-${Math.random().toString(36).substring(2)}`;
            const { svg } = await mermaid.render(newId, moreFixedChart);
            
            setSvg(svg);
            setIsLoading(false);
          } catch (finalErr) {
            // Both attempts failed
            setError(finalErr instanceof Error ? finalErr.message : String(finalErr));
            setIsLoading(false);
          }
        }
      } catch (outerErr) {
        console.error('Error in diagram rendering:', outerErr);
        setError(outerErr instanceof Error ? outerErr.message : String(outerErr));
        setIsLoading(false);
      }
    };

    renderDiagram();
  }, [chart]);
  
  useEffect(() => {
    // After SVG is set, ensure it fills the container
    if (svg && containerRef.current) {
      const svgEl = containerRef.current.querySelector('svg');
      if (svgEl) {
        svgEl.setAttribute('width', '100%');
        svgEl.setAttribute('height', '100%');
        svgEl.style.width = '100%';
        svgEl.style.height = '100%';
        svgEl.style.maxWidth = '100%';
        svgEl.style.maxHeight = '100%';
        svgEl.style.objectFit = 'contain';
        svgEl.style.display = 'block';
      }
    }
  }, [svg]);
  
  // Helper function to fix common syntax issues
  const fixMermaidSyntax = (chartCode: string, errorMsg: string): string => {
    let fixed = chartCode.trim();
    
    // Apply line by line fixes
    const lines = fixed.split('\n');
    const fixedLines = lines.map(line => {
      // Fix node definitions with problematic chars
      // Look for patterns like X[Text with (parentheses) or special chars]
      const nodeRegex = /(\w+)\[(.*?)]/g;
      let fixedLine = line;
      let match;
      
      // Reset regex
      nodeRegex.lastIndex = 0;
      
      // Find all node definitions in this line
      while ((match = nodeRegex.exec(line)) !== null) {
        const nodeId = match[1];
        const nodeText = match[2];
        
        // If node text contains ANY special characters, use quotes
        // Much more aggressive quoting
        if (/[^a-zA-Z0-9\s]/.test(nodeText)) {
          // Replace with quoted version
          const fixedNode = `${nodeId}["${nodeText}"]`;
          // Escape any special regex chars in the original match
          const escapedMatch = match[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          fixedLine = fixedLine.replace(new RegExp(escapedMatch, 'g'), fixedNode);
        }
      }
      
      // Fix arrow syntax with spaces
      fixedLine = fixedLine
        .replace(/--\s+>/g, '-->') // Fix "-- >" to "-->"
        .replace(/-\s+>/g, '->') // Fix "- >" to "->"
        .replace(/--\s+>>/g, '-->>') // Fix "-- >>" to "-->>"
        .replace(/<\s+--/g, '<--'); // Fix "< --" to "<--"
      
      return fixedLine;
    });
    
    // Join lines back together
    return fixedLines.join('\n');
  };
  
  // Apply more aggressive fixes when initial fixes didn't work
  const applyAggressiveFixes = (chartCode: string, errorMsg: string): string => {
    // Start with the already fixed chart
    let fixed = chartCode;
    
    // Extra aggressive fixes for factorial and math symbols
    if (errorMsg.includes("got 'PS'")) {
      // Quote ALL node texts regardless of content
      const lines = fixed.split('\n');
      const fixedLines = lines.map(line => {
        // Match any node definition [text]
        const nodeRegex = /(\w+)\[(.*?)]/g;
        let fixedLine = line;
        let match;
        
        // Reset regex state
        nodeRegex.lastIndex = 0;
        
        while ((match = nodeRegex.exec(line)) !== null) {
          // Always quote the node text
          const nodeId = match[1];
          const nodeText = match[2].replace(/"/g, '\\"'); // Escape any quotes in text
          
          // Only apply if not already quoted
          if (!nodeText.startsWith('"') || !nodeText.endsWith('"')) {
            const fixedNode = `${nodeId}["${nodeText}"]`;
            // Escape any special regex chars in the original match
            const escapedMatch = match[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            fixedLine = fixedLine.replace(new RegExp(escapedMatch, 'g'), fixedNode);
          }
        }
        return fixedLine;
      });
      
      fixed = fixedLines.join('\n');
    }
    
    // Normalize whitespace in the whole diagram
    fixed = fixed.replace(/\s+/g, ' ').split('\n').map(line => line.trim()).join('\n');
    
    return fixed;
  };

  // For rendering separately, provide a button to open in the Mermaid Live Editor
  const openInMermaidLiveEditor = () => {
    const encodedDiagram = encodeURIComponent(chart);
    const url = `https://mermaid.live/edit#pako:${encodedDiagram}`;
    window.open(url, '_blank');
  };

  if (isLoading) {
    return (
      <div className="my-4 flex justify-center bg-white rounded-md p-2">
        <div className="flex items-center justify-center h-16">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    // Compact error UI with helpful buttons
    return (
      <div className="my-4 rounded-md overflow-hidden shadow">
        <div className="bg-white p-3 flex justify-between items-center">
          <span className="text-xs text-gray-500">Diagram couldn't be rendered</span>
          <div className="flex space-x-2">
            <button 
              onClick={openInMermaidLiveEditor}
              className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
              title="Open this diagram in the Mermaid Live Editor for debugging"
            >
              Open in Editor
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Successfully rendered SVG
  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center">
      {svg ? (
        <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="p-3 bg-gray-100 rounded text-sm text-gray-500">
          No diagram content available
        </div>
      )}
    </div>
  );
};

export default MermaidDiagram; 