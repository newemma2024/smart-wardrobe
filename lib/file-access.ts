import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Alert, Platform } from "react-native";

/**
 * 定义 Download/smart-wardrobe 文件夹路径
 */
export function getSmartWardrobeDownloadPath(): string {
  if (Platform.OS === 'android') {
    return '/storage/emulated/0/Download/smart-wardrobe';
  }
  
  // iOS 没有公共 Download 文件夹,使用应用的 Documents 目录
  if (Platform.OS === 'ios') {
    return `${FileSystem.documentDirectory}smart-wardrobe`;
  }
  
  return '';
}

/**
 * 获取应用私有存储目录
 */
export function getAppPrivateDirectory(): string {
  if (Platform.OS === 'web') {
    return '';
  }
  return `${FileSystem.documentDirectory}wardrobe/`;
}

/**
 * 初始化 Download/smart-wardrobe 文件夹及分类子文件夹
 */
export async function initializeSmartWardrobeFolders(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      console.warn('Web platform does not support folder operations');
      return null;
    }

    const baseFolder = getSmartWardrobeDownloadPath();
    
    // 确保基础文件夹存在
    const baseInfo = await FileSystem.getInfoAsync(baseFolder);
    if (!baseInfo.exists) {
      await FileSystem.makeDirectoryAsync(baseFolder, { intermediates: true });
      console.log('Created base folder:', baseFolder);
    }

    // 创建分类子文件夹
    const categories = ['外套', '夹克', '上衣', '裤子', '长裙', '短裙', '鞋子', '配饰'];
    
    for (const category of categories) {
      const categoryFolder = `${baseFolder}/${category}/`;
      const folderInfo = await FileSystem.getInfoAsync(categoryFolder);
      
      if (!folderInfo.exists) {
        await FileSystem.makeDirectoryAsync(categoryFolder, { intermediates: true });
        console.log(`Created folder: ${categoryFolder}`);
      }
    }

    return baseFolder;
  } catch (error) {
    console.error('Failed to initialize smart-wardrobe folders:', error);
    return null;
  }
}

/**
 * 用户通过系统文件选择器,从 Download/smart-wardrobe 中选择文件
 * 适用于: USB 拷贝后的图片 / 文件
 */
export async function pickFileFromDownload(): Promise<string | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'image/*',
      copyToCacheDirectory: false,
      multiple: false,
    });

    if (result.canceled) {
      return null;
    }

    const asset = result.assets[0];
    return asset.uri;
  } catch (error) {
    console.error('Failed to pick file:', error);
    return null;
  }
}

/**
 * 用户通过系统文件选择器,从 Download/smart-wardrobe 中选择多个文件
 */
export async function pickMultipleFilesFromDownload(): Promise<string[]> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'image/*',
      copyToCacheDirectory: false,
      multiple: true,
    });

    if (result.canceled) {
      return [];
    }

    return result.assets.map(asset => asset.uri);
  } catch (error) {
    console.error('Failed to pick multiple files:', error);
    return [];
  }
}

/**
 * 把选中的文件复制到 App 自己的私有目录
 * 之后 App 内部统一从这里读取,最稳定
 */
export async function copyFileToAppDir(
  sourceUri: string,
  fileName?: string
): Promise<string> {
  try {
    if (Platform.OS === 'web') {
      return sourceUri;
    }

    const appDir = getAppPrivateDirectory();
    const dirInfo = await FileSystem.getInfoAsync(appDir);
    
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(appDir, { intermediates: true });
    }

    const targetName =
      fileName ?? sourceUri.split("/").pop() ?? `file_${Date.now()}`;

    const destUri = appDir + targetName;

    await FileSystem.copyAsync({
      from: sourceUri,
      to: destUri,
    });

    console.log('File copied to app directory:', destUri);
    return destUri;
  } catch (error) {
    console.error('Failed to copy file to app directory:', error);
    throw error;
  }
}

/**
 * 检查 App 私有目录中是否存在文件
 */
export async function fileExistsInAppDir(
  fileName: string
): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      return false;
    }

    const uri = getAppPrivateDirectory() + fileName;
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists;
  } catch (error) {
    console.error('Failed to check file existence:', error);
    return false;
  }
}

/**
 * 读取 App 私有目录中的文件(示例: Base64)
 */
export async function readFileFromAppDir(
  fileName: string
): Promise<string> {
  try {
    if (Platform.OS === 'web') {
      throw new Error('Web platform does not support file reading');
    }

    const uri = getAppPrivateDirectory() + fileName;
    return await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch (error) {
    console.error('Failed to read file from app directory:', error);
    throw error;
  }
}

/**
 * 删除 App 私有目录中的文件
 */
export async function deleteFileFromAppDir(fileName: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      return false;
    }

    const uri = getAppPrivateDirectory() + fileName;
    const fileInfo = await FileSystem.getInfoAsync(uri);
    
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
      console.log('File deleted from app directory:', uri);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Failed to delete file from app directory:', error);
    return false;
  }
}

/**
 * 扫描 Download/smart-wardrobe 文件夹中的所有图片
 * 返回按分类组织的图片路径
 */
export async function scanImagesInSmartWardrobeFolder(): Promise<Map<string, string[]>> {
  try {
    if (Platform.OS === 'web') {
      console.warn('Web platform does not support folder scanning');
      return new Map();
    }

    const basePath = getSmartWardrobeDownloadPath();
    const result = new Map<string, string[]>();
    const categories = ['外套', '夹克', '上衣', '裤子', '长裙', '短裙', '鞋子', '配饰'];
    
    for (const category of categories) {
      const categoryFolder = `${basePath}/${category}/`;
      const folderInfo = await FileSystem.getInfoAsync(categoryFolder);
      
      if (folderInfo.exists && folderInfo.isDirectory) {
        try {
          const files = await FileSystem.readDirectoryAsync(categoryFolder);
          const imageFiles = files.filter(file => {
            const lower = file.toLowerCase();
            return lower.endsWith('.jpg') || lower.endsWith('.jpeg') || 
                   lower.endsWith('.png') || lower.endsWith('.gif');
          });
          
          if (imageFiles.length > 0) {
            const imagePaths = imageFiles.map(file => `${categoryFolder}${file}`);
            result.set(category, imagePaths);
            console.log(`Found ${imageFiles.length} images in ${category}`);
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
 * 获取 Download/smart-wardrobe 文件夹中的图片统计
 */
export async function getSmartWardrobeImageStats(): Promise<{ category: string; count: number }[]> {
  try {
    const imageMap = await scanImagesInSmartWardrobeFolder();
    const stats: { category: string; count: number }[] = [];

    imageMap.forEach((images, category) => {
      stats.push({
        category,
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
 * 给用户的操作提示(可选)
 */
export function showDownloadHint() {
  const path = Platform.OS === 'android' 
    ? '手机 / Download / smart-wardrobe /' 
    : '文件 App / smart-wardrobe /';
    
  Alert.alert(
    "导入图片",
    `请先用 USB 将图片拷贝到:\n\n${path}\n\n然后在文件选择器中选中图片。`,
    [{ text: "知道了" }]
  );
}

/**
 * 显示文件夹路径提示
 */
export function showFolderPathHint() {
  const path = getSmartWardrobeDownloadPath();
  
  Alert.alert(
    "文件夹位置",
    `请将衣服图片按分类复制到:\n\n${path}\n\n分类文件夹: 外套、夹克、上衣、裤子、长裙、短裙、鞋子、配饰`,
    [{ text: "知道了" }]
  );
}
