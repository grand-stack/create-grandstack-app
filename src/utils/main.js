import chalk from 'chalk'
import Listr from 'listr'
import path from 'path'
import { projectInstall } from 'pkg-install'
import { createProjectTasks, checkAppDir, initGit, appDir } from './file'
import { parseArgumentsIntoOptions, promptForMissingOptions } from './options'

async function createApp(options) {
  const {
    projectPath,
    rmTemplates,
    templateName,
    templateFileName,
    gitInit,
    useNpm,
    neo4jUri,
    neo4jUser,
    neo4jPassword,
    runInstall,
  } = options

  const creds = { neo4jUri, neo4jUser, neo4jPassword }

  // Check to see if path exists and return joined path
  const newAppDir = appDir(projectPath)
  const packageManager = useNpm ? 'npm' : 'yarn'

  // Main task loop, build and concat based on options
  console.log('%s', chalk.green.bold('Initializing Project...'))
  const tasks = new Listr(
    [
      {
        title: 'Create GRANDstack App',
        task: () =>
          new Listr(
            createProjectTasks({
              newAppDir,
              rmTemplates,
              templateName,
              templateFileName,
              ...creds,
            })
          ),
      },
      {
        title: 'Initialize git',
        task: () => initGit(newAppDir),
        enabled: () => gitInit,
      },
      {
        title: `Installing Packages with ${packageManager}`,
        task: () =>
          new Listr([
            {
              title: 'Installing GRANDstack CLI and dependencies',
              task: () =>
                projectInstall({
                  cwd: newAppDir,
                  prefer: packageManager,
                }),
            },
            {
              title: 'Installing api dependencies',
              task: () =>
                projectInstall({
                  cwd: path.join(newAppDir, 'api'),
                  prefer: packageManager,
                }),
            },
            {
              title:
                templateFileName === 'api-only'
                  ? 'Skipping Frontend Install'
                  : `Installing ${templateFileName} dependencies`,
              task: () =>
                projectInstall({
                  cwd: path.join(newAppDir, templateFileName),
                  prefer: packageManager,
                }),
              skip: () => templateFileName === 'api-only',
            },
          ]),
        skip: () =>
          !runInstall
            ? 'Pass --install to automatically install dependencies'
            : undefined,
      },
    ],
    { collapse: false, exitOnError: true }
  )

  await tasks.run()
  console.log()
  console.log(
    chalk.green(
      `Thanks for using GRANDstack! We've created your app in '${newAppDir}'`
    )
  )
  console.log(`You can find documentation at: https://grandstack.io/docs`)
  console.log()
  console.log(`
To start your GRANDstack web application and GraphQL API run:

        cd ${projectPath}
        npm run start

Then (optionally) to seed the database with sample data, in the api/ directory in another terminal run:

        npm run seedDb

The default application is a simple business reviews application. Feel free to suggest updates by visiting the open source template repo and opening an issue: https://github.com/grand-stack/grand-stack-starter/issues.
`)
  return true
}

export const main = async (args) => {
  const options = parseArgumentsIntoOptions(args)
  checkAppDir(options.projectPath)
  const prompted = await promptForMissingOptions(options)
  createApp(prompted)
}
