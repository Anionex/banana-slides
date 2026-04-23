import React, { useEffect } from 'react';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { legalContent, type LegalDocument } from './legalContent';

type LegalDocumentPageProps = {
  document: LegalDocument;
};

export const LegalDocumentPage: React.FC<LegalDocumentPageProps> = ({ document }) => {
  const location = useLocation();
  const locale = legalContent.en;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [document.slug]);

  return (
    <div className="min-h-screen bg-[#fcfcfa] text-slate-900">
      <header className="border-b border-black/[0.08] bg-[#fcfcfa]/96 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-10">
          <Link to="/" className="min-w-0 transition-opacity hover:opacity-75">
            <div className="text-[15px] font-semibold tracking-[-0.02em] text-slate-950">
              {locale.brand}
            </div>
            <div className="mt-0.5 text-[11px] uppercase tracking-[0.22em] text-slate-400">
              Legal
            </div>
          </Link>

          <div className="flex items-center gap-5 text-sm text-slate-500">
            <Link
              to={document.slug === 'privacy' ? '/terms' : '/privacy'}
              className="transition-colors hover:text-slate-950"
            >
              {document.slug === 'privacy' ? locale.switchTerms : locale.switchPrivacy}
            </Link>
            <Link
              to="/register"
              className="transition-colors hover:text-slate-950"
            >
              {locale.openApp}
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 lg:px-10 lg:pt-14">
        <div className="grid gap-12 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-16">
          <aside className="lg:sticky lg:top-10 lg:self-start">
            <div className="border-b border-black/[0.08] pb-6 lg:border-b-0 lg:pb-0">
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                {document.tocLabel}
              </div>
              <nav className="mt-5 space-y-2">
                {document.sections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="block text-sm leading-6 text-slate-500 transition-colors hover:text-slate-950"
                  >
                    {section.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          <main className="min-w-0">
            <section className="border-b border-black/[0.08] pb-10">
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                {document.eyebrow}
              </div>
              <h1
                className="mt-5 max-w-3xl font-serif text-[2.65rem] leading-[1.02] tracking-[-0.045em] text-slate-950 sm:text-[3.4rem]"
                style={{ textWrap: 'balance' }}
              >
                {document.title}
              </h1>
              <p className="mt-5 max-w-3xl text-[17px] leading-8 text-slate-600">
                {document.lead}
              </p>

              <div className="mt-8 flex flex-wrap gap-x-10 gap-y-3 border-y border-black/[0.08] py-4 text-sm text-slate-500">
                <div>
                  <span className="mr-2 text-slate-400">{document.lastUpdatedLabel}</span>
                  <span className="text-slate-700">{document.lastUpdatedValue}</span>
                </div>
                <div>
                  <span className="mr-2 text-slate-400">Service</span>
                  <span className="text-slate-700">{locale.serviceMode}</span>
                </div>
              </div>

              <p className="mt-8 max-w-3xl text-[15px] leading-8 text-slate-600">
                {document.intro}
              </p>

              <div className="mt-10">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                  {document.factsLabel}
                </div>
                <ul className="mt-4 space-y-3 border-l border-black/[0.08] pl-5">
                  {document.facts.map((fact) => (
                    <li key={fact} className="text-[15px] leading-7 text-slate-600">
                      {fact}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="pt-4">
              {document.sections.map((section) => (
                <article
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-16 border-b border-black/[0.08] py-8 first:pt-6"
                >
                  <h2 className="max-w-3xl font-serif text-[1.7rem] leading-tight tracking-[-0.03em] text-slate-950">
                    {section.title}
                  </h2>

                  {section.summary ? (
                    <p className="mt-4 max-w-3xl text-[15px] leading-8 text-slate-600">{section.summary}</p>
                  ) : null}

                  {section.paragraphs?.map((paragraph) => (
                    <p key={paragraph} className="mt-4 max-w-3xl text-[15px] leading-8 text-slate-600">
                      {paragraph}
                    </p>
                  ))}

                  {section.bullets?.length ? (
                    <ul className="mt-5 max-w-3xl space-y-3">
                      {section.bullets.map((bullet) => (
                        <li key={bullet} className="flex items-start gap-3 text-[15px] leading-8 text-slate-600">
                          <span className="mt-3 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              ))}
            </section>

            <footer className="flex flex-wrap items-center justify-between gap-4 pt-8 text-sm text-slate-500">
              <div>{locale.brand}</div>
              <div className="flex flex-wrap items-center gap-5">
                <Link
                  to={location.pathname === '/privacy' ? '/terms' : '/privacy'}
                  className="inline-flex items-center gap-1 transition-colors hover:text-slate-950"
                >
                  {location.pathname === '/privacy' ? locale.switchTerms : locale.switchPrivacy}
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/"
                  className="inline-flex items-center gap-1 transition-colors hover:text-slate-950"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {locale.home}
                </Link>
              </div>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
};
