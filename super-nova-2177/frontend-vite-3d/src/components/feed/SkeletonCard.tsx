import React from "react";
import "./Feed.css";

export default function SkeletonCard() {
  return (
    <article className="if-card skeleton">
      <div className="sk-head" />
      <div className="sk-media" />
      <div className="sk-actions">
        <div className="sk-action" />
        <div className="sk-action" />
        <div className="sk-action" />
        <div className="sk-action" />
      </div>
    </article>
  );
}
