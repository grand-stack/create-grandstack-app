import inquirer from 'inquirer'
import arg from 'arg'
import chalk from 'chalk'
import execa from 'execa'

const templateOpts = ['React', 'React-TS', 'Angular', 'Flutter', 'API-Only']
const templateFileNameHashMap = {
  React: 'web-react',
  'React-TS': 'web-react-ts',
  Angular: 'web-angular',
  Flutter: 'mobile_client_flutter',
  'API-Only': 'api-only',
}

export const getTemplateFileName = (chosenTemplate) => {
  return templateFileNameHashMap[chosenTemplate]
}

const getRmTemplates = (chosenTemplate) => {
  return Object.values(templateFileNameHashMap).filter(
    (name) =>
      name !== templateFileNameHashMap[chosenTemplate] && name !== 'api-only'
  )
}

const shouldUseYarn = () => {
  try {
    execa.sync('yarnpkg', ['--version'])
    return true
  } catch (e) {
    return false
  }
}

const APIQuestions = [
  {
    type: 'input',
    name: 'whatever',
    message: chalk.green(
      `Now let's configure your GraphQL API to connect to Neo4j. If you don't have a Neo4j instance you can create one for free in the cloud at https://neo4j.com/sandbox

Hit <Return> When you are ready.`
    ),
  },
  {
    type: 'input',
    name: 'neo4jUri',
    message: `Enter the connection string for Neo4j
    (use neo4j+s:// or bolt+s:// scheme for encryption)`,
    default: 'bolt://localhost:7687',
  },
  {
    type: 'input',
    name: 'neo4jUser',
    message: 'Enter the Neo4j user',
    default: 'neo4j',
  },
  {
    type: 'input',
    name: 'neo4jPassword',
    message: 'Enter the password for this user',
    default: 'letmein',
  },
]

export const parseArgumentsIntoOptions = (rawArgs) => {
  try {
    const args = arg(
      {
        '--git': Boolean,
        '--yes': Boolean,
        '--install': Boolean,
        '--use-npm': Boolean,
        '--init-db': Boolean,
        '-g': '--git',
        '-y': '--yes',
        '-i': '--install',
        '-un': '--use-npm',
      },
      {
        argv: rawArgs.slice(2),
      }
    )
    return {
      skipPrompts: args['--yes'] || false,
      gitInit: args['--git'] || false,
      projectPath: args._[0],
      template: args._[1],
      runInstall: args['--install'] || false,
      useNpm: args['--use-npm'] || !shouldUseYarn(),
    }
  } catch (error) {
    console.log('unknown option')
    process.exit(0)
  }
}

export const promptForMissingOptions = async (options) => {
  const { skipPrompts, template, projectPath, gitInit, runInstall } = options

  const defaultTemplate = 'React'
  const defaultPath = './GRANDStackStarter'
  if (skipPrompts) {
    return {
      ...options,
      neo4jUri: 'bolt://localhost:7687',
      neo4jUser: 'neo4j',
      neo4jPassword: 'letmein',
      rmTemplates: getRmTemplates(chosenTemplate),
      templateName: template || defaultTemplate,
      templateFileName: getTemplateFileName(chosenTemplate),
      projectPath: projectPath || defaultPath,
    }
  }

  const questions = []
  if (!template) {
    questions.push({
      type: 'list',
      name: 'template',
      message: 'Please choose which project template to use',
      choices: templateOpts,
      default: defaultTemplate,
    })
  }

  if (!runInstall) {
    questions.push({
      type: 'confirm',
      name: 'runInstall',
      message: 'Install dependencies?',
      default: true,
    })
  }

  if (!gitInit) {
    questions.push({
      type: 'confirm',
      name: 'gitInit',
      message: 'Initialize a git repository?',
      default: false,
    })
  }

  const {
    template: inqTemplate,
    gitInit: inqGitInit,
    runInstall: inqRunInstall,
    ...rest
  } = await inquirer.prompt([...questions, ...APIQuestions])
  const chosenTemplate = template || inqTemplate
  return {
    ...options,
    ...rest,
    rmTemplates: getRmTemplates(chosenTemplate),
    templateName: chosenTemplate,
    templateFileName: getTemplateFileName(chosenTemplate),
    projectPath: projectPath || defaultPath,
    gitInit: gitInit || inqGitInit,
    runInstall: runInstall || inqRunInstall,
  }
}
