import React from 'react';
import './Icons.css';

export function Icon({ name, className = 'ic' }) {
  switch (name) {
    case 'zap':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M13 2 3 14h9l-1 8 10-12h-9z" />
        </svg>
      );
    case 'plus':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case 'trash':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
        </svg>
      );
    case 'calc':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01" />
        </svg>
      );
    case 'save':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
      );
    case 'reset':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <path d="M3 3v5h5" />
        </svg>
      );
    case 'print':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <rect x="6" y="14" width="12" height="8" />
        </svg>
      );
    case 'download':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
        </svg>
      );
    case 'check':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="10" />
          <path d="m8 12 3 3 5-6" />
        </svg>
      );
    case 'alert':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v5M12 16h.01" />
        </svg>
      );
    case 'grid':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case 'layers':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="m12 2 10 5-10 5L2 7z" />
          <path d="m2 17 10 5 10-5M2 12l10 5 10-5" />
        </svg>
      );
    case 'gauge':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="m12 14 4-4" />
          <path d="M3.3 19a10 10 0 1 1 17.4 0" />
        </svg>
      );
    case 'arrow':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      );
    case 'copy':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      );
    case 'users':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'history':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5M12 7v5l4 2" />
        </svg>
      );
    case 'home':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
    case 'logout':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      );
    case 'eye':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case 'close':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      );
    case 'mail':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      );
    case 'google':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M21.8 12.23c0-.72-.06-1.4-.19-2.05H12v3.88h5.5a4.7 4.7 0 0 1-2.04 3.09v2.56h3.3c1.93-1.78 3.04-4.4 3.04-7.48z"
            fill="#4285F4"
            stroke="none"
          />
          <path
            d="M12 22c2.76 0 5.07-.91 6.76-2.47l-3.3-2.56c-.91.61-2.08.98-3.46.98-2.66 0-4.92-1.8-5.73-4.22H2.86v2.65A9.99 9.99 0 0 0 12 22z"
            fill="#34A853"
            stroke="none"
          />
          <path
            d="M6.27 13.73A6.01 6.01 0 0 1 5.95 12c0-.6.11-1.18.32-1.73V7.62H2.86A9.99 9.99 0 0 0 2 12c0 1.61.39 3.14 1.07 4.38l3.2-2.65z"
            fill="#FBBC05"
            stroke="none"
          />
          <path
            d="M12 5.98c1.5 0 2.85.52 3.91 1.53l2.93-2.93C17.06 2.92 14.75 2 12 2A9.99 9.99 0 0 0 2.86 7.62l3.41 2.65C7.08 7.78 9.34 5.98 12 5.98z"
            fill="#EA4335"
            stroke="none"
          />
        </svg>
      );
    default:
      return null;
  }
}
