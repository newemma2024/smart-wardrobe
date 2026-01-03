import { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator, Share } from "react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from 'expo-clipboard';

import { ScreenContainer } from "@/components/screen-container";
import { useWardrobe } from "@/lib/wardrobe-provider";
import { useColors } from "@/hooks/use-colors";
import { Platform } from "react-native";
import { initializeCategoryFolders, scanImagesInFolder, getImageStats, deleteImportedImage } from '@/lib/folder-manager';
import { CATEGORY_LABELS, CATEGORY_ORDER, ClothingCategory } from "@/types/wardrobe";
import { compressImage, generateThumbnail, saveImageToAppDirectory } from "@/lib/image-utils";
import { 
  pickMultipleFilesFromDownload, 
  showFolderPathHint,
  getSmartWardrobeDownloadPath 
} from '@/lib/file-access';

export default function ImportScreen() {
  const colors = useColors();
  const { addClothingItem } = useWardrobe();
  const [importFolder, setImportFolder] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [imageStats, setImageStats] = useState<{ category: string; count: number }[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [deleteAfterImport, setDeleteAfterImport] = useState(false);

  useEffect(() => {
    // 初始化文件夹结构
    initializeFolders();
  }, []);

  const initializeFolders = async () => {
    setIsLoading(true);
    try {
      // 即使初始化报错(如Android 10+权限问题),我们也继续,因为用户可以手动创建文件夹
      const folder = await initializeCategoryFolders();
      const path = getSmartWardrobeDownloadPath();
      setImportFolder(path);
      setIsInitialized(true);
      
      // 尝试刷新统计
      try {
        const stats = await getImageStats();
        setImageStats(stats);
      } catch (e) {
        console.warn('Failed to get initial stats:', e);
      }
    } catch (error) {
      console.error('Failed to initialize folders:', error);
      // 不再弹窗报错,避免干扰
      setIsInitialized(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyPath = async () => {
    if (!importFolder) return;
    
    try {
      await Clipboard.setStringAsync(importFolder);
      
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      Alert.alert('成功', '文件夹路径已复制到剪贴板');
    } catch (error) {
      console.error('Failed to copy path:', error);
      Alert.alert('错误', '复制路径失败');
    }
  };

  const handleShowFolderHint = () => {
    showFolderPathHint();
  };

  /**
   * 使用文件选择器手动选择图片导入
   */
  const handlePickAndImport = async () => {
    setIsLoading(true);
    try {
      const selectedUris = await pickMultipleFilesFromDownload();
      
      if (selectedUris.length === 0) {
        setIsLoading(false);
        return;
      }

      let totalImported = 0;
      let totalFailed = 0;

      for (const uri of selectedUris) {
        try {
          const compressedUri = await compressImage(uri);
          const thumbnailUri = await generateThumbnail(compressedUri);

          const timestamp = Date.now();
          const randomId = Math.random().toString(36).substr(2, 9);
          const imageFilename = `img_${timestamp}_${randomId}.jpg`;
          const thumbnailFilename = `thumb_${timestamp}_${randomId}.jpg`;

          const savedImageUri = await saveImageToAppDirectory(compressedUri, imageFilename);
          const savedThumbnailUri = await saveImageToAppDirectory(thumbnailUri, thumbnailFilename);

          const category = inferCategoryFromPath(uri);

          const newItem = {
            id: `item_${timestamp}_${randomId}`,
            imageUri: savedImageUri,
            thumbnailUri: savedThumbnailUri,
            category,
            addedAt: Date.now(),
          };

          await addClothingItem(newItem);
          totalImported++;
        } catch (error) {
          console.error(`Failed to import image ${uri}:`, error);
          totalFailed++;
        }
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert(
        '导入完成',
        `成功导入: ${totalImported} 件\n失败: ${totalFailed} 件`
      );
    } catch (error) {
      console.error('Failed to pick and import images:', error);
      Alert.alert('错误', '导入失败,请重试');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 自动扫描并导入文件夹中的所有图片
   */
  const handleScanAndImport = async () => {
    setIsLoading(true);
    try {
      const imageMap = await scanImagesInFolder();
      
      if (imageMap.size === 0) {
        Alert.alert('提示', '未找到任何图片\n\n请确保已在 Download/smart-wardrobe 文件夹下放入图片,或使用"手动选择导入"。');
        setIsLoading(false);
        return;
      }

      let totalImported = 0;
      let totalFailed = 0;
      const importedPaths: string[] = [];

      for (const [category, imagePaths] of imageMap) {
        for (const imagePath of imagePaths) {
          try {
            const compressedUri = await compressImage(imagePath);
            const thumbnailUri = await generateThumbnail(compressedUri);

            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substr(2, 9);
            const imageFilename = `img_${timestamp}_${randomId}.jpg`;
            const thumbnailFilename = `thumb_${timestamp}_${randomId}.jpg`;

            const savedImageUri = await saveImageToAppDirectory(compressedUri, imageFilename);
            const savedThumbnailUri = await saveImageToAppDirectory(thumbnailUri, thumbnailFilename);

            const newItem = {
              id: `item_${timestamp}_${randomId}`,
              imageUri: savedImageUri,
              thumbnailUri: savedThumbnailUri,
              category,
              addedAt: Date.now(),
            };

            await addClothingItem(newItem);
            totalImported++;
            importedPaths.push(imagePath);
          } catch (error) {
            console.error(`Failed to import image ${imagePath}:`, error);
            totalFailed++;
          }
        }
      }

      if (deleteAfterImport && importedPaths.length > 0) {
        for (const path of importedPaths) {
          await deleteImportedImage(path);
        }
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert(
        '导入完成',
        `成功导入: ${totalImported} 件\n失败: ${totalFailed} 件${deleteAfterImport ? '\n已删除源文件' : ''}`
      );

      const stats = await getImageStats();
      setImageStats(stats);
    } catch (error) {
      console.error('Failed to import images:', error);
      Alert.alert('错误', '导入失败,请重试。如果自动扫描失败,请尝试"手动选择导入"。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshStats = async () => {
    setIsLoading(true);
    try {
      const stats = await getImageStats();
      setImageStats(stats);
      
      const totalCount = stats.reduce((sum, s) => sum + s.count, 0);
      if (totalCount > 0) {
        Alert.alert('刷新完成', `找到 ${totalCount} 张图片`);
      } else {
        Alert.alert('提示', '未找到任何图片\n\n请确保已在 Download/smart-wardrobe 文件夹下放入图片。');
      }
    } catch (error) {
      console.error('Failed to refresh stats:', error);
      Alert.alert('提示', '无法读取文件夹。这可能是由于系统权限限制,建议使用"手动选择导入"。');
    } finally {
      setIsLoading(false);
    }
  };

  const inferCategoryFromPath = (path: string): ClothingCategory => {
    const pathLower = path.toLowerCase();
    if (pathLower.includes('外套') || pathLower.includes('coat')) return 'coat';
    if (pathLower.includes('夹克') || pathLower.includes('jacket')) return 'jacket';
    if (pathLower.includes('上衣') || pathLower.includes('top')) return 'top';
    if (pathLower.includes('裤子') || pathLower.includes('pants')) return 'pants';
    if (pathLower.includes('长裙') || pathLower.includes('long-skirt')) return 'long-skirt';
    if (pathLower.includes('短裙') || pathLower.includes('short-skirt')) return 'short-skirt';
    if (pathLower.includes('鞋子') || pathLower.includes('shoes')) return 'shoes';
    if (pathLower.includes('配饰') || pathLower.includes('accessory')) return 'accessory';
    return 'top';
  };

  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return (
      <ScreenContainer className="items-center justify-center p-6">
        <Text className="text-lg text-muted text-center">此功能仅支持iOS和Android设备</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1">
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 16 }}>
        <View className="gap-6">
          <View>
            <Text className="text-2xl font-bold text-foreground mb-2">批量导入衣物</Text>
            <Text className="text-sm text-muted">从 Download/smart-wardrobe 文件夹导入</Text>
          </View>

          <View className="bg-primary/10 rounded-2xl p-4 border-2 border-primary/20">
            <Text className="text-base font-bold text-foreground mb-3">📱 导入说明</Text>
            <Text className="text-sm text-foreground leading-6 mb-2">
              1. 请手动在手机 <Text className="font-bold text-primary">Download</Text> 文件夹下创建 <Text className="font-bold text-primary">smart-wardrobe</Text> 文件夹。
            </Text>
            <Text className="text-sm text-foreground leading-6 mb-2">
              2. 将衣服图片放入该文件夹(或其分类子文件夹)中。
            </Text>
            <Text className="text-sm text-foreground leading-6">
              3. 推荐使用 <Text className="font-bold text-primary">【手动选择导入】</Text>,兼容性最好。
            </Text>
          </View>

          <View className="bg-surface rounded-2xl p-4">
            <Text className="text-sm font-semibold text-foreground mb-2">目标文件夹路径:</Text>
            <View className="bg-background rounded-lg p-3 mb-3">
              <Text className="text-xs text-foreground font-mono" selectable>{importFolder}</Text>
            </View>
            <View className="flex-row gap-2">
              <Pressable onPress={handleCopyPath} className="flex-1 bg-border py-2 rounded-lg items-center">
                <Text className="text-xs font-semibold text-foreground">复制路径</Text>
              </Pressable>
              <Pressable onPress={handleShowFolderHint} className="flex-1 bg-primary py-2 rounded-lg items-center">
                <Text className="text-xs font-semibold text-white">查看说明</Text>
              </Pressable>
            </View>
          </View>

          <View className="bg-surface rounded-2xl p-4">
            <Text className="text-sm font-semibold text-foreground mb-3">方式一: 手动选择导入 (推荐)</Text>
            <Text className="text-xs text-muted mb-3">直接从 smart-wardrobe 文件夹中选择图片,无权限问题。</Text>
            <Pressable onPress={handlePickAndImport} disabled={isLoading} className="bg-primary py-4 rounded-xl items-center">
              {isLoading ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-bold text-white">手动选择导入</Text>}
            </Pressable>
          </View>

          <View className="bg-surface rounded-2xl p-4">
            <Text className="text-sm font-semibold text-foreground mb-3">方式二: 自动扫描导入</Text>
            <Text className="text-xs text-muted mb-3">自动扫描分类文件夹。注意:部分 Android 系统可能因权限限制无法扫描。</Text>
            
            {imageStats.length > 0 && (
              <View className="bg-background rounded-lg p-3 mb-4">
                {imageStats.map((stat, idx) => (
                  <View key={idx} className="flex-row justify-between py-1">
                    <Text className="text-xs text-muted">{stat.category}</Text>
                    <Text className="text-xs font-semibold text-primary">{stat.count} 张</Text>
                  </View>
                ))}
              </View>
            )}

            <View className="gap-3">
              <Pressable onPress={handleRefreshStats} disabled={isLoading} className="bg-border py-3 rounded-xl items-center">
                <Text className="font-semibold text-foreground">刷新统计</Text>
              </Pressable>
              <Pressable onPress={handleScanAndImport} disabled={isLoading || imageStats.length === 0} className="bg-primary py-4 rounded-xl items-center">
                <Text className="text-base font-bold text-white">自动扫描导入</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
