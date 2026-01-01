import { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { useWardrobe } from "@/lib/wardrobe-provider";
import { generateOutfit, replaceOutfitItem } from "@/lib/outfit-generator";
import { Outfit, ClothingItem, CATEGORY_LABELS } from "@/types/wardrobe";
import { useColors } from "@/hooks/use-colors";
import { Platform } from "react-native";

export default function OutfitsScreen() {
  const colors = useColors();
  const { clothingItems, outfits, addOutfit } = useWardrobe();
  const [currentOutfit, setCurrentOutfit] = useState<Outfit | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // 初始加载时生成一套搭配
    if (clothingItems.length > 0 && !currentOutfit) {
      handleGenerateOutfit();
    }
  }, [clothingItems]);

  const handleGenerateOutfit = () => {
    if (isGenerating) return;

    setIsGenerating(true);
    
    // 模拟加载效果
    setTimeout(() => {
      const newOutfit = generateOutfit(clothingItems, outfits);
      
      if (newOutfit) {
        setCurrentOutfit(newOutfit);
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      } else {
        Alert.alert('提示', '衣橱里的衣物不足，请至少添加一件上衣和一件下装');
      }
      
      setIsGenerating(false);
    }, 500);
  };

  const handleSaveOutfit = async () => {
    if (!currentOutfit || isSaving) return;

    setIsSaving(true);
    try {
      const outfitToSave = {
        ...currentOutfit,
        isFavorite: true,
      };
      
      await addOutfit(outfitToSave);
      
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      Alert.alert('成功', '搭配已保存到收藏');
    } catch (error) {
      console.error('Failed to save outfit:', error);
      Alert.alert('错误', '保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReplaceItem = (item: ClothingItem) => {
    if (!currentOutfit) return;

    const newOutfit = replaceOutfitItem(currentOutfit, item, clothingItems);
    
    if (newOutfit) {
      setCurrentOutfit(newOutfit);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } else {
      Alert.alert('提示', `没有其他${CATEGORY_LABELS[item.category]}可以替换`);
    }
  };

  const savedOutfits = outfits.filter(outfit => outfit.isFavorite);

  if (clothingItems.length === 0) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center p-8">
        <Text className="text-lg text-muted text-center mb-2">
          衣橱里还没有衣物
        </Text>
        <Text className="text-sm text-muted text-center">
          请先在"衣橱"页面添加衣物照片
        </Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* 标题 */}
        <View className="p-6 pb-4">
          <Text className="text-2xl font-bold text-foreground">智能搭配</Text>
          <Text className="text-sm text-muted mt-1">为你推荐今日穿搭</Text>
        </View>

        {/* 当前搭配 */}
        <View className="px-6 pb-6">
          <View className="bg-surface rounded-3xl p-6 shadow-sm">
            {isGenerating ? (
              <View className="items-center justify-center py-12">
                <ActivityIndicator size="large" color={colors.primary} />
                <Text className="text-muted mt-4">正在生成搭配...</Text>
              </View>
            ) : currentOutfit ? (
              <View>
                <View className="flex-row flex-wrap gap-3">
                  {currentOutfit.items.map(item => (
                    <Pressable
                      key={item.id}
                      onPress={() => handleReplaceItem(item)}
                      style={({ pressed }) => [
                        { 
                          width: '47%',
                          opacity: pressed ? 0.7 : 1,
                        }
                      ]}
                      className="bg-background rounded-2xl overflow-hidden"
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
                  ))}
                </View>

                <Text className="text-xs text-muted text-center mt-4">
                  点击单品可替换为其他同类衣物
                </Text>
              </View>
            ) : (
              <View className="items-center justify-center py-12">
                <Text className="text-muted">点击下方按钮生成搭配</Text>
              </View>
            )}
          </View>

          {/* 操作按钮 */}
          <View className="flex-row gap-3 mt-4">
            <Pressable
              onPress={handleGenerateOutfit}
              disabled={isGenerating}
              style={({ pressed }) => [
                {
                  flex: 1,
                  backgroundColor: colors.surface,
                  paddingVertical: 16,
                  borderRadius: 16,
                  alignItems: 'center',
                  opacity: pressed ? 0.7 : 1,
                }
              ]}
            >
              <Text className="text-foreground font-semibold">
                {isGenerating ? '生成中...' : '换一套'}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleSaveOutfit}
              disabled={!currentOutfit || isSaving}
              style={({ pressed }) => [
                {
                  flex: 1,
                  backgroundColor: currentOutfit ? colors.primary : colors.surface,
                  paddingVertical: 16,
                  borderRadius: 16,
                  alignItems: 'center',
                  opacity: pressed ? 0.7 : (!currentOutfit ? 0.5 : 1),
                }
              ]}
            >
              <Text 
                className="font-semibold"
                style={{ color: currentOutfit ? '#fff' : colors.muted }}
              >
                {isSaving ? '保存中...' : '♥ 点赞保存'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* 已保存的搭配 */}
        {savedOutfits.length > 0 && (
          <View className="px-6 pb-6">
            <Text className="text-lg font-semibold text-foreground mb-3">
              最近保存的搭配
            </Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12 }}
            >
              {savedOutfits.slice(0, 5).reverse().map(outfit => (
                <View 
                  key={outfit.id}
                  className="bg-surface rounded-2xl p-3 w-40"
                >
                  <View className="flex-row flex-wrap gap-1">
                    {outfit.items.slice(0, 4).map(item => (
                      <Image
                        key={item.id}
                        source={{ uri: item.thumbnailUri }}
                        style={{ 
                          width: outfit.items.length > 2 ? 68 : 140,
                          height: outfit.items.length > 2 ? 68 : 140,
                          borderRadius: 8,
                        }}
                        contentFit="cover"
                      />
                    ))}
                  </View>
                  <Text className="text-xs text-muted mt-2 text-center">
                    {outfit.items.length} 件单品
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
