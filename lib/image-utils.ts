import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const THUMBNAIL_SIZE = 300;
const MAX_IMAGE_SIZE = 1200;

/**
 * 请求相册权限
 */
export async function requestMediaLibraryPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

/**
 * 请求相机权限
 */
export async function requestCameraPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  return status === 'granted';
}

/**
 * 从相册选择图片
 */
export async function pickImageFromLibrary(): Promise<string | null> {
  const hasPermission = await requestMediaLibraryPermission();
  if (!hasPermission) {
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 1,
  });

  if (result.canceled) {
    return null;
  }

  return result.assets[0].uri;
}

/**
 * 使用相机拍照
 */
export async function takePhoto(): Promise<string | null> {
  const hasPermission = await requestCameraPermission();
  if (!hasPermission) {
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    quality: 1,
  });

  if (result.canceled) {
    return null;
  }

  return result.assets[0].uri;
}

/**
 * 压缩图片
 */
export async function compressImage(uri: string, maxSize: number = MAX_IMAGE_SIZE): Promise<string> {
  try {
    const manipResult = await manipulateAsync(
      uri,
      [{ resize: { width: maxSize } }],
      { compress: 0.8, format: SaveFormat.JPEG }
    );
    return manipResult.uri;
  } catch (error) {
    console.error('Failed to compress image:', error);
    return uri;
  }
}

/**
 * 生成缩略图
 */
export async function generateThumbnail(uri: string): Promise<string> {
  try {
    const manipResult = await manipulateAsync(
      uri,
      [{ resize: { width: THUMBNAIL_SIZE } }],
      { compress: 0.7, format: SaveFormat.JPEG }
    );
    return manipResult.uri;
  } catch (error) {
    console.error('Failed to generate thumbnail:', error);
    return uri;
  }
}

/**
 * 保存图片到应用目录
 */
export async function saveImageToAppDirectory(uri: string, filename: string): Promise<string> {
  try {
    const directory = `${FileSystem.documentDirectory}wardrobe/`;
    const dirInfo = await FileSystem.getInfoAsync(directory);
    
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    }

    const newUri = `${directory}${filename}`;
    await FileSystem.copyAsync({ from: uri, to: newUri });
    return newUri;
  } catch (error) {
    console.error('Failed to save image:', error);
    throw error;
  }
}

/**
 * 删除图片文件
 */
export async function deleteImage(uri: string): Promise<void> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(uri);
    }
  } catch (error) {
    console.error('Failed to delete image:', error);
  }
}
