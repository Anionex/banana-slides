import { test, expect, errors } from '@playwright/test'
import { execFileSync } from 'child_process'
import { createServer, type Server } from 'http'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const FRONTEND_DIR = process.cwd().endsWith('frontend')
  ? process.cwd()
  : path.join(process.cwd(), 'frontend')
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SETTINGS_DB = path.join(PROJECT_ROOT, 'backend', 'instance', 'database.db')
const FIXTURES = path.join(FRONTEND_DIR, 'e2e', 'fixtures')
const RESPONSE_IMAGE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
  'base64',
)

type RawImageSettings = {
  ai_provider_format: string | null
  image_model_source: string | null
  image_model: string | null
  image_api_key: string | null
  image_api_base_url: string | null
  openai_image_api_protocol: string | null
  image_resolution: string | null
  updated_at: string | null
}

function readRawImageSettings(): RawImageSettings {
  const query = [
    'SELECT ai_provider_format, image_model_source, image_model,',
    'image_api_key, image_api_base_url, openai_image_api_protocol,',
    'image_resolution, updated_at FROM settings WHERE id = 1;',
  ].join(' ')
  const output = execFileSync(
    'sqlite3',
    ['-cmd', '.timeout 5000', '-json', SETTINGS_DB, query],
    { encoding: 'utf8' },
  )
  const rows = JSON.parse(output) as RawImageSettings[]
  if (!rows[0]) throw new Error('Settings row was not created by the backend')
  return rows[0]
}

function sqlText(value: string | null): string {
  if (value === null) return 'NULL'
  return `CAST(X'${Buffer.from(value, 'utf8').toString('hex')}' AS TEXT)`
}

function restoreRawImageSettings(settings: RawImageSettings): void {
  const assignments = Object.entries(settings)
    .map(([column, value]) => `${column} = ${sqlText(value)}`)
    .join(', ')
  execFileSync(
    'sqlite3',
    ['-cmd', '.timeout 5000', SETTINGS_DB, `UPDATE settings SET ${assignments} WHERE id = 1;`],
  )
}

test.describe('OpenAI native multi-reference generation', () => {
  test.skip(
    process.env.RUN_OPENAI_MULTI_REFERENCE_E2E !== '1',
    'Requires an isolated backend because it temporarily replaces image provider settings.',
  )

  let fakeOpenAI: Server | undefined
  let projectId: string | undefined
  let originalRawSettings: RawImageSettings | undefined
  let originalEffectiveSettings: Record<string, unknown> | undefined

  test.beforeAll(async ({ request }) => {
    const response = await request.get('/api/settings')
    expect(response.ok()).toBe(true)
    originalEffectiveSettings = (await response.json()).data
    originalRawSettings = readRawImageSettings()
  })

  test.afterEach(async ({ request }) => {
    try {
      if (projectId) {
        const response = await request.delete(`/api/projects/${projectId}`)
        expect(response.ok()).toBe(true)
      }
    } finally {
      projectId = undefined
      const server = fakeOpenAI
      fakeOpenAI = undefined
      if (server) {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => error ? reject(error) : resolve())
        })
      }
    }
  })

  test.afterAll(async ({ request }) => {
    if (!originalEffectiveSettings || !originalRawSettings) return
    try {
      const response = await request.put('/api/settings', {
        data: {
          ai_provider_format: originalEffectiveSettings.ai_provider_format,
          image_model_source: originalRawSettings.image_model_source,
          image_model: originalRawSettings.image_model,
          image_api_key: originalRawSettings.image_api_key,
          image_api_base_url: originalRawSettings.image_api_base_url,
          openai_image_api_protocol: originalRawSettings.openai_image_api_protocol || 'auto',
          image_resolution: originalEffectiveSettings.image_resolution,
        },
      })
      expect(response.ok()).toBe(true)
    } finally {
      restoreRawImageSettings(originalRawSettings)
    }
  })

  test('sends the template and every description image to images.edit', async ({ page, request }) => {
    test.setTimeout(120_000)
    let receivedReferenceCount = 0

    fakeOpenAI = createServer((req, res) => {
      const chunks: Buffer[] = []
      req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      req.on('end', () => {
        const body = Buffer.concat(chunks).toString('latin1')
        receivedReferenceCount = (
          body.match(/name="image(?:\[\])?"/g) || []
        ).length
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Connection': 'close',
        })
        res.end(JSON.stringify({
          data: [{ b64_json: RESPONSE_IMAGE.toString('base64') }],
        }))
      })
    })
    await new Promise<void>((resolve) => fakeOpenAI!.listen(0, '127.0.0.1', resolve))
    const address = fakeOpenAI.address()
    if (!address || typeof address === 'string') throw new Error('Fake OpenAI server did not start')

    const settingsResponse = await request.put('/api/settings', {
      data: {
        ai_provider_format: 'openai',
        image_model_source: 'openai',
        image_model: 'gpt-image-2',
        image_api_key: 'e2e-test-key',
        image_api_base_url: `http://127.0.0.1:${address.port}/v1`,
        openai_image_api_protocol: 'images',
        image_resolution: '1K',
      },
    })
    expect(settingsResponse.ok()).toBe(true)

    const projectResponse = await request.post('/api/projects', {
      data: {
        creation_type: 'idea',
        idea_prompt: 'multi-reference e2e',
        template_style: 'clean geometric style',
      },
    })
    expect(projectResponse.ok()).toBe(true)
    const createdProjectId = (await projectResponse.json()).data.project_id as string
    projectId = createdProjectId

    const pageResponse = await request.post(`/api/projects/${createdProjectId}/pages`, {
      data: {
        order_index: 0,
        outline_content: { title: 'Reference Test' },
      },
    })
    expect(pageResponse.ok()).toBe(true)
    const pageId = (await pageResponse.json()).data.page_id

    const fixtureNames = ['slide_1.jpg', 'slide_2.jpg', 'slide_3.jpg']
    const fixtureBuffers = fixtureNames.map((name) => fs.readFileSync(path.join(FIXTURES, name)))

    const templateResponse = await request.post(`/api/projects/${createdProjectId}/template`, {
      multipart: {
        template_image: {
          name: fixtureNames[0],
          mimeType: 'image/jpeg',
          buffer: fixtureBuffers[0],
        },
      },
    })
    expect(templateResponse.ok()).toBe(true)

    const materialUrls: string[] = []
    for (let index = 1; index < fixtureBuffers.length; index++) {
      const uploadResponse = await request.post(`/api/projects/${createdProjectId}/materials/upload`, {
        multipart: {
          file: {
            name: fixtureNames[index],
            mimeType: 'image/jpeg',
            buffer: fixtureBuffers[index],
          },
        },
      })
      expect(uploadResponse.ok()).toBe(true)
      materialUrls.push((await uploadResponse.json()).data.url)
    }

    const descriptionResponse = await request.put(
      `/api/projects/${createdProjectId}/pages/${pageId}/description`,
      {
        data: {
          description_content: {
            text: [
              `![first material](${materialUrls[0]})`,
              `![second material](${materialUrls[1]})`,
              'Use both supplied materials in the template style.',
            ].join('\n'),
          },
        },
      },
    )
    expect(descriptionResponse.ok()).toBe(true)

    await page.addInitScript((id) => {
      localStorage.setItem('hasSeenHelpModal', 'true')
      localStorage.setItem('currentProjectId', id)
    }, createdProjectId)
    await page.goto(`/project/${createdProjectId}/preview`)

    const generateButton = page.getByRole('button', { name: /批量生成图片|Generate Images/i })
    await expect(generateButton).toBeVisible()
    await generateButton.click()

    const confirmOneK = page.getByRole('button', { name: /仍然生成|Generate Anyway/i })
    const needsConfirmation = await confirmOneK
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch((error: unknown) => {
        if (error instanceof errors.TimeoutError) return false
        throw error
      })
    if (needsConfirmation) await confirmOneK.click()

    await expect.poll(() => receivedReferenceCount, { timeout: 60_000 }).toBe(3)
    await expect(page.locator('main img[src*="/pages/"]')).toBeVisible({ timeout: 60_000 })
  })
})
