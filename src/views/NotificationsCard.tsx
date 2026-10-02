'use client';

import { useEffect, useState } from 'react';
import { Card } from '../components/ui';
import { disableNotifications, enableNotifications, notificationsEnabled, notificationsSupported, showTestNotification } from '../lib/notifications';

export function NotificationsCard() {
  const [state, setState] = useState<'loading' | 'unsupported' | 'on' | 'off' | 'denied'>('loading');

  useEffect(() => {
    if (!notificationsSupported()) setState('unsupported');
    else if (Notification.permission === 'denied') setState('denied');
    else setState(notificationsEnabled() ? 'on' : 'off');
  }, []);

  return (
    <Card title="Notificações">
      <p className="muted small">
        Avisos neste dispositivo para pagamentos de hoje e amanhã, orçamentos perto do limite e metas fora de prazo. No iPhone, adiciona
        primeiro a app ao ecrã principal (Partilhar → Adicionar ao ecrã principal).
      </p>
      {state === 'unsupported' && <p className="muted">Este browser não suporta notificações.</p>}
      {state === 'denied' && <p className="status-warn small">As notificações estão bloqueadas nas definições do browser para este site.</p>}
      {state === 'off' && (
        <button
          className="primary"
          onClick={async () => {
            const p = await enableNotifications();
            setState(p === 'granted' ? 'on' : p === 'denied' ? 'denied' : 'off');
            if (p === 'granted') await showTestNotification();
          }}
        >
          Ativar notificações
        </button>
      )}
      {state === 'on' && (
        <div className="preset-row">
          <span className="status status-ok">✓ Ativas neste dispositivo</span>
          <button className="ghost small-btn" onClick={() => void showTestNotification()}>
            Testar
          </button>
          <button
            className="link"
            onClick={() => {
              disableNotifications();
              setState('off');
            }}
          >
            Desativar
          </button>
        </div>
      )}
    </Card>
  );
}
