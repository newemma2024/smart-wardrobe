import { ClothingItem, Outfit, ClothingCategory } from '@/types/wardrobe';

/**
 * 搭配生成器
 * 根据已有衣物智能生成搭配建议
 */

// 搭配规则：上装 + 下装 + 可选外套 + 可选配饰
const OUTFIT_RULES = {
  tops: ['top'] as ClothingCategory[],
  bottoms: ['pants', 'long-skirt', 'short-skirt'] as ClothingCategory[],
  outerwear: ['coat', 'jacket'] as ClothingCategory[],
  accessories: ['shoes', 'accessory'] as ClothingCategory[],
};

/**
 * 从数组中随机选择一个元素
 */
function randomPick<T>(array: T[]): T | null {
  if (array.length === 0) return null;
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * 根据分类筛选衣物
 */
function filterByCategories(items: ClothingItem[], categories: ClothingCategory[]): ClothingItem[] {
  return items.filter(item => categories.includes(item.category));
}

/**
 * 生成一套搭配
 */
export function generateOutfit(clothingItems: ClothingItem[], existingOutfits: Outfit[] = []): Outfit | null {
  // 至少需要上装和下装
  const tops = filterByCategories(clothingItems, OUTFIT_RULES.tops);
  const bottoms = filterByCategories(clothingItems, OUTFIT_RULES.bottoms);

  if (tops.length === 0 || bottoms.length === 0) {
    return null;
  }

  // 可选的外套和配饰
  const outerwear = filterByCategories(clothingItems, OUTFIT_RULES.outerwear);
  const accessories = filterByCategories(clothingItems, OUTFIT_RULES.accessories);

  // 尝试生成不重复的搭配（最多尝试20次）
  let attempts = 0;
  const maxAttempts = 20;

  while (attempts < maxAttempts) {
    const selectedItems: ClothingItem[] = [];

    // 必选：上装
    const top = randomPick(tops);
    if (top) selectedItems.push(top);

    // 必选：下装
    const bottom = randomPick(bottoms);
    if (bottom) selectedItems.push(bottom);

    // 可选：外套（50%概率）
    if (outerwear.length > 0 && Math.random() > 0.5) {
      const outer = randomPick(outerwear);
      if (outer) selectedItems.push(outer);
    }

    // 可选：配饰（70%概率，最多2件）
    if (accessories.length > 0 && Math.random() > 0.3) {
      const accessoryCount = Math.min(accessories.length, Math.random() > 0.5 ? 2 : 1);
      const shuffled = [...accessories].sort(() => Math.random() - 0.5);
      selectedItems.push(...shuffled.slice(0, accessoryCount));
    }

    // 检查是否与已有搭配重复
    const isDuplicate = existingOutfits.some(outfit => 
      isSameOutfit(outfit.items, selectedItems)
    );

    if (!isDuplicate) {
      return {
        id: `outfit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        items: selectedItems,
        createdAt: Date.now(),
        isFavorite: false,
      };
    }

    attempts++;
  }

  // 如果尝试多次仍然重复，返回最后一次生成的结果
  const selectedItems: ClothingItem[] = [];
  const top = randomPick(tops);
  if (top) selectedItems.push(top);
  const bottom = randomPick(bottoms);
  if (bottom) selectedItems.push(bottom);

  return {
    id: `outfit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    items: selectedItems,
    createdAt: Date.now(),
    isFavorite: false,
  };
}

/**
 * 判断两套搭配是否相同
 */
function isSameOutfit(items1: ClothingItem[], items2: ClothingItem[]): boolean {
  if (items1.length !== items2.length) return false;
  
  const ids1 = items1.map(item => item.id).sort();
  const ids2 = items2.map(item => item.id).sort();
  
  return ids1.every((id, index) => id === ids2[index]);
}

/**
 * 替换搭配中的某个单品
 */
export function replaceOutfitItem(
  outfit: Outfit,
  itemToReplace: ClothingItem,
  allItems: ClothingItem[]
): Outfit | null {
  // 找到同类别的其他衣物
  const sameCategory = allItems.filter(
    item => item.category === itemToReplace.category && item.id !== itemToReplace.id
  );

  if (sameCategory.length === 0) {
    return null;
  }

  // 随机选择一个替换
  const newItem = randomPick(sameCategory);
  if (!newItem) return null;

  const newItems = outfit.items.map(item => 
    item.id === itemToReplace.id ? newItem : item
  );

  return {
    ...outfit,
    items: newItems,
    id: `outfit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
  };
}

/**
 * 批量生成多套搭配
 */
export function generateMultipleOutfits(
  clothingItems: ClothingItem[],
  count: number,
  existingOutfits: Outfit[] = []
): Outfit[] {
  const outfits: Outfit[] = [];
  const allExisting = [...existingOutfits];

  for (let i = 0; i < count; i++) {
    const outfit = generateOutfit(clothingItems, allExisting);
    if (outfit) {
      outfits.push(outfit);
      allExisting.push(outfit);
    }
  }

  return outfits;
}
