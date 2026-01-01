import { useState } from "react";
import { View, Text, FlatList, Pressable, Alert, Modal } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { useWardrobe } from "@/lib/wardrobe-provider";
import { Outfit, CATEGORY_LABELS } from "@/types/wardrobe";
import { useColors } from "@/hooks/use-colors";
import { Platform } from "react-native";

export default function FavoritesScreen() {
  const colors = useColors();
  const { outfits, deleteOutfit } = useWardrobe();
  const [selectedOutfit, setSelectedOutfit] = useState<Outfit | null>(null);

  const favoriteOutfits = outfits.filter(outfit => outfit.isFavorite);

  const handleOutfitPress = (outfit: Outfit) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedOutfit(outfit);
  };

  const handleDeleteOutfit = (outfit: Outfit) => {
    Alert.alert(
      '删除搭配',
      '确定要删除这套搭配吗？',
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
              await deleteOutfit(outfit.id);
              setSelectedOutfit(null);
              
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } catch (error) {
              console.error('Failed to delete outfit:', error);
              Alert.alert('错误', '删除失败，请重试');
            }
          },
        },
      ]
    );
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays}天前`;
    
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  if (favoriteOutfits.length === 0) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center p-8">
        <Text className="text-lg text-muted text-center mb-2">
          还没有收藏的搭配
        </Text>
        <Text className="text-sm text-muted text-center">
          在"搭配"页面点赞保存喜欢的搭配
        </Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1">
      {/* 标题 */}
      <View className="p-6 pb-4">
        <Text className="text-2xl font-bold text-foreground">我的收藏</Text>
        <Text className="text-sm text-muted mt-1">
          {favoriteOutfits.length} 套搭配
        </Text>
      </View>

      {/* 搭配列表 */}
      <FlatList
        data={favoriteOutfits.reverse()}
        keyExtractor={item => item.id}
        numColumns={2}
        contentContainerStyle={{ padding: 16, paddingTop: 0 }}
        columnWrapperStyle={{ gap: 16 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => handleOutfitPress(item)}
            onLongPress={() => handleDeleteOutfit(item)}
            style={({ pressed }) => [
              { 
                flex: 1,
                opacity: pressed ? 0.7 : 1,
              }
            ]}
            className="bg-surface rounded-2xl overflow-hidden mb-4"
          >
            <View className="p-3">
              <View className="flex-row flex-wrap gap-1">
                {item.items.slice(0, 4).map(clothingItem => (
                  <Image
                    key={clothingItem.id}
                    source={{ uri: clothingItem.thumbnailUri }}
                    style={{ 
                      width: item.items.length > 2 ? 68 : 140,
                      height: item.items.length > 2 ? 68 : 140,
                      borderRadius: 8,
                    }}
                    contentFit="cover"
                  />
                ))}
              </View>
            </View>
            <View className="px-3 pb-3">
              <Text className="text-xs text-muted">
                {item.items.length} 件单品 · {formatDate(item.createdAt)}
              </Text>
            </View>
          </Pressable>
        )}
      />

      {/* 详情弹窗 */}
      <Modal
        visible={selectedOutfit !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedOutfit(null)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
          onPress={() => setSelectedOutfit(null)}
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
            {selectedOutfit && (
              <View>
                <Text className="text-xl font-bold text-foreground mb-4">
                  搭配详情
                </Text>

                <View className="flex-row flex-wrap gap-3 mb-4">
                  {selectedOutfit.items.map(item => (
                    <View 
                      key={item.id}
                      className="bg-background rounded-2xl overflow-hidden"
                      style={{ width: '47%' }}
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
                  ))}
                </View>

                <Text className="text-sm text-muted mb-6 text-center">
                  保存于 {formatDate(selectedOutfit.createdAt)}
                </Text>

                <View className="flex-row gap-3">
                  <Pressable
                    onPress={() => setSelectedOutfit(null)}
                    style={({ pressed }) => [
                      {
                        flex: 1,
                        backgroundColor: colors.background,
                        paddingVertical: 14,
                        borderRadius: 12,
                        alignItems: 'center',
                        opacity: pressed ? 0.7 : 1,
                      }
                    ]}
                  >
                    <Text className="text-foreground font-medium">关闭</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleDeleteOutfit(selectedOutfit)}
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
                      删除
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}
