export * from './contracts/api.js';
export * from './contracts/insights.js';
export * from './contracts/order.js';
export { toDisplayName } from './lib/display-name.js';
export {
  CATEGORY_SEARCH_TERMS,
  categorizeDish,
  DISH_CATEGORIES,
  DISH_CATEGORY_OVERRIDES,
  dishTypeOf,
  type DishCategory,
} from './lib/dish-category.js';
export {
  artFallbacks,
  categorize,
  FOOD_ART_RULES,
  FOOD_CATEGORIES,
  type FoodCategory,
} from './lib/food-category.js';
export {
  inMonth,
  listMonths,
  matchesQuery,
  placeholderNames,
  foodNameKey,
  suggest,
  searchSelection,
  selectionOf,
  selectionText,
  categoryLabel,
  MAX_CATEGORY_SUGGESTIONS,
  MAX_DISH_SUGGESTIONS,
  type SearchOutcome,
  type SearchSelection,
  type Suggestion,
} from './lib/food-search.js';
export { paiseToRupees, parseRupeesToPaise, roundPaiseToRupees } from './lib/money.js';
export { toPublicOrders } from './lib/public-orders.js';
export { categorizeStatus, isCountedOrder } from './lib/order-status.js';
