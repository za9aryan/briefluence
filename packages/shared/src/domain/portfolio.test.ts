import { describe, expect, it } from 'vitest';
import { answeredFaq, isPortfolioVisible, portfolioStatusAfterEdit } from './portfolio';

const item = {
  imageUrl: 'https://cdn.example/a.jpg',
  title: 'Story for a cafe',
  description: null,
  linkUrl: null,
};

describe('portfolio', () => {
  it('shows only approved items', () => {
    expect(isPortfolioVisible({ reviewStatus: 'APPROVED' })).toBe(true);
    expect(isPortfolioVisible({ reviewStatus: 'PENDING' })).toBe(false);
    expect(isPortfolioVisible({ reviewStatus: 'REJECTED' })).toBe(false);
  });

  it('sends any content change back to review', () => {
    const approved = { ...item, reviewStatus: 'APPROVED' as const };
    expect(portfolioStatusAfterEdit(approved, { ...item, title: 'New title' })).toBe('PENDING');
    expect(
      portfolioStatusAfterEdit(approved, { ...item, imageUrl: 'https://cdn.example/b.jpg' }),
    ).toBe('PENDING');
    expect(portfolioStatusAfterEdit(approved, { ...item, description: 'More' })).toBe('PENDING');
    expect(portfolioStatusAfterEdit(approved, { ...item, linkUrl: 'https://youtu.be/x' })).toBe(
      'PENDING',
    );
  });

  it('keeps the status when nothing changed', () => {
    expect(portfolioStatusAfterEdit({ ...item, reviewStatus: 'APPROVED' }, { ...item })).toBe(
      'APPROVED',
    );
    expect(portfolioStatusAfterEdit({ ...item, reviewStatus: 'REJECTED' }, { ...item })).toBe(
      'REJECTED',
    );
  });

  it('a fixed rejected item goes back to review', () => {
    expect(
      portfolioStatusAfterEdit({ ...item, reviewStatus: 'REJECTED' }, { ...item, title: 'Fixed' }),
    ).toBe('PENDING');
  });

  it('lists only answered FAQ questions, in order', () => {
    expect(
      answeredFaq({ faqBrandsWorked: null, faqAudience: '  ', faqBrandsWanted: null }),
    ).toEqual([]);
    expect(
      answeredFaq({ faqBrandsWorked: 'Coca-Cola', faqAudience: null, faqBrandsWanted: ' Apple ' }),
    ).toEqual([
      { key: 'brandsWorked', answer: 'Coca-Cola' },
      { key: 'brandsWanted', answer: 'Apple' },
    ]);
  });
});
