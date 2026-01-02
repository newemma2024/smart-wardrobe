import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import { ClothingCategory, CATEGORY_LABELS } from '@/types/wardrobe';

/**
 * 让用户选择一个文件夹
 */
export async function selectFolderByUser(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      console.warn('Web platform does not support folder selection');
      return null;
    }

    // 使用DocumentPicker选择文件夹
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/x-directory',
      copyToCacheDirectory: false,
    });

    if (result && 'uri' in result) {
      // 获取文件夹URI
      const folderUri = result.uri as string;
      console.log('Selected folder:', folderUri);
      return folderUri;
    }

    return null;
  } catch (error) {
    console.error('Failed to select folder:', error);
    return null;
  }
}

/**
 * 在指定目录下创建衣服分类子文件夹
 */
export async function createCategoryFolders(baseFolder: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      console.warn('Web platform does not support folder operations');
      return false;
    }

    // 确保基础文件夹存在
    const baseInfo = await FileSystem.getInfoAsync(baseFolder);
    if (!baseInfo.exists) {
      console.warn('Base folder does not exist:', baseFolder);
      return false;
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

    return true;
  } catch (error) {
    console.error('Failed to create category folders:', error);
    return false;
  }
}

/**
 * 扫描文件夹中的所有图片
 */
export async function scanImagesInFolder(folderPath: string): Promise<Map<ClothingCategory, string[]>> {
  try {
    if (Platform.OS === 'web') {
      console.warn('Web platform does not support folder scanning');
      return new Map();
    }

    const result = new Map<ClothingCategory, string[]>();
    const categories: ClothingCategory[] = ['coat', 'jacket', 'top', 'pants', 'long-skirt', 'short-skirt', 'shoes', 'accessory'];
    
    for (const category of categories) {
      const categoryFolder = `${folderPath}/${CATEGORY_LABELS[category]}/`;
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
export async function getImageStats(folderPath: string): Promise<{ category: string; count: number }[]> {
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
