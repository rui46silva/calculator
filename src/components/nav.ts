export interface NavItem {
  to: string;
  label: string;
  /** Shorter label for the mobile bottom bar. */
  short?: string;
  icon: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Geral',
    items: [
      { to: '/', label: 'Resumo', icon: '◎' },
      { to: '/movimentos', label: 'Movimentos', short: 'Mov.', icon: '±' },
      { to: '/calendario', label: 'Calendário', icon: '▦' },
    ],
  },
  {
    title: 'Orçamento',
    items: [
      { to: '/orcamento', label: 'Despesas fixas', icon: '≡' },
      { to: '/subscricoes', label: 'Subscrições', icon: '↻' },
      { to: '/creditos', label: 'Créditos', icon: '⌂' },
      { to: '/plano', label: 'Plano 50/30/20', short: 'Plano', icon: '%' },
    ],
  },
  {
    title: 'Futuro',
    items: [
      { to: '/investimentos', label: 'Investimentos', short: 'Investir', icon: '▲' },
      { to: '/cenarios', label: 'Cenários', icon: '↗' },
    ],
  },
  {
    title: 'Conta',
    items: [{ to: '/conta', label: 'Conta e partilha', icon: '●' }],
  },
];

/** The four destinations pinned to the mobile bottom bar; everything else lives under "Mais". */
export const MOBILE_PRIMARY = ['/', '/movimentos', '/plano', '/investimentos'];

export const ALL_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);
