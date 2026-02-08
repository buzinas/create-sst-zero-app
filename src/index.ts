#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import prompts from 'prompts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const templateDir = path.resolve(__dirname, '..', 'template')

function toDbName(name: string): string {
  return name.replace(/-/g, '_')
}

function toDisplayName(name: string): string {
  return name
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

const SKIP_EXTENSIONS = new Set(['.svg', '.png', '.jpg', '.ico', '.woff', '.woff2'])
const SKIP_DIRS = new Set(['node_modules', '.turbo', '.sst', 'build', 'dist', 'coverage'])

function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        copyDir(srcPath, destPath)
      }
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

function replaceInFile(
  filePath: string,
  replacements: [string, string][],
): void {
  if (SKIP_EXTENSIONS.has(path.extname(filePath))) return
  let content = fs.readFileSync(filePath, 'utf-8')
  for (const [find, replace] of replacements) {
    content = content.replaceAll(find, replace)
  }
  fs.writeFileSync(filePath, content)
}

function walkFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath))
    } else {
      files.push(fullPath)
    }
  }
  return files
}

async function main(): Promise<void> {
  const targetArg = process.argv[2]

  const response = await prompts(
    [
      {
        type: targetArg ? null : 'text',
        name: 'projectName',
        message: 'Project name:',
        initial: 'my-app',
      },
      {
        type: 'text',
        name: 'domain',
        message: 'Production domain:',
      },
      {
        type: 'text',
        name: 'cloudflareZoneId',
        message: 'Cloudflare zone ID:',
      },
      {
        type: 'text',
        name: 'awsRegion',
        message: 'AWS region:',
        initial: 'us-east-1',
      },
    ],
    {
      onCancel: () => {
        console.log('\nAborted.')
        process.exit(1)
      },
    },
  )

  const projectName = targetArg ?? response.projectName
  const { domain, cloudflareZoneId, awsRegion } = response

  if (!domain) {
    console.error('Production domain is required.')
    process.exit(1)
  }

  if (!cloudflareZoneId) {
    console.error('Cloudflare zone ID is required.')
    process.exit(1)
  }

  const targetDir = path.resolve(process.cwd(), projectName)
  const dbName = toDbName(projectName)
  const displayName = toDisplayName(projectName)

  if (fs.existsSync(targetDir)) {
    console.error(`Directory "${projectName}" already exists.`)
    process.exit(1)
  }

  console.log(`\nCreating ${projectName}...`)

  // Copy template
  copyDir(templateDir, targetDir)

  // Rename dotfiles (npm strips/renames them during publish)
  for (const file of ['gitignore', 'npmrc']) {
    const src = path.join(targetDir, file)
    if (fs.existsSync(src)) {
      fs.renameSync(src, path.join(targetDir, `.${file}`))
    }
  }

  // Apply replacements across all files
  // Order matters: replace longer strings first to avoid partial matches
  const replacements: [string, string][] = [
    ['zero_app', dbName],
    ['zero-app', projectName],
    ['Zero App', displayName],
    ['TODO:CLOUDFLARE_ZONE_ID', cloudflareZoneId],
    ['TODO:DOMAIN', domain],
  ]

  // Only replace region if different from the template default
  if (awsRegion && awsRegion !== 'us-east-1') {
    replacements.push(['us-east-1', awsRegion])
  }

  for (const file of walkFiles(targetDir)) {
    replaceInFile(file, replacements)
  }

  // Initialize git
  execSync('git init', { cwd: targetDir, stdio: 'ignore' })

  // Install dependencies
  console.log('Installing dependencies...')
  execSync('pnpm install', { cwd: targetDir, stdio: 'inherit' })

  console.log(`
Done! Next steps:

  cd ${projectName}
  docker compose -f docker-compose.dev.yml up -d
  pnpm db:migrate
  pnpm dev

Open http://localhost:3000

Before deploying, search for TODO: in the codebase for values
that need to be filled after running:

  npx sst deploy --stage dev --config sst.dev.config.ts
`)
}

main()
