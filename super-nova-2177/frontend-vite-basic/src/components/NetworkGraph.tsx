
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { GraphData, NetworkNode } from '../types';

interface NetworkGraphProps {
  data: GraphData;
}

export const NetworkGraph: React.FC<NetworkGraphProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data.nodes || data.nodes.length === 0) return;

    const width = svgRef.current.clientWidth;
    const height = 400; // Fixed height container
    
    // Clear previous
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height]);

    // Make a shallow copy for D3 to mutate
    const nodes = data.nodes.map(d => ({...d}));
    const links = data.edges.map(d => ({...d}));

    // Simulation setup
    const simulation = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-150))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(15));

    // Links
    const link = svg.append("g")
      .attr("stroke", "#4CC9F0")
      .attr("stroke-opacity", 0.3)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", (d) => Math.sqrt(d.strength || 1));

    // Nodes
    const node = svg.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", (d) => {
          if (d.type === 'vibenode') return 6;
          if (d.type === 'harmonizer') return 6 + (d.degree_centrality || 0) * 8;
          return 5;
      })
      .attr("fill", (d) => {
        if (d.type === 'harmonizer') return "#F20089"; 
        if (d.type === 'vibenode') return "#4CC9F0"; 
        if (d.type === 'proposal') return "#CCFF00";
        return "#aaa";
      })
      .call(drag(simulation) as any);

    // Labels (only for big nodes or limited count to avoid clutter)
    const labels = svg.append("g")
        .attr("class", "labels")
        .selectAll("text")
        .data(nodes)
        .enter()
        .append("text")
        .attr("dx", 10)
        .attr("dy", ".35em")
        .text((d) => d.label)
        .style("font-family", "Space Mono")
        .style("font-size", "10px")
        .style("fill", "#fff")
        .style("pointer-events", "none")
        .style("opacity", 0.8)
        .style("display", (d) => (d.degree_centrality && d.degree_centrality > 0.05) || d.type === 'proposal' ? 'block' : 'none');


    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node
        .attr("cx", (d: any) => d.x)
        .attr("cy", (d: any) => d.y);

        labels
        .attr("x", (d: any) => d.x)
        .attr("y", (d: any) => d.y);
    });

    function drag(simulation: d3.Simulation<d3.SimulationNodeDatum, undefined>) {
      function dragstarted(event: any) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }

      function dragged(event: any) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }

      function dragended(event: any) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }

      return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
    }
  }, [data]);

  return (
    <svg ref={svgRef} className="w-full h-[400px] bg-black/40 rounded-lg border border-nova-purple/30 shadow-[0_0_15px_rgba(45,0,247,0.2)]" />
  );
};
