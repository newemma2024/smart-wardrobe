import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ClothingItem, Outfit, ClothingCategory } from '@/types/wardrobe';
import * as storage from '@/lib/storage';

interface WardrobeContextType {
  clothingItems: ClothingItem[];
  outfits: Outfit[];
  isLoading: boolean;
  addClothingItem: (item: ClothingItem) => Promise<void>;
  deleteClothingItem: (id: string) => Promise<void>;
  updateClothingItem: (id: string, updates: Partial<ClothingItem>) => Promise<void>;
  addOutfit: (outfit: Outfit) => Promise<void>;
  deleteOutfit: (id: string) => Promise<void>;
  toggleOutfitFavorite: (id: string) => Promise<void>;
  refreshData: () => Promise<void>;
}

const WardrobeContext = createContext<WardrobeContextType | undefined>(undefined);

export function WardrobeProvider({ children }: { children: React.ReactNode }) {
  const [clothingItems, setClothingItems] = useState<ClothingItem[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [items, savedOutfits] = await Promise.all([
        storage.loadClothingItems(),
        storage.loadOutfits(),
      ]);
      setClothingItems(items);
      setOutfits(savedOutfits);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const addClothingItem = useCallback(async (item: ClothingItem) => {
    await storage.addClothingItem(item);
    setClothingItems(prev => [...prev, item]);
  }, []);

  const deleteClothingItem = useCallback(async (id: string) => {
    await storage.deleteClothingItem(id);
    setClothingItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const updateClothingItem = useCallback(async (id: string, updates: Partial<ClothingItem>) => {
    await storage.updateClothingItem(id, updates);
    setClothingItems(prev => 
      prev.map(item => item.id === id ? { ...item, ...updates } : item)
    );
  }, []);

  const addOutfit = useCallback(async (outfit: Outfit) => {
    await storage.addOutfit(outfit);
    setOutfits(prev => [...prev, outfit]);
  }, []);

  const deleteOutfit = useCallback(async (id: string) => {
    await storage.deleteOutfit(id);
    setOutfits(prev => prev.filter(outfit => outfit.id !== id));
  }, []);

  const toggleOutfitFavorite = useCallback(async (id: string) => {
    await storage.toggleOutfitFavorite(id);
    setOutfits(prev => 
      prev.map(outfit => 
        outfit.id === id ? { ...outfit, isFavorite: !outfit.isFavorite } : outfit
      )
    );
  }, []);

  const refreshData = useCallback(async () => {
    await loadData();
  }, [loadData]);

  return (
    <WardrobeContext.Provider
      value={{
        clothingItems,
        outfits,
        isLoading,
        addClothingItem,
        deleteClothingItem,
        updateClothingItem,
        addOutfit,
        deleteOutfit,
        toggleOutfitFavorite,
        refreshData,
      }}
    >
      {children}
    </WardrobeContext.Provider>
  );
}

export function useWardrobe() {
  const context = useContext(WardrobeContext);
  if (!context) {
    throw new Error('useWardrobe must be used within WardrobeProvider');
  }
  return context;
}
