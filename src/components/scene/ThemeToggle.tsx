"use client";
import React from "react";
import { useTheme } from "@/lib/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button 
      onClick={toggleTheme}
      className={`text-xs px-2 py-1 ml-2 rounded transition-colors ${theme === 'dark' ? 'bg-slate-800 text-gray-300 hover:text-white' : 'bg-gray-200 text-slate-700 hover:text-black'}`}
      title="Prepnutie témy"
    >
      {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
    </button>
  );
}
