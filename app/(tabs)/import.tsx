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

  const handleScanAndImport = async () => {
    if (!importFolder) {
      Alert.alert('提示', '文件夹未初始化');
      return;
    }

    setIsLoading(true);
    try {
      const imageMap = await scanImagesInFolder();
      
      if (imageMap.size === 0) {
        Alert.alert('提示', '未找到任何图片\n\n请将图片复制到对应的分类文件夹中');
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

      // 如果设置了导入后删除，则删除已导入的图片
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
        `成功导入：${totalImported} 件\n失败：${totalFailed} 件${deleteAfterImport ? '\n已删除源文件' : ''}`
      );

      // 刷新统计信息
      const stats = await getImageStats();
      setImageStats(stats);
    } catch (error) {
      console.error('Failed to import images:', error);
      Alert.alert('错误', '导入失败，请重试');
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
        Alert.alert('提示', '未找到任何图片\n\n请将图片复制到对应的分类文件夹中');
      }
    } catch (error) {
      console.error('Failed to refresh stats:', error);
      Alert.alert('错误', '刷新失败');
    } finally {
      setIsLoading(false);
    }
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
              通过文件夹结构批量导入衣物照片
            </Text>
          </View>

          {/* 文件夹信息 */}
          {isInitialized && (
            <View className="bg-surface rounded-2xl p-4">
              <Text className="text-sm font-semibold text-foreground mb-2">
                导入文件夹路径：
              </Text>
              <View className="bg-background rounded-lg p-3 mb-3">
                <Text className="text-xs text-foreground font-mono" selectable>
                  {importFolder}
                </Text>
              </View>
              
              <Text className="text-xs text-muted mb-3">
                请使用电脑通过USB连接设备，或使用文件管理器将衣物照片复制到上述文件夹的对应分类子文件夹中。
              </Text>

              <Pressable
                onPress={handleCopyPath}
                style={({ pressed }) => [
                  {
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
            </View>
          )}

          {/* 文件夹结构说明 */}
          {isInitialized && (
            <View className="bg-surface rounded-2xl p-4">
              <Text className="text-sm font-semibold text-foreground mb-3">
                分类文件夹：
              </Text>
              
              <View className="bg-background rounded-lg p-3">
                {CATEGORY_ORDER.map(category => (
                  <Text key={category} className="text-xs text-muted py-1">
                    📁 {CATEGORY_LABELS[category]}
                  </Text>
                ))}
              </View>
            </View>
          )}

          {/* 统计信息和操作 */}
          {isInitialized && (
            <View className="bg-surface rounded-2xl p-4">
              <Text className="text-sm font-semibold text-foreground mb-3">
                扫描并导入：
              </Text>

              {imageStats.length > 0 && (
                <View className="bg-background rounded-lg p-3 mb-4">
                  <Text className="text-xs font-semibold text-foreground mb-2">
                    待导入图片统计：
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
                      paddingVertical: 12,
                      borderRadius: 12,
                      alignItems: 'center',
                      opacity: pressed ? 0.8 : 1,
                    }
                  ]}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="font-semibold" style={{ color: '#fff' }}>
                      开始导入
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}

          {/* 使用说明 */}
          <View className="bg-surface rounded-2xl p-4">
            <Text className="text-sm font-semibold text-foreground mb-2">
              使用说明：
            </Text>
            <Text className="text-xs text-muted leading-5">
              1. 应用已自动创建导入文件夹和分类子文件夹{'\n'}
              2. 使用电脑通过USB连接手机，或使用文件管理器{'\n'}
              3. 将衣物照片复制到对应的分类文件夹中{'\n'}
              4. 点击"刷新统计"查看待导入的图片数量{'\n'}
              5. 点击"开始导入"将图片导入到衣橱{'\n'}
              6. 可选择导入后自动删除源文件以节省空间
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
