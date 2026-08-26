export const STORAGE_KEYS = {
  SYNC_CONFIG: 'sb_sync_config',
  VAT_ENABLED: 'sb_vat_enabled',
  DISCOUNT_ENABLED: 'sb_discount_enabled',
};

export const getItem = <T>(key: string): T | null => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.error(`Error reading ${key} from localStorage`, error);
    return null;
  }
};

export const setItem = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error saving ${key} to localStorage`, error);
  }
};

export const removeItem = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Error removing ${key} from localStorage`, error);
  }
};

export const generateId = () => Math.random().toString(36).slice(2, 9);
