export type ClothingCategory = 
  | 'coat'        // 大衣
  | 'jacket'      // 外套
  | 'top'         // 上衣
  | 'pants'       // 裤子
  | 'long-skirt'  // 长裙
  | 'short-skirt' // 短裙
  | 'shoes'       // 鞋子
  | 'accessory';  // 配饰（帽子、围巾、手套等）

export interface ClothingItem {
  id: string;
  imageUri: string;
  thumbnailUri: string;
  category: ClothingCategory;
  addedAt: number; // timestamp
}

export interface Outfit {
  id: string;
  items: ClothingItem[];
  createdAt: number; // timestamp
  isFavorite: boolean;
}

export const CATEGORY_LABELS: Record<ClothingCategory, string> = {
  'coat': '大衣',
  'jacket': '外套',
  'top': '上衣',
  'pants': '裤子',
  'long-skirt': '长裙',
  'short-skirt': '短裙',
  'shoes': '鞋子',
  'accessory': '配饰',
};

export const CATEGORY_ORDER: ClothingCategory[] = [
  'coat',
  'jacket',
  'top',
  'pants',
  'long-skirt',
  'short-skirt',
  'shoes',
  'accessory',
];
