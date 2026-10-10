import { useId, useState, type Ref } from 'react';
import { useRotatingPlaceholder } from './useRotatingPlaceholder';

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Display names (brackets already removed) for the rotating placeholder. */
  suggestions: readonly string[];
  reducedMotion: boolean;
  inputRef?: Ref<HTMLInputElement>;
}

/**
 * Underlined search input. The rotating placeholder is a separate, purely visual layer (a native
 * placeholder can't animate); it pauses while the field is focused or has text and resumes once
 * the field is empty and no longer focused.
 */
export function SearchField({
  value,
  onChange,
  suggestions,
  reducedMotion,
  inputRef,
}: SearchFieldProps) {
  const [focused, setFocused] = useState(false);
  const inputId = useId();
  const paused = focused || value.length > 0;
  const suggestion = useRotatingPlaceholder(suggestions, { paused, reducedMotion });
  const showSuggestion = value.length === 0 && suggestion !== '';

  return (
    <div className="search">
      <label className="visually-hidden" htmlFor={inputId}>
        Search your food orders
      </label>
      <input
        ref={inputRef}
        id={inputId}
        className="search__input"
        type="search"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        onFocus={() => {
          setFocused(true);
        }}
        onBlur={() => {
          setFocused(false);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onChange('');
        }}
      />
      {showSuggestion && (
        <span className="search__placeholder" aria-hidden="true" data-testid="search-placeholder">
          <span key={suggestion} className="search__placeholder-text">
            {suggestion}
          </span>
        </span>
      )}
      {value.length > 0 && (
        <button
          type="button"
          className="search__clear"
          aria-label="Clear search"
          onClick={() => {
            onChange('');
          }}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
