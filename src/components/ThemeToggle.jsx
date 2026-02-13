import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { Moon, Sun } from 'lucide-react';

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '50px',
        height: '50px',
        borderRadius: '50%',
        border: 'none',
        backgroundColor: 'var(--primary-blue)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        zIndex: 9999, // Always on top
        transition: 'transform 0.2s ease, background-color 0.3s'
      }}
      title="Toggle Dark Mode"
    >
      {theme === 'light' ? <Moon size={24} /> : <Sun size={24} />}
    </button>
  );
};

export default ThemeToggle;