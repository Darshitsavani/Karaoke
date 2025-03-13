import React from 'react';
import { Provider } from 'react-redux';
import { store } from './src/redux/store';
import KaraokeScreen from './src/screens/KaraokeScreen';

const App = () => {
  return (
    <Provider store={store}>
      <KaraokeScreen />
    </Provider>
  );
};

export default App;