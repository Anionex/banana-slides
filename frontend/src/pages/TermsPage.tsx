import React from 'react';
import { LegalDocumentPage } from './legal/LegalDocumentPage';
import { legalContent } from './legal/legalContent';

export const TermsPage: React.FC = () => {
  return <LegalDocumentPage document={legalContent.en.terms} />;
};

export default TermsPage;
