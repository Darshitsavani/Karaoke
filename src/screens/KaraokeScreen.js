import React, { useEffect } from 'react';
import { View, Text, FlatList, Button, StyleSheet, TouchableOpacity } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { addFavorite, removeFavorite, initializeFavorites, selectFavorites } from '../redux/favoritesSlice';
import AudioProcessor from '../components/AudioProcessor';

// Mock songs array
const mockSongs = [
    { id: '123', title: 'Shape of You', artist: 'Ed Sheeran' },
    { id: '456', title: 'Bohemian Rhapsody', artist: 'Queen' },
    { id: '789', title: 'Billie Jean', artist: 'Michael Jackson' },
];

const KaraokeScreen = () => {
    const dispatch = useDispatch();
    const favorites = useSelector(selectFavorites);

    // Initialize favorites from AsyncStorage on app load
    useEffect(() => {
        dispatch(initializeFavorites());
    }, [dispatch]);

    // Toggle favorite status
    const toggleFavorite = (song) => {
        const isFavorite = favorites.some(fav => fav.id === song.id);
        if (isFavorite) {
            dispatch(removeFavorite(song.id));
        } else {
            dispatch(addFavorite(song));
        }
    };

    // Render song item
    const renderSongItem = ({ item }) => {
        const isFavorite = favorites.some(fav => fav.id === item.id);
        return (
            <View style={styles.songItem}>
                <View>
                    <Text style={styles.songTitle}>{item.title}</Text>
                    <Text style={styles.songArtist}>{item.artist}</Text>
                </View>
                <TouchableOpacity onPress={() => toggleFavorite(item)} style={[styles.button, { backgroundColor: isFavorite ? '#FF3B30' : '#007AFF' }]}>
                    <Text style={styles.btnTitle}>{isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}</Text>
                </TouchableOpacity>
            </View>
        );
    };

    // Render favorite item
    const renderFavoriteItem = ({ item }) => {
        const isFavorite = favorites.some(fav => fav.id === item.id);
        return (<View style={styles.favoriteItem}>
            <Text style={styles.favoriteTitle}>{item.title} - {item.artist}</Text>
            <TouchableOpacity onPress={() => toggleFavorite(item)} style={[styles.button, { backgroundColor: '#FF3B30' }]}>
                <Text style={styles.btnTitle}>{'Remove'}</Text>
            </TouchableOpacity>
        </View>)
    };

    return (
        <View style={styles.container}>
            <AudioProcessor />
            <Text style={styles.header}>Task 2 Redux</Text>
            <FlatList
                data={mockSongs}
                renderItem={renderSongItem}
                keyExtractor={(item) => item.id}
                style={styles.songList}
            />
            <Text style={styles.favoritesHeader}>Favorites</Text>
            {favorites.length === 0 ? (
                <Text style={styles.noFavorites}>No favorites yet!</Text>
            ) : (
                <FlatList
                    data={favorites}
                    renderItem={renderFavoriteItem}
                    keyExtractor={(item) => item.id}
                    style={styles.favoritesList}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#F5F5F5',
    },
    header: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
        color: '#333',
    },
    songList: {
        flex: 0.5,
    },
    songItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        marginVertical: 5,
        backgroundColor: '#FFF',
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    songTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    btnTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFF',
    },
    songArtist: {
        fontSize: 12,
        color: '#666',
    },
    favoritesHeader: {
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 20,
        marginBottom: 10,
        color: '#333',
    },
    favoritesList: {
        flex: 0.5,
    },
    favoriteItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 10,
        backgroundColor: '#E0E0E0',
        borderRadius: 5,
        marginVertical: 5,
    },
    favoriteTitle: {
        fontSize: 16,
        color: '#333',
    },
    noFavorites: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },
    button: {
        padding: 8,
        borderRadius: 8
    }
});

export default KaraokeScreen;