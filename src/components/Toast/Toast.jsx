import React from 'react';
import './Toast.css';

export function Toast({ message, isError = false }) {
  return (
    <div
      className={`toast ${message ? 'show' : ''} ${isError ? 'bad' : ''}`}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
