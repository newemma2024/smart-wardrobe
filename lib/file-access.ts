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
 * 初始化文件夹
 * 彻底修复:不再抛出错误,即使失败也静默处理
 */
export async function initializeSmartWardrobeFolders(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return null;
    }

    const baseFolder = getSmartWardrobeDownloadPath();
    
    // 仅在 iOS 上尝试创建,Android 10+ 几乎肯定会失败,所以我们直接跳过或静默处理
    if (Platform.OS === 'ios') {
      try {
        const baseInfo = await FileSystem.getInfoAsync(baseFolder);
        if (!baseInfo.exists) {
          await FileSystem.makeDirectoryAsync(baseFolder, { intermediates: true });
        }
      } catch (e) {
        console.warn('iOS folder creation failed:', e);
      }
    } else if (Platform.OS === 'android') {
      // Android 10+ 无法直接写入 Download,我们只做检查,不做强制创建
      try {
        const baseInfo = await FileSystem.getInfoAsync(baseFolder);
        if (!baseInfo.exists) {
          console.log('Android: Download/smart-wardrobe does not exist. User needs to create it manually.');
        }
      } catch (e) {
        // 静默处理权限错误
        console.log('Android: Permission denied for direct path access, which is expected on Android 10+');
      }
    }

    return baseFolder;
  } catch (error) {
    // 绝对不让这个函数抛出错误
    console.log('Silent catch in initializeSmartWardrobeFolders');
    return getSmartWardrobeDownloadPath();
  }
}

/**
 * 用户通过系统文件选择器选择文件
 */
export async function pickFileFromDownload(): Promise<string | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'image/*',
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled) {
      return null;
    }

    return result.assets[0].uri;
  } catch (error) {
    console.error('Failed to pick file:', error);
    return null;
  }
}

/**
 * 用户通过系统文件选择器选择多个文件
 */
export async function pickMultipleFilesFromDownload(): Promise<string[]> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'image/*',
      copyToCacheDirectory: true,
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
    
    // 确保私有目录存在(私有目录总是可写的)
    try {
      const dirInfo = await FileSystem.getInfoAsync(appDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(appDir, { intermediates: true });
      }
    } catch (e) {
      console.error('Failed to create private app directory:', e);
    }

    const targetName =
      fileName ?? sourceUri.split("/").pop() ?? `file_${Date.now()}`;

    const destUri = appDir + targetName;

    await FileSystem.copyAsync({
      from: sourceUri,
      to: destUri,
    });

    return destUri;
  } catch (error) {
    console.error('Failed to copy file to app directory:', error);
    throw error;
  }
}

/**
 * 扫描文件夹中的所有图片
 */
export async function scanImagesInSmartWardrobeFolder(): Promise<Map<string, string[]>> {
  try {
    if (Platform.OS === 'web') {
      return new Map();
    }

    const basePath = getSmartWardrobeDownloadPath();
    const result = new Map<string, string[]>();
    const categories = ['外套', '夹克', '上衣', '裤子', '长裙', '短裙', '鞋子', '配饰'];
    
    for (const category of categories) {
      const categoryFolder = `${basePath}/${category}/`;
      try {
        const folderInfo = await FileSystem.getInfoAsync(categoryFolder);
        if (folderInfo.exists && folderInfo.isDirectory) {
          const files = await FileSystem.readDirectoryAsync(categoryFolder);
          const imageFiles = files.filter(file => {
            const lower = file.toLowerCase();
            return lower.endsWith('.jpg') || lower.endsWith('.jpeg') || 
                   lower.endsWith('.png') || lower.endsWith('.gif');
          });
          
          if (imageFiles.length > 0) {
            const imagePaths = imageFiles.map(file => `${categoryFolder}${file}`);
            result.set(category, imagePaths);
          }
        }
      } catch (readError) {
        // 静默处理读取错误
      }
    }

    return result;
  } catch (error) {
    return new Map();
  }
}

/**
 * 获取图片统计
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
    return [];
  }
}

/**
 * 给用户的操作提示
 */
export function showDownloadHint() {
  const path = Platform.OS === 'android' 
    ? '手机存储 / Download / smart-wardrobe /' 
    : '文件 App / smart-wardrobe /';
    
  Alert.alert(
    "导入提示",
    `请确保您已手动创建以下文件夹并放入图片:\n\n${path}\n\n分类文件夹: 外套、夹克、上衣、裤子、长裙、短裙、鞋子、配饰`,
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
    `请将衣服图片按分类复制到:\n\n${path}\n\n如果文件夹不存在,请手动创建。`,
    [{ text: "知道了" }]
  );
}
