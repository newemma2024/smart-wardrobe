import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

const THUMBNAIL_SIZE = 300;
const MAX_IMAGE_SIZE = 1200;

/**
 * 请求相册权限
 */
export async function requestMediaLibraryPermission(): Promise<boolean> {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Failed to request media library permission:', error);
    return true; // 在web上允许继续
  }
}

/**
 * 请求相机权限
 */
export async function requestCameraPermission(): Promise<boolean> {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Failed to request camera permission:', error);
    return true; // 在web上允许继续
  }
}

/**
 * 从相册选择单张图片
 */
export async function pickImageFromLibrary(): Promise<string | null> {
  try {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission && Platform.OS !== 'web') {
      console.warn('Media library permission denied');
      return null;
    }

    console.log('Launching image library picker (single)...');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
      aspect: [1, 1],
    });

    console.log('Image picker result:', {
      canceled: result.canceled,
      assetsCount: result.assets?.length,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      console.log('Image selection was canceled or no assets returned');
      return null;
    }

    const uri = result.assets[0].uri;
    console.log('Selected image URI:', uri);
    return uri;
  } catch (error) {
    console.error('Error in pickImageFromLibrary:', error);
    return null;
  }
}

/**
 * 从相册选择多张图片（web环境使用原生HTML input）
 */
export async function pickMultipleImagesFromLibrary(): Promise<string[]> {
  try {
    console.log('Platform:', Platform.OS);
    
    if (Platform.OS === 'web') {
      // 在web环境中使用HTML文件输入
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = 'image/*';

        input.onchange = async (e: any) => {
          const files = e.target.files;
          if (!files || files.length === 0) {
            console.log('No files selected');
            resolve([]);
            return;
          }

          const uris: string[] = [];
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const uri = URL.createObjectURL(file);
            uris.push(uri);
            console.log(`File ${i + 1}: ${file.name}`);
          }

          console.log('Selected files:', uris.length);
          resolve(uris);
        };

        input.click();
      });
    } else {
      // 在原生平台上使用 expo-image-picker
      const hasPermission = await requestMediaLibraryPermission();
      if (!hasPermission) {
        console.warn('Media library permission denied');
        return [];
      }

      console.log('Launching image library picker (multiple)...');
      const result = await (ImagePicker.launchImageLibraryAsync as any)({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
        allowsMultiple: true,
      });

      console.log('Image picker result:', {
        canceled: result.canceled,
        assetsCount: result.assets?.length,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        console.log('Image selection was canceled or no assets returned');
        return [];
      }

      const uris = result.assets.map((asset: any) => asset.uri);
      console.log('Selected image URIs:', uris);
      return uris;
    }
  } catch (error) {
    console.error('Error in pickMultipleImagesFromLibrary:', error);
    return [];
  }
}

/**
 * 使用相机拍照
 */
export async function takePhoto(): Promise<string | null> {
  try {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission && Platform.OS !== 'web') {
      console.warn('Camera permission denied');
      return null;
    }

    console.log('Launching camera...');
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 1,
      aspect: [1, 1],
    });

    console.log('Camera result:', {
      canceled: result.canceled,
      assetsCount: result.assets?.length,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      console.log('Camera was canceled or no assets returned');
      return null;
    }

    const uri = result.assets[0].uri;
    console.log('Captured photo URI:', uri);
    return uri;
  } catch (error) {
    console.error('Error in takePhoto:', error);
    return null;
  }
}

/**
 * 压缩图片
 */
export async function compressImage(uri: string, maxSize: number = MAX_IMAGE_SIZE): Promise<string> {
  try {
    console.log('Compressing image:', uri);
    const manipResult = await manipulateAsync(
      uri,
      [{ resize: { width: maxSize } }],
      { compress: 0.8, format: SaveFormat.JPEG }
    );
    console.log('Compressed image URI:', manipResult.uri);
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
    console.log('Generating thumbnail:', uri);
    const manipResult = await manipulateAsync(
      uri,
      [{ resize: { width: THUMBNAIL_SIZE } }],
      { compress: 0.7, format: SaveFormat.JPEG }
    );
    console.log('Thumbnail URI:', manipResult.uri);
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
    console.log('Saving image to app directory:', { uri, filename });
    
    // 在web环境中，直接返回原始URI
    if (Platform.OS === 'web') {
      console.log('Web platform detected, returning original URI');
      return uri;
    }

    const directory = `${FileSystem.documentDirectory}wardrobe/`;
    const dirInfo = await FileSystem.getInfoAsync(directory);
    
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    }

    const newUri = `${directory}${filename}`;
    await FileSystem.copyAsync({ from: uri, to: newUri });
    console.log('Image saved to:', newUri);
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
    // 在web环境中，无法删除文件
    if (Platform.OS === 'web') {
      console.log('Web platform detected, skipping file deletion');
      return;
    }

    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(uri);
      console.log('Image deleted:', uri);
    }
  } catch (error) {
    console.error('Failed to delete image:', error);
  }
}
