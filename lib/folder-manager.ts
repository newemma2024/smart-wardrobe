import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { ClothingCategory, CATEGORY_LABELS } from '@/types/wardrobe';
import { 
  getSmartWardrobeDownloadPath, 
  initializeSmartWardrobeFolders,
  scanImagesInSmartWardrobeFolder,
  getSmartWardrobeImageStats
} from './file-access';

/**
 * 获取应用的衣物导入文件夹路径
 * 使用 Download/smart-wardrobe 文件夹
 */
export function getWardrobeImportFolder(): string {
  return getSmartWardrobeDownloadPath();
}

/**
 * 初始化并创建衣服分类子文件夹
 * 返回创建的文件夹路径
 */
export async function initializeCategoryFolders(): Promise<string | null> {
  return await initializeSmartWardrobeFolders();
}

/**
 * 扫描文件夹中的所有图片
 */
export async function scanImagesInFolder(folderPath?: string): Promise<Map<ClothingCategory, string[]>> {
  try {
    if (Platform.OS === 'web') {
      console.warn('Web platform does not support folder scanning');
      return new Map();
    }

    // 使用新的扫描函数
    const imageMap = await scanImagesInSmartWardrobeFolder();
    
    // 转换分类名称为 ClothingCategory 类型
    const result = new Map<ClothingCategory, string[]>();
    const categoryMapping: { [key: string]: ClothingCategory } = {
      '外套': 'coat',
      '夹克': 'jacket',
      '上衣': 'top',
      '裤子': 'pants',
      '长裙': 'long-skirt',
      '短裙': 'short-skirt',
      '鞋子': 'shoes',
      '配饰': 'accessory',
    };

    imageMap.forEach((images, categoryLabel) => {
      const category = categoryMapping[categoryLabel];
      if (category) {
        result.set(category, images);
      }
    });

    return result;
  } catch (error) {
    console.error('Failed to scan images:', error);
    return new Map();
  }
}

/**
 * 获取文件夹中的所有图片统计
 */
export async function getImageStats(folderPath?: string): Promise<{ category: string; count: number }[]> {
  try {
    return await getSmartWardrobeImageStats();
  } catch (error) {
    console.error('Failed to get image stats:', error);
    return [];
  }
}

/**
 * 删除已导入的图片文件
 */
export async function deleteImportedImage(imagePath: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      return false;
    }

    const fileInfo = await FileSystem.getInfoAsync(imagePath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(imagePath, { idempotent: true });
      console.log('Deleted imported image:', imagePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to delete imported image:', error);
    return false;
  }
}
