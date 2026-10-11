import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import type { Suggestion } from '@food-stack/shared';
import { plural } from './format';
import { useRotatingPlaceholder } from './useRotatingPlaceholder';

interface SearchFieldProps {
  value: string;
  /** The user typed or cleared text. Never selects anything by itself. */
  onChange: (value: string) => void;
  /** Autocomplete suggestions for the current text (categories first, then dishes). */
  options: readonly Suggestion[];
  /** The user explicitly picked a suggestion (click, tap, or Enter on the highlighted one). */
  onSelect: (suggestion: Suggestion) => void;
  /** Display names (brackets already removed) for the rotating placeholder. */
  placeholderNames: readonly string[];
  reducedMotion: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
}

const optionKey = (option: Suggestion): string =>
  option.kind === 'category' ? `category:${option.category}` : `dish:${option.key}`;

/**
 * Underlined search input with autocomplete (WAI-ARIA combobox pattern). Typing only lists
 * suggestions; a result appears once the user picks one:
 * - mouse/touch: click or tap a suggestion;
 * - keyboard: ↓/↑ highlight (nothing is highlighted at first), Enter picks the highlighted one,
 *   Escape closes the list without changing the text (a second Escape clears the field).
 * The rotating placeholder is a separate visual layer (a native placeholder can't animate): it
 * keeps rotating while the field is empty, even when focused, pauses while there is text and
 * resumes once the field is cleared.
 */
export function SearchField({
  value,
  onChange,
  options,
  onSelect,
  placeholderNames,
  reducedMotion,
  inputRef,
}: SearchFieldProps) {
  const inputId = useId();
  const listId = useId();
  const ownInput = useRef<HTMLInputElement | null>(null);
  const input = inputRef ?? ownInput;
  const container = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const suggestion = useRotatingPlaceholder(placeholderNames, {
    paused: value.length > 0,
    reducedMotion,
  });
  const showSuggestion = value.length === 0 && suggestion !== '';
  const expanded = open && value.trim() !== '' && options.length > 0;
  const activeIndex = expanded && active < options.length ? active : -1;
  const optionId = (index: number) => `${listId}-option-${String(index)}`;

  // Close the list when the user clicks or taps anywhere outside the search field.
  useEffect(() => {
    if (!expanded) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !container.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [expanded]);

  const pick = (option: Suggestion) => {
    setOpen(false);
    setActive(-1);
    onSelect(option);
  };

  return (
    <div className="search" ref={container}>
      <label className="visually-hidden" htmlFor={inputId}>
        Search your food orders
      </label>
      <input
        ref={input}
        id={inputId}
        className="search__input"
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={(event) => {
          const count = options.length;
          if (event.key === 'ArrowDown' && count > 0 && value.trim() !== '') {
            event.preventDefault();
            setOpen(true);
            setActive(expanded ? (activeIndex + 1) % count : 0);
          } else if (event.key === 'ArrowUp' && expanded) {
            event.preventDefault();
            setActive(activeIndex <= 0 ? count - 1 : activeIndex - 1);
          } else if (event.key === 'Enter') {
            const highlighted = activeIndex >= 0 ? options[activeIndex] : undefined;
            if (highlighted) {
              event.preventDefault();
              pick(highlighted);
            }
          } else if (event.key === 'Escape') {
            event.preventDefault();
            if (expanded) setOpen(false);
            else onChange('');
          }
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
          // A mouse click leaves the focus in the field; after a keyboard press it is put back there.
          onMouseDown={(event) => {
            event.preventDefault();
          }}
          onClick={() => {
            onChange('');
            setOpen(false);
            input.current?.focus();
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
      <ul
        id={listId}
        role="listbox"
        aria-label="Suggestions"
        className="suggestions"
        hidden={!expanded}
      >
        {expanded &&
          options.map((option, index) => (
            <li
              key={optionKey(option)}
              id={optionId(index)}
              role="option"
              aria-selected={index === activeIndex}
              className={`suggestions__option${option.kind === 'category' ? ' suggestions__option--category' : ''}`}
              // Keep the focus in the field; the choice is made on click/tap.
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onMouseMove={() => {
                if (index !== activeIndex) setActive(index);
              }}
              onClick={() => {
                pick(option);
              }}
            >
              <span className="suggestions__name">
                {option.kind === 'category' ? option.label : option.name}
              </span>
              <span className="suggestions__meta">
                {option.kind === 'category'
                  ? `${plural(option.dishCount, 'dish', 'dishes')} · ${plural(option.orderCount, 'order')}`
                  : plural(option.orderCount, 'order')}
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}
