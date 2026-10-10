import { createBrowserRouter, RouterProvider, useLocation, useParams } from 'react-router-dom';
import { ToastProvider } from './components/ToastProvider.jsx';
import { ConfirmProvider } from './components/ConfirmProvider.jsx';
import { SettingsProvider } from './components/SettingsProvider.jsx';
import { Layout } from './components/Layout.jsx';
import { Today } from './screens/Today.jsx';
import { Settings } from './screens/Settings.jsx';
import { TimingRules } from './screens/settings/TimingRules.jsx';
import { DrawerSoon } from './screens/DrawerSoon.jsx';
import { NotFound } from './screens/NotFound.jsx';
import { Shelves } from './screens/cabinet/Shelves.jsx';
import { ItemForm } from './screens/cabinet/ItemForm.jsx';
import { ItemDetail } from './screens/cabinet/ItemDetail.jsx';
import { Suppliers } from './screens/cabinet/Suppliers.jsx';
import { SupplierForm } from './screens/cabinet/SupplierForm.jsx';
import { SupplierDetail } from './screens/cabinet/SupplierDetail.jsx';
import { Grimoire } from './screens/grimoire/Grimoire.jsx';
import { HerbPage } from './screens/grimoire/HerbPage.jsx';
import { HerbForm } from './screens/grimoire/HerbForm.jsx';
import { RecipeBook } from './screens/recipes/RecipeBook.jsx';
import { RecipeTypes } from './screens/recipes/RecipeTypes.jsx';
import { RecipeForm } from './screens/recipes/RecipeForm.jsx';
import { RecipePage } from './screens/recipes/RecipePage.jsx';
import { BatchJournal } from './screens/batches/BatchJournal.jsx';
import { NewBatch } from './screens/batches/NewBatch.jsx';
import { BatchPage } from './screens/batches/BatchPage.jsx';
import { RecordSheet } from './screens/batches/RecordSheet.jsx';
import { Todo } from './screens/todo/Todo.jsx';
import { TaskPage } from './screens/todo/TaskPage.jsx';
import { Calendar } from './screens/calendar/Calendar.jsx';
import { DayPage } from './screens/calendar/DayPage.jsx';
import { DRAWERS } from './components/Cabinet.jsx';

// A fresh form per herb, so moving between edit pages doesn't keep the last herb's fields.
function HerbFormRoute() {
  const { id } = useParams();
  return <HerbForm key={id ?? 'new'} />;
}

// Keyed by id so moving between recipes resets the scale and page state.
function RecipePageRoute() {
  const { id } = useParams();
  return <RecipePage key={id} />;
}

// A fresh form per recipe, so moving between edit pages does not keep the last recipe's fields.
function RecipeFormRoute() {
  const { id } = useParams();
  return <RecipeForm key={id ?? 'new'} />;
}

// A fresh form for each visit, so a second "Make this recipe" does not keep the last one's fields.
function NewBatchRoute() {
  const { key } = useLocation();
  return <NewBatch key={key} />;
}

// Keyed by id so moving between batches resets the journal edit and the finish dialog.
function BatchPageRoute() {
  const { id } = useParams();
  return <BatchPage key={id} />;
}

// Keyed by id so moving between tasks resets the edit dialog.
function TaskPageRoute() {
  const { id } = useParams();
  return <TaskPage key={id} />;
}

// Keyed by day so moving between days starts fresh.
function DayPageRoute() {
  const { day } = useParams();
  return <DayPage key={day} />;
}

// Keyed by id so moving between batches reloads the sheet.
function RecordSheetRoute() {
  const { id } = useParams();
  return <RecordSheet key={id} />;
}

const soon = DRAWERS.filter(d => d.to !== '/' && d.to !== '/cabinet' && d.to !== '/grimoire' && d.to !== '/recipes' && d.to !== '/batches' && d.to !== '/todo' && d.to !== '/calendar').map(d => ({ path: d.to.slice(1), element: <DrawerSoon title={d.label} /> }));

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
      { path: 'grimoire', element: <Grimoire /> },
      { path: 'grimoire/new', element: <HerbFormRoute /> },
      { path: 'grimoire/:id', element: <HerbPage /> },
      { path: 'grimoire/:id/edit', element: <HerbFormRoute /> },
      { path: 'recipes', element: <RecipeBook /> },
      { path: 'recipes/types', element: <RecipeTypes /> },
      { path: 'recipes/new', element: <RecipeFormRoute /> },
      { path: 'recipes/:id/edit', element: <RecipeFormRoute /> },
      { path: 'recipes/:id', element: <RecipePageRoute /> },
      { path: 'batches', element: <BatchJournal /> },
      { path: 'batches/new', element: <NewBatchRoute /> },
      { path: 'batches/:id', element: <BatchPageRoute /> },
      { path: 'batches/:id/sheet', element: <RecordSheetRoute /> },
      { path: 'todo', element: <Todo /> },
      { path: 'todo/:id', element: <TaskPageRoute /> },
      { path: 'calendar', element: <Calendar /> },
      { path: 'calendar/:day', element: <DayPageRoute /> },
      ...soon,
      { path: 'settings', element: <Settings /> },
      { path: 'settings/timing-rules', element: <TimingRules /> },
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
