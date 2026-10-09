/**
 * SYNTHETIC demo data for Phase 1 development only. Every restaurant, order ID and amount here is
 * invented. No real order data belongs in the frontend; real data arrives from the backend in
 * Phase 2.
 */
type Row = readonly [
  orderId: string,
  date: string,
  time: string,
  restaurant: string,
  item: string,
  qty: number,
  paid: number,
];

const ROWS: readonly Row[] = [
  ['DEMO-1001', '2026-10-06', '13:10', 'Demo Dosa Corner', 'Idly [2 Ps]', 2, 118.0],
  ['DEMO-1002', '2026-10-04', '21:05', 'Sample Pizzeria', 'Margherita Pizza (Medium)', 1, 349.0],
  ['DEMO-1002', '2026-10-04', '21:05', 'Sample Pizzeria', 'Garlic Breadsticks', 1, 129.0],
  [
    'DEMO-1003',
    '2026-10-02',
    '20:40',
    'Imaginary Tandoor',
    'Tandoori Chicken (breast Pcs)',
    1,
    372.5,
  ],
  [
    'DEMO-0901',
    '2026-09-28',
    '20:15',
    'Imaginary Tandoor',
    'Tandoori Chicken (breast Pcs)',
    1,
    366.04,
  ],
  [
    'DEMO-0902',
    '2026-09-25',
    '13:30',
    'Placeholder Biryani House',
    'Chicken Dum Biryani (Serves 1)',
    1,
    289.0,
  ],
  ['DEMO-0903', '2026-09-22', '19:45', 'Fictional Momo Bar', 'Steamed Veg Momos [6 Pcs]', 2, 238.0],
  ['DEMO-0904', '2026-09-20', '22:10', 'Test Burger Co.', 'Classic Veg Burger', 1, 149.0],
  ['DEMO-0904', '2026-09-20', '22:10', 'Test Burger Co.', 'Peri Peri Fries (Large)', 1, 119.0],
  ['DEMO-0904', '2026-09-20', '22:10', 'Test Burger Co.', 'Coke (500 ml)', 1, 60.0],
  ['DEMO-0905', '2026-09-17', '09:20', 'Demo Dosa Corner', 'Masala Dosa', 1, 99.0],
  ['DEMO-0906', '2026-09-14', '21:30', 'Mock Wok', 'Veg Hakka Noodles', 1, 210.0],
  ['DEMO-0907', '2026-09-11', '16:05', 'Sample Sweets', 'Chocolate Brownie', 2, 180.0],
  ['DEMO-0908', '2026-09-08', '20:50', 'Imaginary Tandoor', 'Paneer Tikka (Half)', 1, 240.0],
  ['DEMO-0909', '2026-09-05', '13:00', 'Example Rolls', 'Chicken Shawarma Roll', 2, 260.0],
  ['DEMO-0910', '2026-09-02', '17:40', 'Sample Sweets', 'Rasmalai [2 Pcs]', 1, 120.0],
  ['DEMO-0801', '2026-08-29', '21:15', 'Sample Pizzeria', 'Farmhouse Pizza (Regular)', 1, 299.0],
  [
    'DEMO-0802',
    '2026-08-24',
    '12:45',
    'Placeholder Biryani House',
    'Chicken Dum Biryani (Serves 1)',
    1,
    279.0,
  ],
  [
    'DEMO-0803',
    '2026-08-19',
    '20:00',
    'Fictional Momo Bar',
    'Chicken Fried Momos [8 Pcs]',
    1,
    189.0,
  ],
  ['DEMO-0804', '2026-08-15', '18:30', 'Demo Shakes', 'Mango Lassi', 2, 140.0],
  ['DEMO-0805', '2026-08-11', '09:10', 'Demo Dosa Corner', 'Idly [2 Ps]', 1, 59.0],
  ['DEMO-0806', '2026-08-07', '22:30', 'Test Burger Co.', 'Chicken Zinger Burger', 1, 189.0],
  ['DEMO-0807', '2026-08-03', '19:20', 'Example Rolls', 'Paneer Kathi Roll', 1, 150.0],
  [
    'DEMO-0808',
    '2026-08-01',
    '15:00',
    'Sample Creamery',
    'Belgian Chocolate Ice Cream (Cup)',
    2,
    198.0,
  ],
];

export const DEMO_ORDER_ROWS = ROWS.map(
  ([orderId, orderDate, orderTime, restaurant, itemName, quantity, totalPaid]) => ({
    orderId,
    orderDate,
    orderTime,
    restaurant,
    itemName,
    quantity,
    totalPaid,
    orderStatus: 'Delivered',
  }),
);
