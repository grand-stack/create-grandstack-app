import inquirer from 'inquirer'
import arg from 'arg'

const templateOpts = ['React', 'React-TS', 'Angular']

const APIQuestions = [
  {
    type: 'input',
    name: 'neo4jUri',
    message: 'Enter the connection string for Neo4j',
    default: 'bolt://localhost:7687',
  },
  {
    type: 'confirm',
    name: 'neo4jEncrypted',
    message:
      'Use an encrypted connection for Neo4j? (Select "No" for Neo4j Sandbox)',
    default: false,
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
      useNpm: args['--use-npm'] || false,
    }
  } catch (error) {
    console.log('unknown option')
    process.exit(0)
  }
}

export const promptForMissingOptions = async (options) => {
  const { skipPrompts, template, projectPath, gitInit } = options

  const defaultTemplate = 'React'
  const defaultPath = './GRANDStackStarter'
  if (skipPrompts) {
    return {
      ...options,
      neo4jUri: 'bolt://localhost:7687',
      neo4jEncrypted: false,
      neo4jUser: 'neo4j',
      neo4jPassword: 'letmein',
      rmTemplates: templateOpts.filter(
        (c) => c.toLowerCase() !== defaultTemplate.toLowerCase()
      ),
      template: template || defaultTemplate,
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
    ...rest
  } = await inquirer.prompt([...questions, ...APIQuestions])
  const chosenTemplate = template || inqTemplate
  return {
    ...options,
    ...rest,
    rmTemplates: templateOpts.filter(
      (c) => c.toLowerCase() !== chosenTemplate.toLowerCase()
    ),
    template: chosenTemplate,
    projectPath: projectPath || defaultPath,
    gitInit: gitInit || inqGitInit,
  }
}
