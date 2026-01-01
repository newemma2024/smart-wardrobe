import { useState, useMemo } from "react";
import { View, Text, ScrollView, Pressable, FlatList, Alert, ActivityIndicator, Modal } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { useWardrobe } from "@/lib/wardrobe-provider";
import { ClothingCategory, CATEGORY_LABELS, CATEGORY_ORDER } from "@/types/wardrobe";
import { pickImageFromLibrary, takePhoto, compressImage, generateThumbnail, saveImageToAppDirectory, deleteImage } from "@/lib/image-utils";
import { useColors } from "@/hooks/use-colors";
import { Platform } from "react-native";

interface PendingImage {
  id: string;
  imageUri: string;
  thumbnailUri: string;
  category?: ClothingCategory;
}

export default function WardrobeScreen() {
  const colors = useColors();
  const { clothingItems, isLoading, addClothingItem } = useWardrobe();
  const [selectedCategory, setSelectedCategory] = useState<ClothingCategory | 'all'>('all');
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const filteredItems = useMemo(() => {
    if (selectedCategory === 'all') {
      return clothingItems;
    }
    return clothingItems.filter(item => item.category === selectedCategory);
  }, [clothingItems, selectedCategory]);

  const handleCategoryPress = (category: ClothingCategory | 'all') => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedCategory(category);
  };

  const handleAddPhoto = async () => {
    if (isProcessing || pendingImages.length > 0) return;

    Alert.alert(
      '添加衣物',
      '选择照片来源',
      [
        {
          text: '从相册选择',
          onPress: () => handlePickImage('library'),
        },
        {
          text: '拍照',
          onPress: () => handlePickImage('camera'),
        },
        {
          text: '取消',
          style: 'cancel',
        },
      ]
    );
  };

  const handlePickImage = async (source: 'library' | 'camera') => {
    setIsProcessing(true);
    try {
      const uri = source === 'library' 
        ? await pickImageFromLibrary()
        : await takePhoto();

      if (!uri) {
        setIsProcessing(false);
        return;
      }

      // 压缩图片和生成缩略图
      const compressedUri = await compressImage(uri);
      const thumbnailUri = await generateThumbnail(compressedUri);

      // 保存到应用目录
      const timestamp = Date.now();
      const imageFilename = `img_${timestamp}.jpg`;
      const thumbnailFilename = `thumb_${timestamp}.jpg`;

      const savedImageUri = await saveImageToAppDirectory(compressedUri, imageFilename);
      const savedThumbnailUri = await saveImageToAppDirectory(thumbnailUri, thumbnailFilename);

      // 添加到待处理列表
      const newImage: PendingImage = {
        id: `pending_${Date.now()}`,
        imageUri: savedImageUri,
        thumbnailUri: savedThumbnailUri,
      };

      setPendingImages(prev => [...prev, newImage]);
      setCurrentImageIndex(0);
      setShowCategoryModal(true);
    } catch (error) {
      console.error('Failed to add photo:', error);
      Alert.alert('错误', '添加照片失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectCategory = (category: ClothingCategory) => {
    const newPendingImages = [...pendingImages];
    newPendingImages[currentImageIndex].category = category;
    setPendingImages(newPendingImages);

    if (currentImageIndex < pendingImages.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1);
    } else {
      // 所有图片都分类完成，开始保存
      handleSaveAllItems();
    }
  };

  const handleSkipCategory = () => {
    if (currentImageIndex < pendingImages.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1);
    } else {
      handleSaveAllItems();
    }
  };

  const handleSaveAllItems = async () => {
    setShowCategoryModal(false);
    setIsProcessing(true);

    try {
      let successCount = 0;
      const failedItems: string[] = [];

      for (const pendingImage of pendingImages) {
        if (!pendingImage.category) {
          failedItems.push('未分类的衣物');
          continue;
        }

        try {
          const newItem = {
            id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            imageUri: pendingImage.imageUri,
            thumbnailUri: pendingImage.thumbnailUri,
            category: pendingImage.category,
            addedAt: Date.now(),
          };

          await addClothingItem(newItem);
          successCount++;
        } catch (error) {
          console.error('Failed to save item:', error);
          failedItems.push(pendingImage.category ? CATEGORY_LABELS[pendingImage.category] : '未知');
        }
      }

      // 清空待处理列表
      setPendingImages([]);
      setCurrentImageIndex(0);

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      if (successCount > 0) {
        Alert.alert(
          '成功',
          `已添加 ${successCount} 件衣物到衣橱${failedItems.length > 0 ? `\n失败: ${failedItems.join(', ')}` : ''}`
        );
      } else {
        Alert.alert('错误', '添加衣物失败，请重试');
      }
    } catch (error) {
      console.error('Failed to save items:', error);
      Alert.alert('错误', '保存失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelCategoryPicker = async () => {
    setShowCategoryModal(false);
    
    // 删除所有未分类的图片
    for (const pendingImage of pendingImages) {
      try {
        await deleteImage(pendingImage.imageUri);
        await deleteImage(pendingImage.thumbnailUri);
      } catch (error) {
        console.error('Failed to delete image:', error);
      }
    }
    
    setPendingImages([]);
    setCurrentImageIndex(0);
  };

  const currentPendingImage = pendingImages[currentImageIndex];

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1">
      {/* 分类标签栏 */}
      <View className="border-b border-border">
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
        >
          <Pressable
            onPress={() => handleCategoryPress('all')}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            className={`px-4 py-2 rounded-full mr-2 ${
              selectedCategory === 'all' ? 'bg-primary' : 'bg-surface'
            }`}
          >
            <Text className={`font-medium ${
              selectedCategory === 'all' ? 'text-background' : 'text-foreground'
            }`}>
              全部
            </Text>
          </Pressable>

          {CATEGORY_ORDER.map(category => (
            <Pressable
              key={category}
              onPress={() => handleCategoryPress(category)}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              className={`px-4 py-2 rounded-full mr-2 ${
                selectedCategory === category ? 'bg-primary' : 'bg-surface'
              }`}
            >
              <Text className={`font-medium ${
                selectedCategory === category ? 'text-background' : 'text-foreground'
              }`}>
                {CATEGORY_LABELS[category]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* 衣物网格 */}
      {filteredItems.length === 0 ? (
        <View className="flex-1 items-center justify-center p-8">
          <Text className="text-lg text-muted text-center mb-2">
            {selectedCategory === 'all' ? '衣橱里还没有衣物' : `还没有${CATEGORY_LABELS[selectedCategory as ClothingCategory]}`}
          </Text>
          <Text className="text-sm text-muted text-center">
            点击右下角按钮添加照片
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={{ padding: 16 }}
          columnWrapperStyle={{ gap: 16 }}
          renderItem={({ item }) => (
            <View
              className="bg-surface rounded-2xl overflow-hidden mb-4 flex-1"
            >
              <Image
                source={{ uri: item.thumbnailUri }}
                style={{ width: '100%', aspectRatio: 1 }}
                contentFit="cover"
              />
              <View className="p-2">
                <Text className="text-xs text-muted text-center">
                  {CATEGORY_LABELS[item.category]}
                </Text>
              </View>
            </View>
          )}
        />
      )}

      {/* 分类选择弹窗 */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="fade"
        onRequestClose={handleCancelCategoryPicker}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
          onPress={handleCancelCategoryPicker}
        >
          <Pressable
            style={{
              backgroundColor: colors.surface,
              borderRadius: 24,
              padding: 24,
              width: '100%',
              maxWidth: 400,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            {currentPendingImage && (
              <View>
                <Text className="text-xl font-bold text-foreground mb-4">
                  选择分类 ({currentImageIndex + 1}/{pendingImages.length})
                </Text>

                <Image
                  source={{ uri: currentPendingImage.thumbnailUri }}
                  style={{ 
                    width: '100%', 
                    aspectRatio: 1,
                    borderRadius: 12,
                    marginBottom: 20,
                  }}
                  contentFit="cover"
                />

                <Text className="text-sm text-muted mb-4 text-center">
                  这件衣物属于哪个分类？
                </Text>

                <View style={{ maxHeight: 300 }}>
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {CATEGORY_ORDER.map(category => (
                      <Pressable
                        key={category}
                        onPress={() => handleSelectCategory(category)}
                        style={({ pressed }) => [
                          {
                            backgroundColor: colors.background,
                            paddingVertical: 14,
                            paddingHorizontal: 16,
                            borderRadius: 12,
                            marginBottom: 8,
                            opacity: pressed ? 0.7 : 1,
                          }
                        ]}
                      >
                        <Text className="text-foreground font-medium text-center">
                          {CATEGORY_LABELS[category]}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                <View className="flex-row gap-3 mt-6">
                  <Pressable
                    onPress={handleCancelCategoryPicker}
                    style={({ pressed }) => [
                      {
                        flex: 1,
                        backgroundColor: colors.error,
                        paddingVertical: 14,
                        borderRadius: 12,
                        alignItems: 'center',
                        opacity: pressed ? 0.7 : 1,
                      }
                    ]}
                  >
                    <Text className="font-medium" style={{ color: '#fff' }}>
                      取消
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handleSkipCategory}
                    style={({ pressed }) => [
                      {
                        flex: 1,
                        backgroundColor: colors.muted,
                        paddingVertical: 14,
                        borderRadius: 12,
                        alignItems: 'center',
                        opacity: pressed ? 0.7 : 1,
                      }
                    ]}
                  >
                    <Text className="font-medium text-background">
                      跳过
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* 添加按钮 */}
      <Pressable
        onPress={handleAddPhoto}
        disabled={isProcessing || pendingImages.length > 0}
        style={({ pressed }) => [
          {
            position: 'absolute',
            right: 20,
            bottom: 20,
            width: 60,
            height: 60,
            borderRadius: 30,
            backgroundColor: colors.primary,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
            transform: [{ scale: pressed ? 0.95 : 1 }],
            opacity: (isProcessing || pendingImages.length > 0) ? 0.5 : 1,
          }
        ]}
      >
        {isProcessing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: '#fff', fontSize: 32, fontWeight: '300' }}>+</Text>
        )}
      </Pressable>
    </ScreenContainer>
  );
}
