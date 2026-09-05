import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StudioHero } from '@/components/home/StudioHero'

vi.mock('@/utils', () => ({ isDesktop: true }))
vi.mock('@/hooks/useT', () => ({ useT: () => (key: string) => key }))

describe('StudioHero desktop navigation and motion', () => {
  it('uses relative desktop assets and scrolls without changing the hash route', () => {
    const scroll = vi.fn()
    render(<><StudioHero /><section id="creation-style" /></>)
    document.getElementById('creation-style')!.scrollIntoView = scroll
    const hash = window.location.hash
    fireEvent.click(screen.getByRole('button', { name: 'browse' }))
    expect(scroll).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' })
    expect(window.location.hash).toBe(hash)
    for (const image of screen.getAllByRole('img')) expect(image.getAttribute('src')).toMatch(/^\.\/templates\//)
  })

  it('uses instant scrolling when reduced motion is requested', () => {
    const matchMedia = vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList)
    const scroll = vi.fn()
    try {
      render(<><StudioHero /><section id="creation-style" /></>)
      document.getElementById('creation-style')!.scrollIntoView = scroll
      fireEvent.click(screen.getByRole('button', { name: 'browse' }))
      expect(scroll).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' })
    } finally {
      matchMedia.mockRestore()
    }
  })
})
