import { configureStore } from '@reduxjs/toolkit';
import chatReducer from './slices/chatSlice';
import novelReducer from './slices/novelSlice';

export const store = configureStore({
  reducer: {
    chat: chatReducer,
    novel: novelReducer,
  },
});