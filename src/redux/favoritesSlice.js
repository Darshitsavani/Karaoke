import { createSlice } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Initial state
const initialState = {
  favorites: [],
};

// Load favorites from AsyncStorage
const loadFavorites = async () => {
  try {
    const storedFavorites = await AsyncStorage.getItem('favorites');
    return storedFavorites ? JSON.parse(storedFavorites) : [];
  } catch (error) {
    console.error('Failed to load favorites:', error);
    return [];
  }
};

// Save favorites to AsyncStorage
const saveFavorites = async (favorites) => {
  try {
    await AsyncStorage.setItem('favorites', JSON.stringify(favorites));
  } catch (error) {
    console.error('Failed to save favorites:', error);
  }
};

const favoritesSlice = createSlice({
  name: 'favorites',
  initialState,
  reducers: {
    // Add a song to favorites
    addFavorite: (state, action) => {
      const song = action.payload;
      if (!state.favorites.some(fav => fav.id === song.id)) {
        state.favorites.push(song);
        saveFavorites(state.favorites);
      }
    },
    // Remove a song from favorites
    removeFavorite: (state, action) => {
      const songId = action.payload;
      state.favorites = state.favorites.filter(fav => fav.id !== songId);
      saveFavorites(state.favorites);
    },
    // Initialize favorites from storage
    setFavorites: (state, action) => {
      state.favorites = action.payload;
    },
  },
});

export const { addFavorite, removeFavorite, setFavorites } = favoritesSlice.actions;

// Thunk to fetch and set favorites on app load
export const initializeFavorites = () => async (dispatch) => {
  const favorites = await loadFavorites();
  dispatch(setFavorites(favorites));
};

export const selectFavorites = (state) => state.favorites.favorites;

export default favoritesSlice.reducer;