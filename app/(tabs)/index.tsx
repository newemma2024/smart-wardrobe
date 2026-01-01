import { useState, useMemo } from "react";
import { View, Text, ScrollView, Pressable, FlatList, Alert, ActivityIndicator, Modal, Dimensions } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { useWardrobe } from "@/lib/wardrobe-provider";
import { ClothingCategory, CATEGORY_LABELS, CATEGORY_ORDER } from "@/types/wardrobe";
import { pickImageFromLibrary, pickMultipleImagesFromLibrary, takePhoto, compressImage, generateThumbnail, saveImageToAppDirectory, deleteImage } from "@/lib/image-utils";
import { useColors } from "@/hooks/use-colors";
import { Platform } from "react-native";

interface PendingImage {
  id: string;
  imageUri: string;
  thumbnailUri: string;
}

const SIDEBAR_WIDTH = 100;

export default function WardrobeScreen() {
  const colors = useColors();
  const { clothingItems, isLoading, addClothingItem } = useWardrobe();
  const [selectedCategory, setSelectedCategory] = useState<ClothingCategory | 'all'>('all');
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [selectedCategoryForBatch, setSelectedCategoryForBatch] = useState<ClothingCategory | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

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
          text: '从相册选择多张',
          onPress: () => handlePickMultipleImages(),
        },
        {
          text: '从相册选择单张',
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
      console.log('Starting image pick process:', source);
      const uri = source === 'library' 
        ? await pickImageFromLibrary()
        : await takePhoto();

      console.log('Image URI received:', uri);

      if (!uri) {
        console.log('No URI returned from image picker');
        setIsProcessing(false);
        Alert.alert('提示', '未选择照片');
        return;
      }

      // 处理单张图片
      await processSingleImage(uri);
    } catch (error) {
      console.error('Failed to add photo:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      Alert.alert('错误', `添加照片失败: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePickMultipleImages = async () => {
    setIsProcessing(true);
    try {
      console.log('Starting multiple image pick process...');
      const uris = await pickMultipleImagesFromLibrary();

      console.log('Image URIs received:', uris.length);

      if (!uris || uris.length === 0) {
        console.log('No URIs returned from image picker');
        setIsProcessing(false);
        Alert.alert('提示', '未选择照片');
        return;
      }

      // 处理多张图片
      await processMultipleImages(uris);
    } catch (error) {
      console.error('Failed to add photos:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      Alert.alert('错误', `添加照片失败: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const processSingleImage = async (uri: string) => {
    try {
      console.log('Processing single image...');
      const compressedUri = await compressImage(uri);
      const thumbnailUri = await generateThumbnail(compressedUri);

      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substr(2, 9);
      const imageFilename = `img_${timestamp}_${randomId}.jpg`;
      const thumbnailFilename = `thumb_${timestamp}_${randomId}.jpg`;

      console.log('Saving images to app directory...');
      const savedImageUri = await saveImageToAppDirectory(compressedUri, imageFilename);
      const savedThumbnailUri = await saveImageToAppDirectory(thumbnailUri, thumbnailFilename);

      const newImage: PendingImage = {
        id: `pending_${timestamp}_${randomId}`,
        imageUri: savedImageUri,
        thumbnailUri: savedThumbnailUri,
      };

      setPendingImages([newImage]);
      setSelectedCategoryForBatch(null);
      setShowCategoryModal(true);
    } catch (error) {
      console.error('Failed to process image:', error);
      throw error;
    }
  };

  const processMultipleImages = async (uris: string[]) => {
    try {
      console.log('Processing multiple images:', uris.length);
      const pendingList: PendingImage[] = [];

      for (let i = 0; i < uris.length; i++) {
        try {
          const uri = uris[i];
          console.log(`Processing image ${i + 1}/${uris.length}...`);
          
          const compressedUri = await compressImage(uri);
          const thumbnailUri = await generateThumbnail(compressedUri);

          const timestamp = Date.now();
          const randomId = `${Math.random().toString(36).substr(2, 9)}_${i}`;
          const imageFilename = `img_${timestamp}_${randomId}.jpg`;
          const thumbnailFilename = `thumb_${timestamp}_${randomId}.jpg`;

          const savedImageUri = await saveImageToAppDirectory(compressedUri, imageFilename);
          const savedThumbnailUri = await saveImageToAppDirectory(thumbnailUri, thumbnailFilename);

          pendingList.push({
            id: `pending_${timestamp}_${randomId}`,
            imageUri: savedImageUri,
            thumbnailUri: savedThumbnailUri,
          });
        } catch (error) {
          console.error(`Failed to process image ${i + 1}:`, error);
        }
      }

      if (pendingList.length === 0) {
        Alert.alert('错误', '无法处理任何图片');
        return;
      }

      console.log('All images processed, showing category selection...');
      setPendingImages(pendingList);
      setSelectedCategoryForBatch(null);
      setShowCategoryModal(true);
    } catch (error) {
      console.error('Failed to process images:', error);
      throw error;
    }
  };

  const handleSelectCategory = async (category: ClothingCategory) => {
    if (pendingImages.length === 0) return;

    setShowCategoryModal(false);
    setIsProcessing(true);

    try {
      let successCount = 0;
      const failedCount = pendingImages.length;

      for (const pendingImage of pendingImages) {
        try {
          const newItem = {
            id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            imageUri: pendingImage.imageUri,
            thumbnailUri: pendingImage.thumbnailUri,
            category,
            addedAt: Date.now(),
          };

          await addClothingItem(newItem);
          successCount++;
        } catch (error) {
          console.error('Failed to save item:', error);
        }
      }

      // 清空待处理列表
      setPendingImages([]);
      setSelectedCategoryForBatch(null);

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert('成功', `已添加 ${successCount} 件衣物到衣橱`);
    } catch (error) {
      console.error('Failed to save items:', error);
      Alert.alert('错误', '保存失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelAll = async () => {
    setShowCategoryModal(false);
    
    // 删除所有未处理的图片
    for (const image of pendingImages) {
      try {
        await deleteImage(image.imageUri);
        await deleteImage(image.thumbnailUri);
      } catch (error) {
        console.error('Failed to delete image:', error);
      }
    }
    
    setPendingImages([]);
    setSelectedCategoryForBatch(null);
  };

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.background }}>
      {/* 左侧分类菜单 */}
      <View 
        style={{ 
          width: SIDEBAR_WIDTH, 
          backgroundColor: colors.surface,
          borderRightColor: colors.border,
          borderRightWidth: 1,
        }}
      >
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 12 }}
        >
          <Pressable
            onPress={() => handleCategoryPress('all')}
            style={({ pressed }) => [
              {
                paddingVertical: 12,
                paddingHorizontal: 8,
                opacity: pressed ? 0.7 : 1,
                backgroundColor: selectedCategory === 'all' ? colors.primary : 'transparent',
              }
            ]}
          >
            <Text 
              style={{ 
                fontSize: 11, 
                fontWeight: '500',
                color: selectedCategory === 'all' ? '#fff' : colors.foreground,
                textAlign: 'center',
              }}
              numberOfLines={2}
            >
              全部
            </Text>
          </Pressable>

          {CATEGORY_ORDER.map(category => (
            <Pressable
              key={category}
              onPress={() => handleCategoryPress(category)}
              style={({ pressed }) => [
                {
                  paddingVertical: 12,
                  paddingHorizontal: 8,
                  opacity: pressed ? 0.7 : 1,
                  backgroundColor: selectedCategory === category ? colors.primary : 'transparent',
                }
              ]}
            >
              <Text 
                style={{ 
                  fontSize: 11, 
                  fontWeight: '500',
                  color: selectedCategory === category ? '#fff' : colors.foreground,
                  textAlign: 'center',
                }}
                numberOfLines={2}
              >
                {CATEGORY_LABELS[category]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* 右侧内容区域 */}
      <View style={{ flex: 1 }}>
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
          visible={showCategoryModal && pendingImages.length > 0}
          transparent
          animationType="fade"
          onRequestClose={handleCancelAll}
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 20,
            }}
            onPress={handleCancelAll}
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
              <Text className="text-xl font-bold text-foreground mb-2">
                选择分类
              </Text>
              <Text className="text-sm text-muted mb-4">
                为 {pendingImages.length} 件衣物选择分类
              </Text>

              {/* 显示缩略图预览 */}
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 16 }}
              >
                {pendingImages.slice(0, 5).map((image, idx) => (
                  <Image
                    key={image.id}
                    source={{ uri: image.thumbnailUri }}
                    style={{ 
                      width: 60, 
                      height: 60,
                      borderRadius: 8,
                      marginRight: 8,
                    }}
                    contentFit="cover"
                  />
                ))}
                {pendingImages.length > 5 && (
                  <View
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: 8,
                      backgroundColor: colors.muted,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Text className="text-white font-bold">+{pendingImages.length - 5}</Text>
                  </View>
                )}
              </ScrollView>

              <Text className="text-sm text-muted mb-3 text-center">
                为这些衣物选择分类
              </Text>

              <ScrollView 
                style={{ maxHeight: 240, marginBottom: 16 }}
                showsVerticalScrollIndicator={false}
              >
                {CATEGORY_ORDER.map(category => (
                  <Pressable
                    key={category}
                    onPress={() => handleSelectCategory(category)}
                    style={({ pressed }) => [
                      {
                        backgroundColor: colors.background,
                        paddingVertical: 12,
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

              <Pressable
                onPress={handleCancelAll}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.error,
                    paddingVertical: 12,
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
      </View>
    </View>
  );
}
