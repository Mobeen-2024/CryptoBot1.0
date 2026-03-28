import React, { useRef, useEffect } from 'react';

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

interface AgentVisualizerProps {
  activeAgent?: 'risk' | 'momentum' | 'neutral';
  intensity?: number; // 0 to 100
  weights?: { risk: number, momentum: number, neutral: number };
}

export const AgentVisualizer: React.FC<AgentVisualizerProps> = ({ 
  activeAgent = 'neutral', 
  intensity = 50,
  weights = { risk: 33, momentum: 33, neutral: 34 }
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = canvas.width = canvas.offsetWidth;
    let height = canvas.height = canvas.offsetHeight;

    const nodes: Node[] = [];
    const nodeCount = 30; // Increased slightly for better visual density
    const connectionDist = 120;

    // Node colors based on agent
    const colors = {
      risk: '#FF007F',    // Magenta
      momentum: '#00E5FF', // Cyan
      neutral: '#bc13fe'   // Purple
    };

    // Calculate node distribution based on weights
    const totalWeight = weights.risk + weights.momentum + weights.neutral;
    const riskNodes = Math.floor((weights.risk / totalWeight) * nodeCount);
    const momentumNodes = Math.floor((weights.momentum / totalWeight) * nodeCount);
    
    // Initialize nodes with distributed colors
    for (let i = 0; i < nodeCount; i++) {
      let nodeColor = colors.neutral;
      if (i < riskNodes) nodeColor = colors.risk;
      else if (i < riskNodes + momentumNodes) nodeColor = colors.momentum;

      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 2 + 1,
        color: nodeColor
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Update and draw nodes
      nodes.forEach((node, i) => {
        // Move nodes
        node.x += node.vx * (intensity / 50);
        node.y += node.vy * (intensity / 50);

        // Bounce off edges
        if (node.x < 0 || node.x > width) node.vx *= -1;
        if (node.y < 0 || node.y > height) node.vy *= -1;

        // Draw connections
        for (let j = i + 1; j < nodes.length; j++) {
          const other = nodes[j];
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < connectionDist) {
            ctx.beginPath();
            // Create a gradient for the connection line
            const grad = ctx.createLinearGradient(node.x, node.y, other.x, other.y);
            grad.addColorStop(0, node.color);
            grad.addColorStop(1, other.color);
            ctx.strokeStyle = grad;
            ctx.lineWidth = (1 - dist / connectionDist) * 0.8;
            ctx.globalAlpha = (1 - dist / connectionDist) * 0.4;
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(other.x, other.y);
            ctx.stroke();
          }
        }

        // Draw node
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = node.color;
        ctx.globalAlpha = 0.8;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    const handleResize = () => {
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };

    window.addEventListener('resize', handleResize);
    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [activeAgent, intensity]);

  return (
    <div className="w-full h-full relative group">
      <canvas 
        ref={canvasRef} 
        className="w-full h-full opacity-60 filter blur-[0.5px]"
      />
      {/* Decorative center glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div 
          className="w-32 h-32 rounded-full blur-[60px] opacity-20 transition-colors duration-1000"
          style={{ 
            backgroundColor: activeAgent === 'risk' ? 'var(--holo-magenta)' : 
                             activeAgent === 'momentum' ? 'var(--holo-cyan)' : 
                             '#bc13fe' 
          }}
        />
      </div>
      {/* HUD overlay text */}
      <div className="absolute bottom-2 left-2 font-mono text-[8px] text-white/30 tracking-widest uppercase pointer-events-none">
        Neural_Link: Active // Cluster_Load: {(intensity * 0.8).toFixed(1)}%
      </div>
    </div>
  );
};
