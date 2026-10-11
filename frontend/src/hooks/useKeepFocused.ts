import { useEffect, type RefObject } from 'react';

/** Devices with a mouse or trackpad. On touch screens focusing would pop up the keyboard. */
export const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)';

/** Clicks on these keep their normal behaviour: the field is not refocused. */
const INTERACTIVE = [
  'input',
  'textarea',
  'select',
  'option',
  'optgroup',
  'button',
  'a[href]',
  'label',
  'summary',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
  '[role="button"]',
  '[role="link"]',
  '[role="option"]',
].join(', ');

/**
 * Keeps the search field ready for typing, on devices with a mouse or trackpad only:
 * - it is focused once `enabled` becomes true (when the page is revealed);
 * - a click on a non-interactive part of the page (header, blank space, result text, picture)
 *   puts the focus back, unless the click selected some text;
 * - after a month is picked with the mouse, the focus returns to the field. When the month menu
 *   is used with the keyboard, the focus stays on it, so arrow keys keep working.
 * Keyboard navigation (Tab) is never overridden, nothing is refocused while another control is
 * in use, and focus only moves in response to a user action, so there is no focus loop.
 */
export function useKeepFocused(target: RefObject<HTMLElement | null>, enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !window.matchMedia(FINE_POINTER_QUERY).matches) return;

    const focusTarget = (): void => {
      const element = target.current;
      if (element && document.activeElement !== element) element.focus({ preventScroll: true });
    };
    let lastInput: 'pointer' | 'keyboard' = 'pointer';
    const onPointerDown = (): void => {
      lastInput = 'pointer';
    };
    const onKeyDown = (): void => {
      lastInput = 'keyboard';
    };
    const onClick = (event: MouseEvent): void => {
      if (event.target instanceof Element && event.target.closest(INTERACTIVE)) return;
      if (window.getSelection()?.isCollapsed === false) return; // the user is selecting text
      focusTarget();
    };
    const onChange = (event: Event): void => {
      if (lastInput === 'pointer' && event.target instanceof HTMLSelectElement) focusTarget();
    };

    focusTarget();
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('click', onClick);
    document.addEventListener('change', onChange);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('click', onClick);
      document.removeEventListener('change', onChange);
    };
  }, [enabled, target]);
}
