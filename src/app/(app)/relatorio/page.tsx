import { Suspense } from 'react';
import { PrintReport } from '@/views/PrintReport';

export default function Page() {
  return (
    <Suspense>
      <PrintReport />
    </Suspense>
  );
}
