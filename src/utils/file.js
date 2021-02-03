import chalk from 'chalk'
import fs from 'fs'
import execa from 'execa'
import axios from 'axios'
import path from 'path'
import tmp from 'tmp'
import decompress from 'decompress'
import rimraf from 'rimraf'

const dirExists = (dir) => fs.existsSync(dir)
const dirIsNotEmpty = (dir) => fs.readdirSync(dir).length > 0

export const checkAppDir = (targetDir) => {
  const exists = dirExists(targetDir)
  if (exists && dirIsNotEmpty(targetDir)) {
    console.log(
      `%s '${targetDir}' already exists and is not empty.`,
      chalk.yellow.bold('ALREADYEXISTS')
    )
    process.exit(1)
  }
}

export const appDir = (targetDir) => path.resolve(process.cwd(), targetDir)

export const initGit = async (newAppDir) => {
  const result = await execa('git', ['init'], {
    cwd: newAppDir,
  })
  if (result.failed) {
    return Promise.reject(new Error('Failed to initialize git'))
  }
  return
}

export const writeDotEnv = ({
  newAppDir,
  neo4jUri,
  neo4jUser,
  neo4jPassword,
}) => {
  const dotenvpath = path.join(newAppDir, 'api')

  // FIXME: It would be better to replace into a template instead of rewrite entire file
  const dotenvstring = `# Use this file to set environment variables with credentials and configuration options
# This file is provided as an example and should be replaced with your own values
# You probably don't want to check this into version control!

NEO4J_URI=${neo4jUri}
NEO4J_USER=${neo4jUser}
NEO4J_PASSWORD=${neo4jPassword}

# Uncomment this line to specify a specific Neo4j database (v4.x+ only)
#NEO4J_DATABASE=neo4j

GRAPHQL_SERVER_HOST=0.0.0.0
GRAPHQL_SERVER_PORT=4001
GRAPHQL_SERVER_PATH=/graphql

`

  fs.writeFileSync(path.join(dotenvpath, '.env'), dotenvstring)
}

export const writeConfigJson = ({
  newAppDir,
  templateName,
  templateFileName,
}) => {
  const configPath = path.join(newAppDir, 'scripts', 'config')
  if (!fs.existsSync(configPath)) {
    fs.mkdirSync(configPath)
  }
  const config = {
    templateFileName,
    templateName,
  }

  fs.writeFileSync(path.join(configPath, 'index.json'), JSON.stringify(config))
}

export const latestReleaseZipFile = async () => {
  const RELEASE_URL =
    'https://api.github.com/repos/grand-stack/grand-stack-starter/releases'
  const res = await axios.get(RELEASE_URL)
  return res.data[0].zipball_url
}

export const downloadFile = async (sourceUrl, targetFile) => {
  const writer = fs.createWriteStream(targetFile)
  const response = await axios.get(sourceUrl, {
    responseType: 'stream',
  })
  response.data.pipe(writer)

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve)
    writer.on('error', reject)
  })
}

export const removeUnusedTemplates = async ({ newAppDir, rmTemplates }) => {
  try {
    const rimRafPromises = rmTemplates.map((choice) =>
      rimraf(path.join(newAppDir, choice), (err) => {
        if (err) {
          console.log(`%s Rimraf Exception`, chalk.redBright.bold('ERROR'))
          console.log(`%s ${err}`, chalk.redBright.bold('ERROR'))
          process.exit(1)
        }
      })
    )
    return Promise.all(rimRafPromises)
  } catch (err) {
    console.log(err)
  }
}

export const createProjectTasks = ({
  newAppDir,
  rmTemplates,
  templateName,
  templateFileName,
  ...creds
}) => {
  const tmpDownloadPath = tmp.tmpNameSync({
    prefix: 'grandstack',
    postfix: '.zip',
  })

  return [
    {
      title: `${
        dirExists(newAppDir) ? 'Using' : 'Creating'
      } directory '${newAppDir}'`,
      task: () => {
        fs.mkdirSync(newAppDir, { recursive: true })
      },
    },
    {
      title: 'Downloading latest release',
      task: async () => {
        const url = await latestReleaseZipFile()
        return downloadFile(url, tmpDownloadPath)
      },
    },
    {
      title: 'Extracting latest release',
      task: () => decompress(tmpDownloadPath, newAppDir, { strip: 1 }),
    },
    {
      title: 'Creating Local env file with configuration options...',
      task: () =>
        writeDotEnv({
          newAppDir,
          ...creds,
        }),
    },
    {
      title: 'Creating scripts configuration...',
      task: () =>
        writeConfigJson({ newAppDir, templateName, templateFileName }),
    },
    {
      title: `Removing unused templates:
    \u2714 ${rmTemplates.join('\n    \u2714 ')}`,
      task: async () => await removeUnusedTemplates({ newAppDir, rmTemplates }),
    },
  ]
}
