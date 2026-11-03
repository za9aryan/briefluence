'use client';
import { Button, Card, CardHeader, Modal, Skeleton, Stack, Text, useToast } from '@briefluence/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { PageHeader } from '@/components/app/AppShell';
import { BrandProfileForm } from '@/components/brand/BrandProfileForm';
import { BrandAboutCard } from '@/components/domain/BrandIdentity';
import { api } from '@/lib/api';
import { ME_KEY } from '@/lib/hooks/session';
import type { BrandProfileDto } from '@/lib/types';

/** The brand's public side: its profile, and a preview of the card bloggers see on briefs. */
export default function BrandAccountPage() {
  const t = useTranslations('account');
  const tc = useTranslations('common');
  const toast = useToast();
  const qc = useQueryClient();
  const [preview, setPreview] = useState(false);
  const brand = useQuery({
    queryKey: ['brand', 'me'],
    queryFn: () => api.get<BrandProfileDto>('/brands/me'),
  });
  return (
    <Stack gap={6}>
      <PageHeader
        title={t('title')}
        description={t('brandLead')}
        actions={
          brand.data && (
            <Button variant="secondary" size="sm" icon="eye" onClick={() => setPreview(true)}>
              {t('preview')}
            </Button>
          )
        }
      />
      <Card>
        <CardHeader title={t('profile')} />
        {brand.isLoading ? (
          <Skeleton className="h-96" />
        ) : (
          <BrandProfileForm
            initial={brand.data}
            submitLabel={tc('save')}
            onSaved={(b) => {
              qc.setQueryData(['brand', 'me'], b);
              void qc.invalidateQueries({ queryKey: ME_KEY });
              toast(tc('saved'));
            }}
          />
        )}
      </Card>
      <Modal
        open={preview}
        onClose={() => setPreview(false)}
        title={t('previewBrandTitle')}
        size="sm"
        closeLabel={tc('close')}
      >
        {brand.data && (
          <Stack gap={4}>
            <Text size="small" tone="muted">
              {t('previewBrandNote')}
            </Text>
            {/* Exactly the card on a brief: the saved profile, not unsaved edits. */}
            <BrandAboutCard brand={brand.data} />
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
