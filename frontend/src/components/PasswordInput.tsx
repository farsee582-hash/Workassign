import { useState } from 'react';

/** A password input with a show/hide eye-icon toggle (item 12). Never
 * displays a stored password — only toggles the `type` of the input the
 * user is actively typing into. */
export default function PasswordInput({
  value,
  onChange,
  required,
  placeholder,
  variant = 'icon',
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  /** 'icon' = small eye-icon toggle inside the field (default, used on Login).
   *  'button' = uppercase bordered "SHOW"/"HIDE" toggle button beside the field. */
  variant?: 'icon' | 'button';
}) {
  const [visible, setVisible] = useState(false);

  if (variant === 'button') {
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          required={required}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          style={{
            border: '1px solid var(--color-border-strong)',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-sm)',
            padding: '0 16px',
            fontSize: 'var(--fs-xs)',
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
          }}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ paddingRight: 34, width: '100%' }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        title={visible ? 'Hide password' : 'Show password'}
        style={{
          position: 'absolute',
          right: 6,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 2,
          lineHeight: 0,
          color: '#666',
        }}
      >
        {visible ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.7 18.7 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <path d="M1 1l22 22" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
