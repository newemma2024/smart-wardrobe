import { useState, useMemo } from "react";
import { View, Text, ScrollView, Pressable, FlatList, Alert, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { useWardrobe } from "@/lib/wardrobe-provider";
import { ClothingCategory, CATEGORY_LABELS, CATEGORY_ORDER } from "@/types/wardrobe";
import { pickImageFromLibrary, takePhoto, compressImage, generateThumbnail, saveImageToAppDirectory, deleteImage } from "@/lib/image-utils";
import { useColors } from "@/hooks/use-colors";
import { Platform } from "react-native";

export default function WardrobeScreen() {
  const colors = useColors();
  const { clothingItems, isLoading, addClothingItem, deleteClothingItem } = useWardrobe();
  const [selectedCategory, setSelectedCategory] = useState<ClothingCategory | 'all'>('all');
  const [isAdding, setIsAdding] = useState(false);

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
    if (isAdding) return;

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
    setIsAdding(true);
    try {
      const uri = source === 'library' 
        ? await pickImageFromLibrary()
        : await takePhoto();

      if (!uri) {
        setIsAdding(false);
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

      // 显示分类选择
      showCategoryPicker(savedImageUri, savedThumbnailUri);
    } catch (error) {
      console.error('Failed to add photo:', error);
      Alert.alert('错误', '添加照片失败，请重试');
      setIsAdding(false);
    }
  };

  const showCategoryPicker = (imageUri: string, thumbnailUri: string) => {
    const buttons = CATEGORY_ORDER.map(category => ({
      text: CATEGORY_LABELS[category],
      onPress: () => handleSaveItem(imageUri, thumbnailUri, category),
    }));

    buttons.push({
      text: '取消',
      onPress: async () => {
        await deleteImage(imageUri);
        await deleteImage(thumbnailUri);
        setIsAdding(false);
      },
    });

    Alert.alert(
      '选择分类',
      '这件衣物属于哪个分类？',
      buttons as any
    );
  };

  const handleSaveItem = async (imageUri: string, thumbnailUri: string, category: ClothingCategory) => {
    try {
      const newItem = {
        id: `item_${Date.now()}`,
        imageUri,
        thumbnailUri,
        category,
        addedAt: Date.now(),
      };

      await addClothingItem(newItem);
      
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      Alert.alert('成功', '衣物已添加到衣橱');
    } catch (error) {
      console.error('Failed to save item:', error);
      Alert.alert('错误', '保存失败，请重试');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteItem = (id: string, imageUri: string, thumbnailUri: string) => {
    Alert.alert(
      '删除衣物',
      '确定要删除这件衣物吗？',
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteClothingItem(id);
              await deleteImage(imageUri);
              await deleteImage(thumbnailUri);
              
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } catch (error) {
              console.error('Failed to delete item:', error);
              Alert.alert('错误', '删除失败，请重试');
            }
          },
        },
      ]
    );
  };

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
            <Pressable
              onLongPress={() => handleDeleteItem(item.id, item.imageUri, item.thumbnailUri)}
              style={({ pressed }) => [
                { 
                  flex: 1,
                  opacity: pressed ? 0.7 : 1,
                }
              ]}
              className="bg-surface rounded-2xl overflow-hidden mb-4"
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
            </Pressable>
          )}
        />
      )}

      {/* 添加按钮 */}
      <Pressable
        onPress={handleAddPhoto}
        disabled={isAdding}
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
          }
        ]}
      >
        {isAdding ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: '#fff', fontSize: 32, fontWeight: '300' }}>+</Text>
        )}
      </Pressable>
    </ScreenContainer>
  );
}
