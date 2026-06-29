import type { Metadata } from 'next';
import AppProviders from '@/components/AppProviders';

export const metadata: Metadata = {
  title: 'Hearing Hope — Customer Lifecycle',
  description: 'Post-sale marketing and milestone reminders',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
