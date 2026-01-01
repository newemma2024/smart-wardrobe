import AsyncStorage from '@react-native-async-storage/async-storage';
import { ClothingItem, Outfit } from '@/types/wardrobe';

const STORAGE_KEYS = {
  CLOTHING_ITEMS: '@wardrobe:clothing_items',
  OUTFITS: '@wardrobe:outfits',
};

// 衣物管理
export async function saveClothingItems(items: ClothingItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.CLOTHING_ITEMS, JSON.stringify(items));
  } catch (error) {
    console.error('Failed to save clothing items:', error);
    throw error;
  }
}

export async function loadClothingItems(): Promise<ClothingItem[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.CLOTHING_ITEMS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load clothing items:', error);
    return [];
  }
}

export async function addClothingItem(item: ClothingItem): Promise<void> {
  const items = await loadClothingItems();
  items.push(item);
  await saveClothingItems(items);
}

export async function deleteClothingItem(id: string): Promise<void> {
  const items = await loadClothingItems();
  const filtered = items.filter(item => item.id !== id);
  await saveClothingItems(filtered);
}

export async function updateClothingItem(id: string, updates: Partial<ClothingItem>): Promise<void> {
  const items = await loadClothingItems();
  const index = items.findIndex(item => item.id === id);
  if (index !== -1) {
    items[index] = { ...items[index], ...updates };
    await saveClothingItems(items);
  }
}

// 搭配管理
export async function saveOutfits(outfits: Outfit[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.OUTFITS, JSON.stringify(outfits));
  } catch (error) {
    console.error('Failed to save outfits:', error);
    throw error;
  }
}

export async function loadOutfits(): Promise<Outfit[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.OUTFITS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load outfits:', error);
    return [];
  }
}

export async function addOutfit(outfit: Outfit): Promise<void> {
  const outfits = await loadOutfits();
  outfits.push(outfit);
  await saveOutfits(outfits);
}

export async function deleteOutfit(id: string): Promise<void> {
  const outfits = await loadOutfits();
  const filtered = outfits.filter(outfit => outfit.id !== id);
  await saveOutfits(filtered);
}

export async function toggleOutfitFavorite(id: string): Promise<void> {
  const outfits = await loadOutfits();
  const index = outfits.findIndex(outfit => outfit.id === id);
  if (index !== -1) {
    outfits[index].isFavorite = !outfits[index].isFavorite;
    await saveOutfits(outfits);
  }
}
