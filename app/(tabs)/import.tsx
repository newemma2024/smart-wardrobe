import { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator } from "react-native";
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { useWardrobe } from "@/lib/wardrobe-provider";
import { useColors } from "@/hooks/use-colors";
import { Platform } from "react-native";
import { createCategoryFolders, scanImagesInFolder, getImageStats, selectFolder } from "@/lib/folder-manager";
import { CATEGORY_LABELS, CATEGORY_ORDER, ClothingCategory } from "@/types/wardrobe";
import { compressImage, generateThumbnail, saveImageToAppDirectory } from "@/lib/image-utils";

export default function ImportScreen() {
  const colors = useColors();
  const { addClothingItem } = useWardrobe();
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [imageStats, setImageStats] = useState<{ category: string; count: number }[]>([]);
  const [folderStructureCreated, setFolderStructureCreated] = useState(false);

  useEffect(() => {
    // 初始化时检查是否已创建文件夹结构
    checkFolderStructure();
  }, []);

  const checkFolderStructure = async () => {
    if (Platform.OS === 'web') return;

    try {
      const folder = await selectFolder();
      if (folder) {
        setSelectedFolder(folder);
        const stats = await getImageStats(folder);
        setImageStats(stats);
        setFolderStructureCreated(true);
      }
    } catch (error) {
      console.error('Failed to check folder structure:', error);
    }
  };

  const handleCreateFolderStructure = async () => {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    Alert.alert('提示', '此功能仅支持iOS和Android设备');
    return;
  }

    setIsLoading(true);
    try {
      const folder = await selectFolder();
      if (!folder) {
        Alert.alert('错误', '无法选择文件夹');
        setIsLoading(false);
        return;
      }

      const success = await createCategoryFolders(folder);
      if (success) {
        setSelectedFolder(folder);
        setFolderStructureCreated(true);
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        Alert.alert(
          '成功',
          `文件夹结构已创建！\n\n文件夹位置：\n${folder}\n\n请将不同类型的衣物照片复制到对应的子文件夹中，然后点击"扫描导入"按钮。`
        );
      } else {
        Alert.alert('错误', '创建文件夹失败');
      }
    } catch (error) {
      console.error('Failed to create folder structure:', error);
      Alert.alert('错误', '创建文件夹时出错');
    } finally {
      setIsLoading(false);
    }
  };

  const handleScanAndImport = async () => {
    if (!selectedFolder) {
      Alert.alert('提示', '请先创建文件夹结构');
      return;
    }

    setIsLoading(true);
    try {
      const imageMap = await scanImagesInFolder(selectedFolder);
      
      if (imageMap.size === 0) {
        Alert.alert('提示', '未找到任何图片');
        setIsLoading(false);
        return;
      }

      let totalImported = 0;
      let totalFailed = 0;

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
          } catch (error) {
            console.error(`Failed to import image ${imagePath}:`, error);
            totalFailed++;
          }
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        '导入完成',
        `成功导入：${totalImported} 件\n失败：${totalFailed} 件`
      );

      // 刷新统计信息
      const stats = await getImageStats(selectedFolder);
      setImageStats(stats);
    } catch (error) {
      console.error('Failed to import images:', error);
      Alert.alert('错误', '导入失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshStats = async () => {
    if (!selectedFolder) return;

    setIsLoading(true);
    try {
      const stats = await getImageStats(selectedFolder);
      setImageStats(stats);
      Alert.alert('刷新完成', `找到 ${stats.reduce((sum, s) => sum + s.count, 0)} 张图片`);
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

          {/* 步骤1：创建文件夹结构 */}
          <View className="bg-surface rounded-2xl p-4">
            <View className="flex-row items-center mb-3">
              <View 
                style={{ 
                  width: 32, 
                  height: 32, 
                  borderRadius: 16, 
                  backgroundColor: colors.primary,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>1</Text>
              </View>
              <Text className="text-lg font-semibold text-foreground ml-3">
                创建文件夹结构
              </Text>
            </View>
            <Text className="text-sm text-muted mb-4">
              点击下方按钮创建衣物分类文件夹。应用会自动在您的设备上创建以下文件夹：
            </Text>
            
            <View className="bg-background rounded-lg p-3 mb-4">
              {CATEGORY_ORDER.map(category => (
                <Text key={category} className="text-xs text-muted py-1">
                  • {CATEGORY_LABELS[category]}
                </Text>
              ))}
            </View>

            <Pressable
              onPress={handleCreateFolderStructure}
              disabled={isLoading}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.primary,
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
                  {folderStructureCreated ? '重新创建文件夹' : '创建文件夹结构'}
                </Text>
              )}
            </Pressable>

            {selectedFolder && (
              <View className="mt-3 p-2 bg-background rounded-lg">
                <Text className="text-xs text-muted">
                  文件夹位置：
                </Text>
                <Text className="text-xs text-foreground font-mono break-words">
                  {selectedFolder}
                </Text>
              </View>
            )}
          </View>

          {/* 步骤2：复制照片 */}
          {folderStructureCreated && (
            <View className="bg-surface rounded-2xl p-4">
              <View className="flex-row items-center mb-3">
                <View 
                  style={{ 
                    width: 32, 
                    height: 32, 
                    borderRadius: 16, 
                    backgroundColor: colors.primary,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>2</Text>
                </View>
                <Text className="text-lg font-semibold text-foreground ml-3">
                  复制衣物照片
                </Text>
              </View>
              <Text className="text-sm text-muted">
                使用文件管理器将不同类型的衣物照片复制到对应的文件夹中。
              </Text>
            </View>
          )}

          {/* 步骤3：扫描导入 */}
          {folderStructureCreated && (
            <View className="bg-surface rounded-2xl p-4">
              <View className="flex-row items-center mb-3">
                <View 
                  style={{ 
                    width: 32, 
                    height: 32, 
                    borderRadius: 16, 
                    backgroundColor: colors.primary,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>3</Text>
                </View>
                <Text className="text-lg font-semibold text-foreground ml-3">
                  扫描并导入
                </Text>
              </View>

              {imageStats.length > 0 && (
                <View className="bg-background rounded-lg p-3 mb-4">
                  <Text className="text-xs font-semibold text-foreground mb-2">
                    当前统计：
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
                  <Text className="font-semibold text-foreground">
                    刷新统计
                  </Text>
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
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
