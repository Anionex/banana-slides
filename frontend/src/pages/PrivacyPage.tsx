import React from 'react';
import { LegalDocumentPage } from './legal/LegalDocumentPage';
import { legalContent } from './legal/legalContent';

export const PrivacyPage: React.FC = () => {
  return <LegalDocumentPage document={legalContent.en.privacy} />;
};

export default PrivacyPage;
