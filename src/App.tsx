import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { StoreProvider } from './data/store';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Budget } from './pages/Budget';
import { Loans } from './pages/Loans';
import { Subscriptions } from './pages/Subscriptions';
import { Scenarios } from './pages/Scenarios';
import { Investments } from './pages/Investments';
import { Account } from './pages/Account';

export function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="orcamento" element={<Budget />} />
            <Route path="creditos" element={<Loans />} />
            <Route path="subscricoes" element={<Subscriptions />} />
            <Route path="cenarios" element={<Scenarios />} />
            <Route path="investimentos" element={<Investments />} />
            <Route path="conta" element={<Account />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  );
}
