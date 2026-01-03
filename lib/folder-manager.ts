import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { ClothingCategory, CATEGORY_LABELS } from '@/types/wardrobe';

/**
 * 获取应用的衣物导入文件夹路径
 */
export function getWardrobeImportFolder(): string {
  if (Platform.OS === 'web') {
    return '';
  }
  // 使用应用的文档目录
  return `${FileSystem.documentDirectory}WardrobeImport`;
}

/**
 * 初始化并创建衣服分类子文件夹
 * 返回创建的文件夹路径
 */
export async function initializeCategoryFolders(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      console.warn('Web platform does not support folder operations');
      return null;
    }

    const baseFolder = getWardrobeImportFolder();
    
    // 确保基础文件夹存在
    const baseInfo = await FileSystem.getInfoAsync(baseFolder);
    if (!baseInfo.exists) {
      await FileSystem.makeDirectoryAsync(baseFolder, { intermediates: true });
      console.log('Created base folder:', baseFolder);
    }

    // 为每个分类创建子文件夹
    const categories: ClothingCategory[] = ['coat', 'jacket', 'top', 'pants', 'long-skirt', 'short-skirt', 'shoes', 'accessory'];
    
    for (const category of categories) {
      const categoryFolder = `${baseFolder}/${CATEGORY_LABELS[category]}/`;
      const folderInfo = await FileSystem.getInfoAsync(categoryFolder);
      
      if (!folderInfo.exists) {
        await FileSystem.makeDirectoryAsync(categoryFolder, { intermediates: true });
        console.log(`Created folder: ${categoryFolder}`);
      }
    }

    return baseFolder;
  } catch (error) {
    console.error('Failed to initialize category folders:', error);
    return null;
  }
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

    // 如果没有指定文件夹，使用默认的导入文件夹
    const basePath = folderPath || getWardrobeImportFolder();

    const result = new Map<ClothingCategory, string[]>();
    const categories: ClothingCategory[] = ['coat', 'jacket', 'top', 'pants', 'long-skirt', 'short-skirt', 'shoes', 'accessory'];
    
    for (const category of categories) {
      const categoryFolder = `${basePath}/${CATEGORY_LABELS[category]}/`;
      const folderInfo = await FileSystem.getInfoAsync(categoryFolder);
      
      if (folderInfo.exists && folderInfo.isDirectory) {
        try {
          const files = await FileSystem.readDirectoryAsync(categoryFolder);
          const imageFiles = files.filter(file => {
            const lower = file.toLowerCase();
            return lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.gif');
          });
          
          if (imageFiles.length > 0) {
            const imagePaths = imageFiles.map(file => `${categoryFolder}${file}`);
            result.set(category, imagePaths);
            console.log(`Found ${imageFiles.length} images in ${CATEGORY_LABELS[category]}`);
          }
        } catch (error) {
          console.error(`Failed to read folder ${categoryFolder}:`, error);
        }
      }
    }

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
    const imageMap = await scanImagesInFolder(folderPath);
    const stats: { category: string; count: number }[] = [];

    imageMap.forEach((images, category) => {
      stats.push({
        category: CATEGORY_LABELS[category],
        count: images.length,
      });
    });

    return stats;
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
