/**
 * Markdown 组件测试 - 验证 LaTeX 公式渲染
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Markdown } from '@/components/shared/Markdown'

describe('Markdown Component', () => {
  it('renders plain text', () => {
    render(<Markdown>Hello World</Markdown>)
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })

  it('renders markdown bold text', () => {
    render(<Markdown>**bold text**</Markdown>)
    const bold = screen.getByText('bold text')
    expect(bold.tagName).toBe('STRONG')
  })

  it('renders markdown links', () => {
    render(<Markdown>[link](https://example.com)</Markdown>)
    const link = screen.getByText('link')
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', 'https://example.com')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('renders markdown images', () => {
    render(<Markdown>![alt text](https://example.com/img.png)</Markdown>)
    const img = screen.getByAltText('alt text')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', 'https://example.com/img.png')
  })

  it('renders inline LaTeX formula with $ delimiters', () => {
    const { container } = render(<Markdown>The formula $E = mc^2$ is famous</Markdown>)
    // KaTeX renders math into spans with class "katex"
    const katexElements = container.querySelectorAll('.katex')
    expect(katexElements.length).toBeGreaterThan(0)
  })

  it('renders block LaTeX formula with $$ delimiters', () => {
    const { container } = render(
      <Markdown>{`Before

$$x^2 + y^2 = z^2$$

After`}</Markdown>
    )
    // Block math should render with katex class (katex-display wraps it)
    const katexElements = container.querySelectorAll('.katex')
    expect(katexElements.length).toBeGreaterThan(0)
  })

  it('renders multiple LaTeX formulas in same text', () => {
    const { container } = render(
      <Markdown>Given $a^2 + b^2 = c^2$ and $E = mc^2$, we can derive</Markdown>
    )
    const katexElements = container.querySelectorAll('.katex')
    expect(katexElements.length).toBe(2)
  })

  it('renders GFM tables', () => {
    const tableMarkdown = `| Header | Value |
| --- | --- |
| Row 1 | Data 1 |`

    render(<Markdown>{tableMarkdown}</Markdown>)
    expect(screen.getByText('Header')).toBeInTheDocument()
    expect(screen.getByText('Data 1')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<Markdown className="custom-class">text</Markdown>)
    expect(container.firstChild).toHaveClass('markdown-content')
    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('renders mixed markdown and LaTeX', () => {
    const { container } = render(
      <Markdown>{`**Bold** and $x^2$ together`}</Markdown>
    )
    expect(screen.getByText('Bold')).toBeInTheDocument()
    const katexElements = container.querySelectorAll('.katex')
    expect(katexElements.length).toBeGreaterThan(0)
  })
})
