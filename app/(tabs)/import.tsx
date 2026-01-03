import { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator, Share } from "react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from 'expo-clipboard';

import { ScreenContainer } from "@/components/screen-container";
import { useWardrobe } from "@/lib/wardrobe-provider";
import { useColors } from "@/hooks/use-colors";
import { Platform } from "react-native";
import { initializeCategoryFolders, scanImagesInFolder, getImageStats, getWardrobeImportFolder, deleteImportedImage } from '@/lib/folder-manager';
import { CATEGORY_LABELS, CATEGORY_ORDER, ClothingCategory } from "@/types/wardrobe";
import { compressImage, generateThumbnail, saveImageToAppDirectory } from "@/lib/image-utils";
import { 
  pickMultipleFilesFromDownload, 
  copyFileToAppDir, 
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
      const folder = await initializeCategoryFolders();
      if (folder) {
        setImportFolder(folder);
        setIsInitialized(true);
        
        // 自动刷新统计
        const stats = await getImageStats();
        setImageStats(stats);
      }
    } catch (error) {
      console.error('Failed to initialize folders:', error);
      Alert.alert('错误', '初始化文件夹失败');
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
      // 使用文件选择器选择多个图片
      const selectedUris = await pickMultipleFilesFromDownload();
      
      if (selectedUris.length === 0) {
        Alert.alert('提示', '未选择任何图片');
        setIsLoading(false);
        return;
      }

      let totalImported = 0;
      let totalFailed = 0;

      for (const uri of selectedUris) {
        try {
          // 压缩图片
          const compressedUri = await compressImage(uri);
          const thumbnailUri = await generateThumbnail(compressedUri);

          const timestamp = Date.now();
          const randomId = Math.random().toString(36).substr(2, 9);
          const imageFilename = `img_${timestamp}_${randomId}.jpg`;
          const thumbnailFilename = `thumb_${timestamp}_${randomId}.jpg`;

          // 保存到应用私有目录
          const savedImageUri = await saveImageToAppDirectory(compressedUri, imageFilename);
          const savedThumbnailUri = await saveImageToAppDirectory(thumbnailUri, thumbnailFilename);

          // 从文件名推断分类(如果可能)
          const fileName = uri.split('/').pop() || '';
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
    if (!importFolder) {
      Alert.alert('提示', '文件夹未初始化');
      return;
    }

    setIsLoading(true);
    try {
      const imageMap = await scanImagesInFolder();
      
      if (imageMap.size === 0) {
        Alert.alert('提示', '未找到任何图片\n\n请将图片复制到smart-wardrobe文件夹的对应分类子文件夹中');
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

      // 如果设置了导入后删除,则删除已导入的图片
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

      // 刷新统计信息
      const stats = await getImageStats();
      setImageStats(stats);
    } catch (error) {
      console.error('Failed to import images:', error);
      Alert.alert('错误', '导入失败,请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshStats = async () => {
    if (!importFolder) return;

    setIsLoading(true);
    try {
      const stats = await getImageStats();
      setImageStats(stats);
      
      const totalCount = stats.reduce((sum, s) => sum + s.count, 0);
      if (totalCount > 0) {
        Alert.alert('刷新完成', `找到 ${totalCount} 张图片`);
      } else {
        Alert.alert('提示', '未找到任何图片\n\n请将图片复制到smart-wardrobe文件夹的对应分类子文件夹中');
      }
    } catch (error) {
      console.error('Failed to refresh stats:', error);
      Alert.alert('错误', '刷新失败');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 从文件路径推断衣服分类
   */
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
    
    // 默认返回上衣
    return 'top';
  };

  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return (
      <ScreenContainer className="items-center justify-center p-6">
        <Text className="text-lg text-muted text-center">
          此功能仅支持iOS和Android设备
        </Text>
        <Text className="text-sm text-muted text-center mt-4">
          请在移动设备上使用此功能
        </Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1">
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 16 }}>
        <View className="gap-6">
          {/* 标题 */}
          <View>
            <Text className="text-2xl font-bold text-foreground mb-2">
              批量导入衣物
            </Text>
            <Text className="text-sm text-muted">
              从Download/smart-wardrobe文件夹导入衣物照片
            </Text>
          </View>

          {/* 重要说明 */}
          {isInitialized && (
            <View className="bg-primary/10 rounded-2xl p-4 border-2 border-primary/20">
              <Text className="text-base font-bold text-foreground mb-3">
                📱 导入说明
              </Text>
              <Text className="text-sm text-foreground leading-6 mb-2">
                本应用已在您的手机{Platform.OS === 'android' ? 'Download' : 'Documents'}文件夹下创建了专门的<Text className="font-bold text-primary">smart-wardrobe</Text>文件夹。
              </Text>
              <Text className="text-sm text-foreground leading-6 mb-2">
                请使用USB将衣服图片按照分类复制到smart-wardrobe文件夹下对应的子文件夹中。
              </Text>
              <Text className="text-sm text-foreground leading-6">
                复制完成后,可以使用<Text className="font-bold text-primary">【自动扫描导入】</Text>批量导入,或使用<Text className="font-bold text-primary">【手动选择导入】</Text>逐个选择图片。
              </Text>
            </View>
          )}

          {/* 文件夹信息 */}
          {isInitialized && (
            <View className="bg-surface rounded-2xl p-4">
              <Text className="text-sm font-semibold text-foreground mb-2">
                smart-wardrobe文件夹路径:
              </Text>
              <View className="bg-background rounded-lg p-3 mb-3">
                <Text className="text-xs text-foreground font-mono" selectable>
                  {importFolder}
                </Text>
              </View>
              
              <Text className="text-xs text-muted mb-3">
                {Platform.OS === 'android' 
                  ? '您可以使用文件管理器访问Download文件夹,找到smart-wardrobe文件夹,将衣服照片复制到对应的分类子文件夹中。'
                  : '您可以使用"文件"应用访问此文件夹,将衣服照片复制到对应的分类子文件夹中。'}
              </Text>

              <View className="flex-row gap-2">
                <Pressable
                  onPress={handleCopyPath}
                  style={({ pressed }) => [
                    {
                      flex: 1,
                      backgroundColor: colors.border,
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 8,
                      alignItems: 'center',
                      opacity: pressed ? 0.7 : 1,
                    }
                  ]}
                >
                  <Text className="text-xs font-semibold text-foreground">
                    复制路径
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleShowFolderHint}
                  style={({ pressed }) => [
                    {
                      flex: 1,
                      backgroundColor: colors.primary,
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 8,
                      alignItems: 'center',
                      opacity: pressed ? 0.7 : 1,
                    }
                  ]}
                >
                  <Text className="text-xs font-semibold" style={{ color: '#fff' }}>
                    查看说明
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* 文件夹结构说明 */}
          {isInitialized && (
            <View className="bg-surface rounded-2xl p-4">
              <Text className="text-sm font-semibold text-foreground mb-3">
                分类文件夹:
              </Text>
              
              <View className="bg-background rounded-lg p-3">
                {CATEGORY_ORDER.map(category => (
                  <Text key={category} className="text-xs text-muted py-1">
                    📁 {CATEGORY_LABELS[category]}
                  </Text>
                ))}
              </View>
              
              <Text className="text-xs text-muted mt-3">
                请将对应类型的衣服图片放入相应的文件夹中
              </Text>
            </View>
          )}

          {/* 手动选择导入 */}
          {isInitialized && (
            <View className="bg-surface rounded-2xl p-4">
              <Text className="text-sm font-semibold text-foreground mb-3">
                方式一: 手动选择导入
              </Text>
              
              <Text className="text-xs text-muted mb-3">
                使用文件选择器手动选择要导入的图片,适合少量图片导入
              </Text>

              <Pressable
                onPress={handlePickAndImport}
                disabled={isLoading}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.primary,
                    paddingVertical: 14,
                    borderRadius: 12,
                    alignItems: 'center',
                    opacity: pressed ? 0.8 : 1,
                  }
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-base font-bold" style={{ color: '#fff' }}>
                    手动选择导入
                  </Text>
                )}
              </Pressable>
            </View>
          )}

          {/* 自动扫描导入 */}
          {isInitialized && (
            <View className="bg-surface rounded-2xl p-4">
              <Text className="text-sm font-semibold text-foreground mb-3">
                方式二: 自动扫描导入
              </Text>

              {imageStats.length > 0 && (
                <View className="bg-background rounded-lg p-3 mb-4">
                  <Text className="text-xs font-semibold text-foreground mb-2">
                    待导入图片统计:
                  </Text>
                  {imageStats.map((stat, idx) => (
                    <View key={idx} className="flex-row justify-between py-1">
                      <Text className="text-xs text-muted">{stat.category}</Text>
                      <Text className="text-xs font-semibold text-primary">
                        {stat.count} 张
                      </Text>
                    </View>
                  ))}
                  <View className="border-t border-border mt-2 pt-2 flex-row justify-between">
                    <Text className="text-xs font-semibold text-foreground">
                      总计
                    </Text>
                    <Text className="text-xs font-semibold text-primary">
                      {imageStats.reduce((sum, s) => sum + s.count, 0)} 张
                    </Text>
                  </View>
                </View>
              )}

              {/* 导入后删除选项 */}
              <Pressable
                onPress={() => setDeleteAfterImport(!deleteAfterImport)}
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    backgroundColor: colors.background,
                    borderRadius: 8,
                    marginBottom: 12,
                    opacity: pressed ? 0.7 : 1,
                  }
                ]}
              >
                <View 
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    borderWidth: 2,
                    borderColor: deleteAfterImport ? colors.primary : colors.border,
                    backgroundColor: deleteAfterImport ? colors.primary : 'transparent',
                    marginRight: 12,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  {deleteAfterImport && (
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>✓</Text>
                  )}
                </View>
                <Text className="text-sm text-foreground">
                  导入后删除源文件
                </Text>
              </Pressable>

              <View className="gap-3">
                <Pressable
                  onPress={handleRefreshStats}
                  disabled={isLoading}
                  style={({ pressed }) => [
                    {
                      backgroundColor: colors.border,
                      paddingVertical: 12,
                      borderRadius: 12,
                      alignItems: 'center',
                      opacity: pressed ? 0.8 : 1,
                    }
                  ]}
                >
                  {isLoading ? (
                    <ActivityIndicator color={colors.foreground} />
                  ) : (
                    <Text className="font-semibold text-foreground">
                      刷新统计
                    </Text>
                  )}
                </Pressable>

                <Pressable
                  onPress={handleScanAndImport}
                  disabled={isLoading || imageStats.length === 0}
                  style={({ pressed }) => [
                    {
                      backgroundColor: imageStats.length === 0 ? colors.muted : colors.primary,
                      paddingVertical: 14,
                      borderRadius: 12,
                      alignItems: 'center',
                      opacity: pressed ? 0.8 : 1,
                    }
                  ]}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-base font-bold" style={{ color: '#fff' }}>
                      自动扫描导入
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}

          {/* 使用说明 */}
          <View className="bg-surface rounded-2xl p-4">
            <Text className="text-sm font-semibold text-foreground mb-2">
              使用步骤:
            </Text>
            <Text className="text-xs text-muted leading-5">
              1. 应用已在{Platform.OS === 'android' ? 'Download' : 'Documents'}文件夹下创建smart-wardrobe文件夹{'\n'}
              2. smart-wardrobe文件夹中包含按衣服分类的子文件夹{'\n'}
              3. 使用USB将衣服照片复制到对应的分类文件夹{'\n'}
              4. 方式一: 点击"手动选择导入"使用文件选择器选择图片{'\n'}
              5. 方式二: 点击"刷新统计"查看待导入图片,然后点击"自动扫描导入"{'\n'}
              6. 可选择导入后自动删除源文件以节省空间
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
