import { fireEvent, screen, within } from '@testing-library/react';

/** The dish search field (a combobox; the month menu is the other one). */
export const searchbox = (): HTMLInputElement =>
  screen.getByRole<HTMLInputElement>('combobox', { name: 'Search your food orders' });

/** Types into the search field (this only lists suggestions; it never selects one). */
export const search = (value: string): void => {
  fireEvent.change(searchbox(), { target: { value } });
};

/** The open suggestion list, or null when it is closed. */
export const suggestionList = (): HTMLElement | null =>
  screen.queryByRole('listbox', { name: 'Suggestions' });

const nameOf = (option: HTMLElement): string =>
  option.querySelector('.suggestions__name')?.textContent ?? '';

/** The visible suggestion names, in order (empty when the list is closed). */
export const suggestionNames = (): string[] => {
  const list = suggestionList();
  return list ? within(list).queryAllByRole('option').map(nameOf) : [];
};

/** The suggestion with this exact visible name. */
export const suggestion = (name: string): HTMLElement => {
  const list = suggestionList();
  const option =
    list &&
    within(list)
      .queryAllByRole('option')
      .find((o) => nameOf(o) === name);
  if (!option) throw new Error(`No suggestion "${name}" in [${suggestionNames().join(', ')}]`);
  return option;
};

/** Types `text`, then clicks the suggestion `name` (the way a mouse or touch user picks one). */
export const choose = (text: string, name: string): void => {
  search(text);
  const option = suggestion(name);
  fireEvent.mouseDown(option);
  fireEvent.click(option);
};
