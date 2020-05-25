#!/usr/bin/env node

// Usage:
// yarn create grandstack-app mynewapp

// inspired by create-redwood-app

import fs from "fs";
import path from "path";
import decompress from "decompress";
import axios from "axios";
import Listr from "listr";
import execa from "execa";
import tmp from "tmp";
import checkNodeVersion from "check-node-version";
import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import rimraf from "rimraf";

let projectName;

const program = new Command()
  .arguments("<project-directory>")
  .action((name) => {
    projectName = name;
  })
  .option("--use-npm")
  .option("-y, --yes")
  .parse(process.argv);

const shouldUseYarn = () => {
  try {
    execa.sync("yarnpkg", ["--version"]);
    return true;
  } catch (e) {
    return false;
  }
};

const useYarn = program.useNpm ? false : shouldUseYarn();

const RELEASE_URL =
  "https://api.github.com/repos/grand-stack/grand-stack-starter/releases";

const latestReleaseZipFile = async () => {
  const res = await axios.get(RELEASE_URL);
  return res.data[0].zipball_url;
};

const downloadFile = async (sourceUrl, targetFile) => {
  const writer = fs.createWriteStream(targetFile);
  const response = await axios.get(sourceUrl, {
    responseType: "stream",
  });
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
};

const targetDir = projectName.replace(/,/g, "-");
if (!targetDir) {
  console.error("No project directory specified");
  console.log(
    `${chalk.cyan("yarn create grandstack-app")} ${chalk.green(
      "<project-directory>"
    )}`
  );
  console.log();
  console.log("For example:");
  console.log(
    `${chalk.cyan("yarn create grandstack-app")} ${chalk.green(
      "my-grandstack-app"
    )}`
  );
  process.exit(1);
}

const newAppDir = path.resolve(process.cwd(), targetDir);
const appDirExists = fs.existsSync(newAppDir);

if (appDirExists && fs.readdirSync(newAppDir).length > 0) {
  console.error(`'${newAppDir}' already exists and is not empty.`);
  process.exit(1);
}

const createProjectTasks = ({ newAppDir }) => {
  const tmpDownloadPath = tmp.tmpNameSync({
    prefix: "grandstack",
    postfix: ".zip",
  });

  return [
    {
      title: `${appDirExists ? "Using" : "Creating"} directory '${newAppDir}'`,
      task: () => {
        fs.mkdirSync(newAppDir, { recursive: true });
      },
    },
    {
      title: "Downloading latest release",
      task: async () => {
        const url = await latestReleaseZipFile();
        return downloadFile(url, tmpDownloadPath);
      },
    },

    {
      title: "Extracting latest release",
      task: () => decompress(tmpDownloadPath, newAppDir, { strip: 1 }),
    },
    {
      title: "Removing unused packages based on configuration options",
      task: () => {
        return rimraf(path.join(newAppDir, "web-angular"), (err) => {
          if (err) {
            console.error(err);
          }
        });
      },
    },
  ];
};

const getConfigureAPIAnswers = async ({ newAppDir }) => {
  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "neo4j_uri",
      message: "Enter the connection string for Neo4j",
      default: "bolt://localhost:7687",
    },
    {
      type: "confirm",
      name: "neo4j_encrypted",
      message:
        'Use an encrypted connection for Neo4j? (Select "No" for Neo4j Sandbox)',
      default: false,
    },
    {
      type: "input",
      name: "neo4j_user",
      message: "Enter the Neo4j user",
      default: "neo4j",
    },
    {
      type: "input",
      name: "neo4j_password",
      message: "Enter the password for this user",
      default: "letmein",
    },
  ]);

  return answers;
};

const configureAPI = ({ answers, newAppDir }) => {
  const { neo4j_uri, neo4j_user, neo4j_password, neo4j_encrypted } = answers;

  const dotenvpath = path.join(newAppDir, "api");

  // FIXME: It would be better to replace into a template instead of rewrite entire file
  const dotenvstring = `# Use this file to set environment variables with credentials and configuration options
# This file is provided as an example and should be replaced with your own values
# You probably don't want to check this into version control!

NEO4J_URI=${neo4j_uri}
NEO4J_USER=${neo4j_user}
NEO4J_PASSWORD=${neo4j_password}

# Uncomment this line to enable encrypted driver connection for Neo4j
${neo4j_encrypted ? "" : "#"}NEO4J_ENCRYPTED=true

# Uncomment this line to specify a specific Neo4j database (v4.x+ only)
#NEO4J_DATABASE=neo4j

GRAPHQL_SERVER_HOST=0.0.0.0
GRAPHQL_SERVER_PORT=4001
GRAPHQL_SERVER_PATH=/graphql
  
`;

  fs.writeFileSync(path.join(dotenvpath, ".env"), dotenvstring);
};

const installNodeModulesTasks = ({ newAppDir }) => {
  return [
    {
      title: "Checking compatibility",
      task: () => {
        return new Promise((resolve, reject) => {
          // FIXME: pull this from grand-stack-starter repo
          const engines = {
            node: ">=8",
          };

          checkNodeVersion(engines, (_error, result) => {
            if (result.isSatisfied) {
              return resolve();
            }

            const errors = Object.keys(result.versions).map((name) => {
              const { version, wanted } = result.versions[name];
              return `${name} ${wanted} required, but found ${version}`;
            });
            return reject(new Error(errors.join("\n")));
          });
        });
      },
    },
    {
      title: "Installing GRANDstack CLI locally",
      task: () => {
        return execa(useYarn ? "yarn install" : "npm install", {
          shell: true,
          cwd: path.join(newAppDir),
        });
      },
    },
    {
      title: "Installing dependencies for 'api'",
      task: () => {
        return execa(useYarn ? "yarn install" : "npm install", {
          shell: true,
          cwd: path.join(newAppDir, "api"),
        });
      },
    },
    {
      title: "Installing dependencies for 'web-react'",
      task: () => {
        return execa(useYarn ? "yarn install" : "npm install", {
          shell: true,
          cwd: path.join(newAppDir, "web-react"),
        });
      },
    }
  ];
};

const main = async () => {
  new Listr(
    [
      {
        title: "Create GRANDstack App",
        task: () => new Listr(createProjectTasks({ newAppDir })),
      },
      {
        title: "Installing Packages",
        task: () => new Listr(installNodeModulesTasks({ newAppDir })),
      },
    ],
    { collapse: false, exitOnError: true }
  )
    .run()
    .then(async () => {
      console.log();

      if (!program.yes) {
        console.log(
          `Now let's configure your GraphQL API to connect to Neo4j.`
        );
        console.log(
          `These options will be written to ${targetDir}/api/.env and can be changed there if needed.`
        );
        console.log();
        console.log(
          `If you don't have a Neo4j instance yet you can create a free hosted Neo4j instance in the cloud at: https://neo4j.com/sandbox`
        );
        console.log();
        const answers = await getConfigureAPIAnswers({ newAppDir });
        configureAPI({ answers, newAppDir });
      }
      console.log();
      console.log(
        `Thanks for using GRANDstack! We've created your app in '${newAppDir}'`
      );
      console.log(`You can find documentation at: https://grandstack.io/docs`);
      console.log();
      console.log(`To start your GRANDstack web application and GraphQL API run:

        cd ${targetDir}
        npm run start

Then (optionally) to seed the database with sample data, in the api/ directory in another terminal run:

        npm run seedDb

      `);
    })
    .catch((e) => {
      console.log();
      console.log(e);
      process.exit(1);
    });
};

main();
