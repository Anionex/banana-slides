import { Button } from './Button'
import { Mail, SendHorizonal } from 'lucide-react'
import type { FormEventHandler, InputHTMLAttributes, ReactNode } from 'react'

export interface CallToActionProps {
    id: string
    className?: string
    title: string
    description?: string
    beforeForm?: ReactNode
    submitLabel: string
    submitting: boolean
    inputProps: InputHTMLAttributes<HTMLInputElement>
    onSubmit: FormEventHandler<HTMLFormElement>
    footer?: ReactNode
}

export default function CallToAction({ id, className = '', title, description, beforeForm, submitLabel, submitting, inputProps, onSubmit, footer }: CallToActionProps) {
    return (
        <section id={id} aria-labelledby={`${id}-title`} className={`py-16 md:py-32 ${className}`}>
            <div className="mx-auto max-w-5xl px-6">
                <div className="text-center">
                    <h2 id={`${id}-title`} className="text-balance text-4xl font-semibold lg:text-5xl">{title}</h2>
                    {description && <p className="mt-4">{description}</p>}
                    {beforeForm}

                    <form
                        onSubmit={onSubmit}
                        className="mx-auto mt-10 max-w-sm lg:mt-12">
                        <div className="bg-background has-[input:focus]:ring-muted relative grid grid-cols-[1fr_auto] items-center rounded-[calc(var(--radius)+0.75rem)] border pr-3 shadow shadow-zinc-950/5 has-[input:focus]:ring-2">
                            <Mail aria-hidden="true" className="text-caption pointer-events-none absolute inset-y-0 left-5 my-auto size-5" />

                            <input
                                className="h-14 w-full bg-transparent pl-12 focus:outline-none"
                                type="email"
                                {...inputProps}
                            />

                            <div className="md:pr-1.5 lg:pr-0">
                                <Button
                                    type="submit"
                                    disabled={submitting}
                                    aria-label={submitLabel}
                                    className="rounded-[var(--radius)]">
                                    <span className="hidden md:block">{submitLabel}</span>
                                    <SendHorizonal
                                        aria-hidden="true"
                                        className="relative mx-auto size-5 md:hidden"
                                        strokeWidth={2}
                                    />
                                </Button>
                            </div>
                        </div>
                    </form>
                    {footer}
                </div>
            </div>
        </section>
    )
}
