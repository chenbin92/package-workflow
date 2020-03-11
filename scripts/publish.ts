import { join, basename } from 'path'
import * as execa from 'execa'
import * as fse from 'fs-extra'
import { run } from './fn/shell'
import getWorkspacePackages from './fn/getPackages'

const chalk = require('chalk')
const gitP = require('simple-git/promise')
const lerna = require.resolve('lerna/cli')

async function publish() {

  log('1. ✔️ ✔️ ✔️  代码检查...')
  // const gitStatus = await run('git status --porcelain');
  const status = await gitP().status()
  if (status.modified.length) {
    console.log(chalk.red('   ⚠️  ⚠️  ⚠️  本地存在文件改动禁止发布...\n'))
    process.exit(0)
  }

  log('2. ✔️ ✔️ ✔️  版本检查...')
  const { stdout } = execa.commandSync('lerna changed');
  const needsPublishPackages = stdout.split('\n') || [];
  if (!needsPublishPackages.length) {
    console.log(chalk.red('   ⚠️  ⚠️  ⚠️  没有需要发布的包...\n'))
    process.exit(0)
  }

  log('3. 📦 📦 📦 构建代码...')
  await run('npm run build')

  log('4. ⚡ ⚡ ⚡ 更新版本...')
  await run('lerna version --exact --no-commit-hooks --no-git-tag-version --no-push')

  // Note：
  // cannot use lerna publish
  // because lerna publish will not update version
  log('5. 🚀 🚀 🚀 开始发布...')
  const { version: newVersion } = fse.readJsonSync(join(__dirname, '../lerna.json'))
  const isLatestVersion = (newVersion.includes('rc') || newVersion.includes('alpha') || newVersion.includes('beta')) ? false : true
  const { packageDirs } = await getWorkspacePackages()
  packageDirs.forEach((pkgDir) => {
    if (needsPublishPackages.includes(basename(pkgDir))) {
      const pkgContent = require(join(pkgDir, 'package.json'))
      const { name, version } = pkgContent;
      console.log(`📦 📦 📦 开始发布 ${name}@${version}`)
      const publishArgs = isLatestVersion ? 'publish' : 'publish --tag=beta'
      execa.commandSync(`npm ${publishArgs}`, {
        cwd: pkgDir,
        stdio: 'inherit'
      });
    }
  });

  log(`6. 🔖 🔖 🔖 提交代码${isLatestVersion ? ' & 创建 tag' : ''}...`)
  await run(`git commit --all -m v${newVersion}`)

  if (isLatestVersion) {
    await run(`git tag v${newVersion}`)
    await run('git push origin master --tags')
  } else {
    await run('git push')
  }
  log(`\n\n 🎉 🎉 🎉 版本发布完成...`)

  log('💡 💡 💡 同步版本...')
  await run('npm run sync')
}

function log(msg) {
  console.log(chalk.yellow(`\n ${msg} \n`))
}

(async() => {
  try {
    await publish()
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
})()
