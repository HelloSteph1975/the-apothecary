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
import { Journal } from './screens/journal/Journal.jsx';
import { Gallery } from './screens/journal/Gallery.jsx';
import { JournalTypes } from './screens/journal/JournalTypes.jsx';
import { EntryPage } from './screens/journal/EntryPage.jsx';
import { EntryForm } from './screens/journal/EntryForm.jsx';
import { BatchJournal } from './screens/batches/BatchJournal.jsx';
import { NewBatch } from './screens/batches/NewBatch.jsx';
import { BatchPage } from './screens/batches/BatchPage.jsx';
import { RecordSheet } from './screens/batches/RecordSheet.jsx';
import { Todo } from './screens/todo/Todo.jsx';
import { TaskPage } from './screens/todo/TaskPage.jsx';
import { Calendar } from './screens/calendar/Calendar.jsx';
import { DayPage } from './screens/calendar/DayPage.jsx';
import { Garden } from './screens/garden/Garden.jsx';
import { PlantPage } from './screens/garden/PlantPage.jsx';
import { PlantForm } from './screens/garden/PlantForm.jsx';
import { GardenLog } from './screens/garden/GardenLog.jsx';
import { GardenEntryPage } from './screens/garden/EntryPage.jsx';
import { GardenEntryForm } from './screens/garden/EntryForm.jsx';
import { DRAWERS } from './components/Cabinet.jsx';

// A fresh form per herb, so moving between edit pages doesn't keep the last herb's fields.
function HerbFormRoute() {
  const { id } = useParams();
  return <HerbForm key={id ?? 'new'} />;
}

// Keyed by id so moving between entries reloads the page.
function EntryPageRoute() {
  const { id } = useParams();
  return <EntryPage key={id} />;
}

// A fresh form per entry, so moving between edit pages does not keep the last entry's fields.
function EntryFormRoute() {
  const { id } = useParams();
  return <EntryForm key={id ?? 'new'} />;
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

// Keyed by id so moving between plants reloads the page.
function PlantPageRoute() {
  const { id } = useParams();
  return <PlantPage key={id} />;
}

// Keyed by id so moving between garden entries reloads the page.
function GardenEntryPageRoute() {
  const { id } = useParams();
  return <GardenEntryPage key={id} />;
}

// A fresh form per entry, so moving between edit pages does not keep the last entry's fields.
function GardenEntryFormRoute() {
  const { id } = useParams();
  return <GardenEntryForm key={id ?? 'new'} />;
}

// A fresh form per plant, so moving between edit pages does not keep the last plant's fields.
function PlantFormRoute() {
  const { id } = useParams();
  return <PlantForm key={id ?? 'new'} />;
}

const soon = DRAWERS.filter(d => d.to !== '/' && d.to !== '/cabinet' && d.to !== '/grimoire' && d.to !== '/recipes' && d.to !== '/batches' && d.to !== '/todo' && d.to !== '/calendar' && d.to !== '/journal' && d.to !== '/garden').map(d => ({ path: d.to.slice(1), element: <DrawerSoon title={d.label} /> }));

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
      { path: 'journal', element: <Journal /> },
      { path: 'journal/photos', element: <Gallery /> },
      { path: 'journal/types', element: <JournalTypes /> },
      { path: 'journal/new', element: <EntryFormRoute /> },
      { path: 'journal/:id/edit', element: <EntryFormRoute /> },
      { path: 'journal/:id', element: <EntryPageRoute /> },
      { path: 'batches', element: <BatchJournal /> },
      { path: 'batches/new', element: <NewBatchRoute /> },
      { path: 'batches/:id', element: <BatchPageRoute /> },
      { path: 'batches/:id/sheet', element: <RecordSheetRoute /> },
      { path: 'todo', element: <Todo /> },
      { path: 'todo/:id', element: <TaskPageRoute /> },
      { path: 'calendar', element: <Calendar /> },
      { path: 'calendar/:day', element: <DayPageRoute /> },
      { path: 'garden', element: <Garden /> },
      { path: 'garden/plants/new', element: <PlantFormRoute /> },
      { path: 'garden/plants/:id/edit', element: <PlantFormRoute /> },
      { path: 'garden/plants/:id', element: <PlantPageRoute /> },
      { path: 'garden/log', element: <GardenLog /> },
      { path: 'garden/entries/new', element: <GardenEntryFormRoute /> },
      { path: 'garden/entries/:id/edit', element: <GardenEntryFormRoute /> },
      { path: 'garden/entries/:id', element: <GardenEntryPageRoute /> },
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
