export const CANTEEN = 'Menuflow Campus Canteen';
export const CUSTOMER_ID = 'c-mori';

const MENUS = [
  { id: 'm-teriyaki', name: 'Chicken Teriyaki Rice', short: 'Chicken Teriyaki', price: 25000, capacity: 20, art: 'teriyaki', active: true, allergensKnown: true,
    desc: 'Nasi dengan ayam teriyaki dan sayuran.', ingredients: ['Ayam', 'Nasi', 'Saus teriyaki (kedelai)', 'Brokoli', 'Wortel', 'Wijen'], allergens: ['soy', 'sesame'], tags: ['chicken'] },
  { id: 'm-beef', name: 'Beef Black Pepper Rice', short: 'Beef Black Pepper', price: 27000, capacity: 15, art: 'beef', active: true, allergensKnown: true,
    desc: 'Nasi dengan daging sapi saus lada hitam.', ingredients: ['Daging sapi', 'Nasi', 'Lada hitam', 'Paprika', 'Bawang bombay', 'Kecap (kedelai)'], allergens: ['soy'], tags: ['beef', 'spicy'] },
  { id: 'm-katsu', name: 'Chicken Katsu Rice', short: 'Chicken Katsu', price: 25000, capacity: 15, art: 'katsu', active: true, allergensKnown: true,
    desc: 'Nasi dengan ayam katsu dan saus pendamping.', ingredients: ['Ayam', 'Nasi', 'Tepung panir (gandum)', 'Telur', 'Saus katsu (kedelai)', 'Kol'], allergens: ['egg', 'wheat', 'soy'], tags: ['chicken'] },
];

// code: T/B/K = teriyaki/beef/katsu. "primary>alt,alt" [restriction]. Order 3 is already confirmed.
const SEED = `T>K|B>T|K>T|T>B|K>T,B|B>K|T>K nobeef|T>B,K|B>T,K|K>B|T>K|T>B egg|B>T|K>T|T>K|B>T,K|K>T|T>B,K|T>K|B>K|K>T,B|T>B|B>T|T>K nospicy|B>T|T>K|B>T,K|T>B,K|K>T|T>K|B>K,T|K>T|T>B|B>T|T>K|B>T,K|T>K,B|B>K|T>K|B>T|T>B|B>T,K|T>K|B>T|T>B,K|B>T|T>K|T>B`.split('|');
const NAMES = ['Andi', 'Sarah', 'Daniel', 'Rina', 'Bayu', 'Putri', 'Fajar', 'Lestari', 'Dimas', 'Nadia', 'Reza', 'Maya', 'Hendra', 'Citra', 'Yoga', 'Wulan', 'Ilham', 'Sinta', 'Rafi', 'Dewi', 'Kevin', 'Anisa', 'Galih', 'Tika', 'Arif', 'Mira', 'Bagas', 'Laras', 'Eko', 'Salsa', 'Rizky', 'Intan', 'Naufal', 'Vina', 'Teguh', 'Alya', 'Farhan', 'Gita', 'Joko', 'Siska', 'Taufik', 'Yuni', 'Adit', 'Bella', 'Cahyo', 'Dina', 'Evan', 'Fitri'];
const CODE = { T: 'm-teriyaki', B: 'm-beef', K: 'm-katsu' };

const pad = n => String(n).padStart(3, '0');
export const isoDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return isoDate(d); };

export function makeSeed() {
  const now = Date.now(), today = isoDate();
  const sessionName = 'Makan Siang';
  const orders = SEED.map((s, i) => {
    const [pair, flag] = s.split(' ');
    const [p, a] = pair.split('>');
    const o = {
      id: `SS-2026-${pad(i + 1)}`, customerId: `c-${pad(i + 1)}`, customerName: NAMES[i], sessionId: 's1', sessionName, canteen: CANTEEN, date: today,
      primary: CODE[p], alts: a.split(',').map(c => CODE[c]), diet: [], allergies: [], otherAllergy: '', notes: '',
      createdAt: now - (SEED.length - i) * 4 * 60000, status: 'pending', allocationType: null, finalMenu: null, finalPrice: null, needsReview: false,
    };
    if (flag === 'nobeef') o.diet = ['no-beef'];
    if (flag === 'nospicy') o.diet = ['no-spicy'];
    if (flag === 'egg') o.allergies = ['egg'];
    if (i === 2) Object.assign(o, { status: 'confirmed', allocationType: 'matched', finalMenu: CODE.K, finalPrice: 25000 });
    return o;
  });
  const past = (id, d, menu, price, status) => ({ id, customerId: CUSTOMER_ID, customerName: 'Mori', sessionId: 'past', sessionName, canteen: CANTEEN, date: addDays(d),
    primary: menu, alts: ['m-teriyaki', 'm-katsu'].filter(x => x !== menu), diet: [], allergies: [], otherAllergy: '', notes: '', createdAt: now + d * 864e5,
    status, allocationType: status === 'completed' ? 'matched' : null, finalMenu: status === 'completed' ? menu : null, finalPrice: status === 'completed' ? price : null, needsReview: false });
  orders.push(past('SS-2025-118', -1, 'm-katsu', 25000, 'completed'), past('SS-2025-097', -3, 'm-teriyaki', 25000, 'completed'), past('SS-2025-081', -6, 'm-beef', 27000, 'cancelled'));

  return {
    version: 2,
    clock: { realStart: now, simStartMin: 9 * 60 + 30 }, // demo clock starts at 09.30 so the 10.30 cutoff is meaningful
    onboarded: false,
    customer: { id: CUSTOMER_ID, name: 'Mori', email: 'mori@kampus.ac.id', phone: '0812-3456-7890', diet: [], allergies: [], otherAllergy: '', notify: { status: true, reminder: true, promo: false } },
    menus: MENUS,
    sessions: [
      { id: 's1', name: 'Makan Siang', meal: 'Lunch', date: today, pickupLocation: 'Counter A, Gedung Kantin Kampus', pickupStart: '12:00', pickupEnd: '13:30', cutoff: '10:30', status: 'open', capacityConfirmed: true,
        menus: MENUS.map(m => ({ menuId: m.id, capacity: m.capacity })) },
      { id: 's2', name: 'Makan Malam', meal: 'Dinner', date: today, pickupLocation: 'Counter B, Gedung Kantin Kampus', pickupStart: '18:00', pickupEnd: '19:30', cutoff: '15:30', status: 'open', capacityConfirmed: false,
        menus: [{ menuId: 'm-teriyaki', capacity: 12 }, { menuId: 'm-katsu', capacity: 12 }] },
      { id: 's0', name: 'Sarapan', meal: 'Breakfast', date: today, pickupLocation: 'Counter A, Gedung Kantin Kampus', pickupStart: '07:00', pickupEnd: '08:30', cutoff: '05:30', status: 'completed', capacityConfirmed: true,
        menus: [{ menuId: 'm-teriyaki', capacity: 10 }] },
      { id: 's3', name: 'Makan Siang (Besok)', meal: 'Lunch', date: addDays(1), pickupLocation: 'Counter A, Gedung Kantin Kampus', pickupStart: '12:00', pickupEnd: '13:30', cutoff: '10:30', status: 'draft', capacityConfirmed: false,
        menus: MENUS.map(m => ({ menuId: m.id, capacity: m.capacity })) },
    ],
    orders,
    notifications: [
      { id: 'n1', to: 'customer', text: 'Selamat datang di Menuflow. Pilih menu yang kamu suka dan biarkan dapur menyiapkannya dengan tepat.', at: now - 36e5, read: false },
      { id: 'n2', to: 'merchant', text: 'Ada 10 pesanan baru untuk sesi Makan Siang.', at: now - 25 * 6e4, read: false },
      { id: 'n3', to: 'merchant', text: 'Kapasitas Chicken Teriyaki hampir penuh.', at: now - 12 * 6e4, read: false },
    ],
    draft: null, preview: null, ui: { selectedSession: 's1' },
  };
}
