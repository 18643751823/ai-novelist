import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux'; // 引入 Provider
import { store } from './store'; // 引入 store
import { ThemeProvider, createTheme } from '@mui/material/styles'; // 引入 Material-UI 主题
import CssBaseline from '@mui/material/CssBaseline'; // 引入 CSS 基线
import './index.css';
import App from './App';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faFile, faFolder, faPlus, faCaretRight, faCaretDown } from '@fortawesome/free-solid-svg-icons';

// 将需要的图标添加到库中，这样就可以在任何地方使用它们
library.add(faFile, faFolder, faPlus, faCaretRight, faCaretDown);

// 创建 Material-UI 主题
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <Provider store={store}> {/* 使用 Provider 包裹 App */}
      <ThemeProvider theme={theme}> {/* 使用 ThemeProvider 包裹应用 */}
        <CssBaseline /> {/* 添加 CSS 基线 */}
        <App />
      </ThemeProvider>
    </Provider>
);