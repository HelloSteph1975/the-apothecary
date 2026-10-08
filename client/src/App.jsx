import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ToastProvider } from './components/ToastProvider.jsx';
import { ConfirmProvider } from './components/ConfirmProvider.jsx';
import { SettingsProvider } from './components/SettingsProvider.jsx';
import { Layout } from './components/Layout.jsx';
import { Today } from './screens/Today.jsx';
import { Settings } from './screens/Settings.jsx';
import { DrawerSoon } from './screens/DrawerSoon.jsx';
import { NotFound } from './screens/NotFound.jsx';
import { DRAWERS } from './components/Cabinet.jsx';

const soon = DRAWERS.filter(d => d.to !== '/').map(d => ({ path: d.to.slice(1), element: <DrawerSoon title={d.label} /> }));

export const routes = [
  {
    element: <SettingsProvider><Layout /></SettingsProvider>,
    children: [
      { index: true, element: <Today /> },
      ...soon,
      { path: 'settings', element: <Settings /> },
      { path: '*', element: <NotFound /> },
    ],
  },
];

const router = createBrowserRouter(routes);

export function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <RouterProvider router={router} />
      </ConfirmProvider>
    </ToastProvider>
  );
}
