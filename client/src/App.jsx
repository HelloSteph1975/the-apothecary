import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ToastProvider } from './components/ToastProvider.jsx';
import { ConfirmProvider } from './components/ConfirmProvider.jsx';
import { SettingsProvider } from './components/SettingsProvider.jsx';
import { Layout } from './components/Layout.jsx';
import { Today } from './screens/Today.jsx';
import { Settings } from './screens/Settings.jsx';
import { DrawerSoon } from './screens/DrawerSoon.jsx';
import { NotFound } from './screens/NotFound.jsx';
import { Shelves } from './screens/cabinet/Shelves.jsx';
import { ItemForm } from './screens/cabinet/ItemForm.jsx';
import { ItemDetail } from './screens/cabinet/ItemDetail.jsx';
import { Suppliers } from './screens/cabinet/Suppliers.jsx';
import { SupplierForm } from './screens/cabinet/SupplierForm.jsx';
import { SupplierDetail } from './screens/cabinet/SupplierDetail.jsx';
import { DRAWERS } from './components/Cabinet.jsx';

const soon = DRAWERS.filter(d => d.to !== '/' && d.to !== '/cabinet').map(d => ({ path: d.to.slice(1), element: <DrawerSoon title={d.label} /> }));

export const routes = [
  {
    element: <SettingsProvider><Layout /></SettingsProvider>,
    children: [
      { index: true, element: <Today /> },
      { path: 'cabinet', element: <Shelves /> },
      { path: 'cabinet/new', element: <ItemForm /> },
      { path: 'cabinet/items/:id', element: <ItemDetail /> },
      { path: 'cabinet/items/:id/edit', element: <ItemForm /> },
      { path: 'cabinet/suppliers', element: <Suppliers /> },
      { path: 'cabinet/suppliers/new', element: <SupplierForm /> },
      { path: 'cabinet/suppliers/:id', element: <SupplierDetail /> },
      { path: 'cabinet/suppliers/:id/edit', element: <SupplierForm /> },
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
