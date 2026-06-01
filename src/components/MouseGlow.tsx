"use client";

import { useEffect } from "react";

export default function MouseGlow() {
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const root = document.documentElement;
      root.style.setProperty("--mouse-x", `${e.clientX}px`);
      root.style.setProperty("--mouse-y", `${e.clientY}px`);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <>
      {/* Primary Glow Area (Subtle ambient) */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `radial-gradient(600px circle at var(--mouse-x, 0) var(--mouse-y, 0), rgba(0, 0, 0, 0.02), transparent 80%)`,
        }}
      />

      {/* Glowing Grid Borders Only */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Cpath d='M40 0H0v40' fill='none' stroke='rgba(0, 0, 0, 0.15)' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "40px 40px",
          maskImage: `radial-gradient(300px circle at var(--mouse-x, 0) var(--mouse-y, 0), black 20%, transparent 100%)`,
          WebkitMaskImage: `radial-gradient(300px circle at var(--mouse-x, 0) var(--mouse-y, 0), black 20%, transparent 100%)`,
        }}
      />
    </>
  );
}
